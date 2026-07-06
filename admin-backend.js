
(function(){
  const $ = (id) => document.getElementById(id);
  let supabaseClient = null;
  let profileCache = {};
  let vehicles = [];
  let currentAdminId = null;

  function msg(text){ const el = $("adminMessage"); if(el) el.textContent = text || ""; console.log("[Tom's Garage Admin]", text || ""); }
  function escapeHTML(str){ return String(str || "").replace(/[&<>"']/g, function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]; });}
  function money(n){ return "$" + Number(n || 0).toFixed(2); }
  function show(el, yes=true){ if(el) el.style.display = yes ? "" : "none"; }
  function statusBadge(status){ const s = String(status || "Open"); const cls = s === "Paid" || s === "Complete" || s === "Completed" ? "badge-paid" : s === "Void" || s === "Denied" ? "badge-void" : s === "Reviewing" || s === "Scheduled" ? "badge-blue" : "badge-open"; return `<span class="badge ${cls}">${escapeHTML(s)}</span>`; }

  function getClient(){
    const url = window.TG_SUPABASE_URL;
    const key = window.TG_SUPABASE_ANON_KEY;
    if(!window.supabase || !window.supabase.createClient){ msg("Supabase library did not load."); return null; }
    if(!url || !key || url.includes("PASTE_") || key.includes("PASTE_")){ msg("Backend config missing. Check supabase-config.js."); return null; }
    return window.supabase.createClient(url, key);
  }

  async function init(){
    msg("Admin backend script loaded. Checking config...");
    document.querySelectorAll("form").forEach(form => form.setAttribute("action", "javascript:void(0)"));
    supabaseClient = getClient(); if(!supabaseClient) return;
    msg("Supabase config found. Ready for admin sign in.");

    $("adminSignInForm")?.addEventListener("submit", adminSignIn);
    $("adminSignOutBtn")?.addEventListener("click", adminSignOut);
    $("adminVehicleForm")?.addEventListener("submit", adminAddVehicleBackend);
    $("adminJobForm")?.addEventListener("submit", adminAddJobBackend);
    $("adminInvoiceForm")?.addEventListener("submit", adminAddInvoiceBackend);
    $("adminCreditForm")?.addEventListener("submit", adminAddCreditBackend);
    $("copyInviteBtn")?.addEventListener("click", copyInviteLink);
    $("jobCustomer")?.addEventListener("change", populateJobVehicles);

    const { data } = await supabaseClient.auth.getSession();
    await renderAuth(data.session);
    supabaseClient.auth.onAuthStateChange((_event, session) => renderAuth(session));
  }

  async function renderAuth(session){
    show($("adminAuth"), !session);
    show($("adminApp"), false);
    if(!session) return;

    const { data: profile, error } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).single();
    if(error){ msg("Profile not ready: " + error.message); return; }
    if(!["owner","admin","tech"].includes(profile.role)){ msg("Signed in, but this account is not admin yet."); return; }

    currentAdminId = session.user.id;
    $("adminName").textContent = profile.full_name || profile.email || "Admin";
    $("adminRole").textContent = profile.role;
    show($("adminApp"), true);
    msg("Admin dashboard loaded.");
    await loadAdminData();
  }

  async function adminSignIn(event){
    event.preventDefault();
    msg("Signing in...");
    const { error } = await supabaseClient.auth.signInWithPassword({ email: $("adminEmail").value.trim(), password: $("adminPassword").value.trim() });
    if(error) msg("Admin sign in error: " + error.message);
  }

  async function adminSignOut(){ if(!supabaseClient) return; await supabaseClient.auth.signOut(); msg("Signed out."); }

  async function loadAdminData(){
    await loadProfiles();
    await loadVehicles();
    await Promise.all([loadServiceRequests(), loadJobs(), loadInvoices(), loadCredits()]);
  }

  async function loadProfiles(){
    const { data, error } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending:false });
    const rows = $("memberRows"); if(rows) rows.innerHTML = "";
    if(error){ if(rows) rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }
    profileCache = {}; data.forEach(p => profileCache[p.id] = p);
    $("statMembers").textContent = data.length;

    if(rows){
      data.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHTML(p.full_name || "")}</td><td>${escapeHTML(p.phone || "")}</td><td>${escapeHTML(p.email || "")}</td><td>${escapeHTML(p.referral_code || "")}</td><td>${statusBadge(p.role)}</td><td>${escapeHTML(p.id)}</td>`;
        rows.appendChild(tr);
      });
    }

    document.querySelectorAll(".customer-select").forEach(sel => {
      const current = sel.value;
      sel.innerHTML = `<option value="">Select customer</option>`;
      data.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.full_name || p.email || "Customer"} — ${p.email || ""}`;
        sel.appendChild(opt);
      });
      sel.value = current;
    });
  }

  async function loadVehicles(){
    const { data, error } = await supabaseClient.from("vehicles").select("*").order("created_at", { ascending:false });
    const rows = $("vehicleRows"); if(rows) rows.innerHTML = "";
    vehicles = [];
    if(error){ if(rows) rows.innerHTML = `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`; return; }
    vehicles = data || [];
    if(rows){
      if(!vehicles.length){ rows.innerHTML = `<tr><td colspan="5">No vehicles yet.</td></tr>`; }
      vehicles.forEach(v => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHTML(profileName(v.owner_id))}</td><td>${escapeHTML(v.nickname || "")}</td><td>${escapeHTML(v.year_make_model || "")}</td><td>${escapeHTML(v.mileage || "")}</td><td class="note-cell">${escapeHTML(v.notes || "")}</td>`;
        rows.appendChild(tr);
      });
    }
    populateJobVehicles();
  }

  function populateJobVehicles(){
    const sel = $("jobVehicle"); if(!sel) return;
    const customerId = $("jobCustomer")?.value || "";
    const current = sel.value;
    sel.innerHTML = `<option value="">No vehicle selected</option>`;
    vehicles.filter(v => !customerId || v.owner_id === customerId).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = `${v.nickname || v.year_make_model || "Vehicle"} — ${v.year_make_model || ""}`;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  function profileName(id){ const p = profileCache[id]; return p ? (p.full_name || p.email || "Customer") : "Customer"; }
  function vehicleName(id){ const v = vehicles.find(x => x.id === id); return v ? (v.nickname || v.year_make_model || "Vehicle") : "Vehicle"; }

  async function signedLink(path, label){
    const { data, error } = await supabaseClient.storage.from("service-media").createSignedUrl(path, 60 * 30);
    if(error) return `<span class="badge">Media</span>`;
    return `<a href="${escapeHTML(data.signedUrl)}" target="_blank" rel="noopener">${escapeHTML(label || "Media")}</a>`;
  }

  async function mediaLinks(attachments){
    if(!attachments || !attachments.length) return `<span class="badge">None</span>`;
    const links = [];
    for(let i=0; i<attachments.length; i++){
      const a = attachments[i];
      links.push(await signedLink(a.path, `File ${i+1}`));
    }
    return `<div class="media-links">${links.join("")}</div>`;
  }

  async function loadServiceRequests(){
    const { data, error } = await supabaseClient.from("service_requests").select("*").order("created_at", { ascending:false });
    const rows = $("serviceRequestRows"); if(!rows) return; rows.innerHTML = "";
    if(error){ rows.innerHTML = `<tr><td colspan="8">${escapeHTML(error.message)}</td></tr>`; return; }

    $("statRequests").textContent = data.filter(r => !["Complete","Denied"].includes(r.status)).length;

    if(!data.length){ rows.innerHTML = `<tr><td colspan="8">No service requests yet.</td></tr>`; return; }

    for(const r of data){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHTML(new Date(r.created_at).toLocaleDateString())}</td><td>${escapeHTML(profileName(r.owner_id))}</td><td>${escapeHTML(vehicleName(r.vehicle_id))}</td><td><b>${escapeHTML(r.title)}</b><br><span class="muted">${escapeHTML(r.details || "")}</span></td><td>${escapeHTML(r.urgency || "Normal")}</td><td>${statusBadge(r.status)}</td><td>${await mediaLinks(r.attachments || [])}</td><td><select class="field" data-request-status="${escapeHTML(r.id)}"><option>New</option><option>Reviewing</option><option>Scheduled</option><option>Complete</option><option>Denied</option></select></td>`;
      rows.appendChild(tr);
      const select = tr.querySelector("[data-request-status]");
      if(select) select.value = r.status || "New";
    }

    document.querySelectorAll("[data-request-status]").forEach(sel => {
      sel.addEventListener("change", () => updateRequestStatus(sel.getAttribute("data-request-status"), sel.value));
    });
  }

  async function updateRequestStatus(id, status){
    const { error } = await supabaseClient.from("service_requests").update({ status }).eq("id", id);
    if(error){ msg("Status update error: " + error.message); return; }
    msg("Request status updated.");
    await loadServiceRequests();
  }

  async function loadJobs(){
    const { data, error } = await supabaseClient.from("repair_records").select("*").order("service_date", { ascending:false });
    const rows = $("jobRows"); if(!rows) return; rows.innerHTML = "";
    if(error){ rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }
    $("statJobs").textContent = data.filter(j => j.status !== "Complete").length;
    if(!data.length){ rows.innerHTML = `<tr><td colspan="6">No repair records yet.</td></tr>`; return; }
    data.forEach(j => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHTML(profileName(j.owner_id))}</td><td>${escapeHTML(vehicleName(j.vehicle_id))}</td><td>${escapeHTML(j.title)}</td><td>${statusBadge(j.status)}</td><td>${money(j.cost)}</td><td class="note-cell">${escapeHTML(j.notes || "")}</td>`;
      rows.appendChild(tr);
    });
  }

  async function loadInvoices(){
    const { data, error } = await supabaseClient.from("invoices").select("*").order("created_at", { ascending:false });
    const rows = $("invoiceRows"); if(!rows) return; rows.innerHTML = "";
    if(error){ rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }
    if(!data.length){ rows.innerHTML = `<tr><td colspan="6">No invoices yet.</td></tr>`; return; }
    data.forEach(i => {
      const paymentLink = i.payment_url ? `<a class="btn btn-primary btn-small" href="${escapeHTML(i.payment_url)}" target="_blank" rel="noopener">Open Link</a>` : `<span class="badge">No Link</span>`;
      const markPaid = i.status !== "Paid" ? `<button class="btn btn-small" data-invoice-paid="${escapeHTML(i.id)}">Mark Paid</button>` : `<span class="badge badge-paid">Paid</span>`;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHTML(profileName(i.owner_id))}</td><td>${escapeHTML(i.title)}</td><td>${money(i.amount)}</td><td>${statusBadge(i.status)}</td><td>${paymentLink}</td><td>${markPaid}</td>`;
      rows.appendChild(tr);
    });
    document.querySelectorAll("[data-invoice-paid]").forEach(btn => btn.addEventListener("click", () => markInvoicePaid(btn.getAttribute("data-invoice-paid"))));
  }

  async function loadCredits(){
    const { data, error } = await supabaseClient.from("credit_ledger").select("amount,status");
    if(error){ return; }
    const active = data.filter(c => c.status === "Active").reduce((sum,c)=>sum+Number(c.amount||0),0);
  }

  async function adminAddVehicleBackend(event){
    event.preventDefault();
    const payload = { owner_id: $("vehicleCustomer").value, nickname: $("adminVehicleNickname").value.trim(), year_make_model: $("adminVehicleInfo").value.trim(), mileage: $("adminVehicleMileage").value.trim(), notes: $("adminVehicleNotes").value.trim() };
    if(!payload.owner_id){ msg("Choose a customer before adding a vehicle."); return; }
    const { error } = await supabaseClient.from("vehicles").insert(payload);
    if(error){ msg("Vehicle error: " + error.message); return; }
    event.target.reset(); msg("Vehicle added."); await loadVehicles();
  }

  async function adminAddJobBackend(event){
    event.preventDefault();
    const payload = { owner_id: $("jobCustomer").value, vehicle_id: $("jobVehicle").value || null, title: $("jobTitle").value.trim(), status: $("jobStatus").value, notes: $("jobNotes").value.trim(), cost: Number($("jobCost").value || 0), service_date: $("jobDate").value || new Date().toISOString().slice(0,10), created_by: currentAdminId };
    if(!payload.owner_id){ msg("Choose a customer before adding a repair."); return; }
    const { error } = await supabaseClient.from("repair_records").insert(payload);
    if(error){ msg("Repair error: " + error.message); return; }
    event.target.reset(); msg("Repair added."); await loadJobs();
  }

  async function adminAddInvoiceBackend(event){
    event.preventDefault();
    const payload = { owner_id: $("invoiceCustomer").value, title: $("invoiceTitle").value.trim(), amount: Number($("invoiceAmount").value || 0), status: $("invoiceStatus").value, payment_url: $("invoicePaymentUrl").value.trim(), created_by: currentAdminId };
    if(!payload.owner_id){ msg("Choose a customer before adding an invoice."); return; }
    const { error } = await supabaseClient.from("invoices").insert(payload);
    if(error){ msg("Invoice error: " + error.message); return; }
    event.target.reset(); msg("Invoice added."); await loadInvoices();
  }

  async function markInvoicePaid(invoiceId){
    if(!invoiceId) return;
    const { error } = await supabaseClient.from("invoices").update({ status: "Paid" }).eq("id", invoiceId);
    if(error){ msg("Invoice update error: " + error.message); return; }
    msg("Invoice marked paid."); await loadInvoices();
  }

  async function adminAddCreditBackend(event){
    event.preventDefault();
    const payload = { owner_id: $("creditCustomer").value, amount: Number($("creditAmount").value || 0), reason: $("creditReason").value.trim(), source: "admin", status: "Active", created_by: currentAdminId };
    if(!payload.owner_id){ msg("Choose a customer before adding credit."); return; }
    const { error } = await supabaseClient.from("credit_ledger").insert(payload);
    if(error){ msg("Credit error: " + error.message); return; }
    event.target.reset(); msg("Credit added."); await loadCredits();
  }

  function copyInviteLink(){
    const text = "Create your Tom's Garage member account here: https://tomsgarage702.com/members.html";
    navigator.clipboard.writeText(text).then(() => msg("Invite link copied."));
  }

  window.addEventListener("error", e => msg("Script error: " + e.message));
  document.addEventListener("DOMContentLoaded", init);
})();
