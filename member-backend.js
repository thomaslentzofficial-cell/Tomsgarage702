
(function(){
  const $ = (id) => document.getElementById(id);
  let supabaseClient = null;
  let currentUser = null;
  let vehicleCache = [];

  function msg(text){ const el = $("memberMessage"); if(el) el.textContent = text || ""; console.log("[Tom's Garage Member]", text || ""); }
  function money(n){ return "$" + Number(n || 0).toFixed(2); }
  function escapeHTML(str){ return String(str || "").replace(/[&<>"']/g, function(m){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]; });}
  function show(el, yes=true){ if(el) el.style.display = yes ? "" : "none"; }
  function statusBadge(status){
    const s = String(status || "Open");
    const cls = s === "Paid" || s === "Complete" || s === "Completed" ? "badge-paid" : s === "Void" || s === "Denied" ? "badge-void" : s === "Reviewing" || s === "Scheduled" ? "badge-blue" : "badge-open";
    return `<span class="badge ${cls}">${escapeHTML(s)}</span>`;
  }

  function getClient(){
    const url = window.TG_SUPABASE_URL;
    const key = window.TG_SUPABASE_ANON_KEY;
    if(!window.supabase || !window.supabase.createClient){ msg("Supabase library did not load."); return null; }
    if(!url || !key || url.includes("PASTE_") || key.includes("PASTE_")){ msg("Backend config missing. Check supabase-config.js."); return null; }
    return window.supabase.createClient(url, key);
  }

  async function init(){
    msg("Backend script loaded. Checking Supabase config...");
    document.querySelectorAll("form").forEach(form => form.setAttribute("action", "javascript:void(0)"));
    supabaseClient = getClient();
    if(!supabaseClient) return;
    msg("Supabase config found. Ready to sign in or create account.");

    $("signInForm")?.addEventListener("submit", signIn);
    $("signUpForm")?.addEventListener("submit", signUp);
    $("vehicleForm")?.addEventListener("submit", addVehicleBackend);
    $("requestForm")?.addEventListener("submit", addServiceRequest);
    $("signOutBtn")?.addEventListener("click", signOutMember);
    $("copyReferralBtn")?.addEventListener("click", copyReferralBackend);

    const { data } = await supabaseClient.auth.getSession();
    await renderAuth(data.session);
    supabaseClient.auth.onAuthStateChange((_event, session) => renderAuth(session));
  }

  async function renderAuth(session){
    show($("authBox"), !session);
    show($("portalBox"), !!session);
    currentUser = session ? session.user : null;
    if(session){ msg("Signed in. Loading portal..."); await loadPortal(session.user); }
  }

  async function signUp(event){
    event.preventDefault();
    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value.trim();
    const full_name = $("signupName").value.trim();
    const phone = $("signupPhone").value.trim();
    if(!email || !password || !full_name){ msg("Fill out name, email, and password."); return false; }
    msg("Creating account...");
    const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name, phone } } });
    msg(error ? "Signup error: " + error.message : "Account created. Check email if confirmation is required, then sign in.");
    return false;
  }

  async function signIn(event){
    event.preventDefault();
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value.trim();
    if(!email || !password){ msg("Enter your email and password."); return false; }
    msg("Signing in...");
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){ msg("Sign in error: " + error.message); return false; }
    msg("Signed in. Loading your portal...");
    await renderAuth(data.session);
    return false;
  }

  async function signOutMember(){ if(!supabaseClient) return; await supabaseClient.auth.signOut(); msg("Signed out."); }

  async function loadPortal(user){
    const { data: profile, error: profileErr } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();
    if(profileErr){ msg("Profile not ready yet: " + profileErr.message); return; }

    $("memberName").textContent = profile.full_name || "Garage Member";
    $("memberEmail").textContent = profile.email || user.email;
    $("memberRole").textContent = profile.role || "customer";
    $("memberReferralCode").textContent = profile.referral_code || "Pending";

    const adminLink = $("adminNavLink");
    if(adminLink && ["owner","admin","tech"].includes(profile.role)){ adminLink.style.display = ""; }

    await loadVehicles();
    await Promise.all([loadRequests(), loadRepairs(), loadInvoices(), loadCredits()]);
    msg("Portal loaded.");
  }

  async function loadVehicles(){
    const list = $("vehicleList"); if(list) list.innerHTML = "";
    const { data, error } = await supabaseClient.from("vehicles").select("*").order("created_at", { ascending: false });
    vehicleCache = data || [];
    if(error){ if(list) list.innerHTML = `<div class="notice">${escapeHTML(error.message)}</div>`; return; }

    populateVehicleSelects();

    if(!list) return;
    if(!vehicleCache.length){ list.innerHTML = `<div class="notice">No vehicles added yet.</div>`; return; }
    vehicleCache.forEach(v => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<small>Garage Vehicle</small><h3>${escapeHTML(v.nickname || "Vehicle")}</h3><p><b>${escapeHTML(v.year_make_model)}</b></p><p>${escapeHTML(v.mileage || "Mileage not listed")}</p><p>${escapeHTML(v.notes || "No notes yet")}</p>`;
      list.appendChild(card);
    });
  }

  function populateVehicleSelects(){
    const sel = $("requestVehicle"); if(!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">Select vehicle or leave blank</option>`;
    vehicleCache.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = `${v.nickname || v.year_make_model || "Vehicle"} — ${v.year_make_model || ""}`;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  function vehicleName(id){
    const v = vehicleCache.find(x => x.id === id);
    return v ? (v.nickname || v.year_make_model || "Vehicle") : "Vehicle";
  }

  async function addVehicleBackend(event){
    event.preventDefault();
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData.user;
    if(!user){ msg("You need to be signed in to add a vehicle."); return false; }
    const payload = { owner_id: user.id, nickname: $("vehicleName").value.trim(), year_make_model: $("vehicleInfo").value.trim(), mileage: $("vehicleMileage").value.trim(), notes: $("vehicleMods").value.trim() };
    const { error } = await supabaseClient.from("vehicles").insert(payload);
    if(error){ msg("Vehicle error: " + error.message); return false; }
    event.target.reset(); msg("Vehicle added."); await loadVehicles(); return false;
  }

  async function addServiceRequest(event){
    event.preventDefault();
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData.user;
    if(!user){ msg("You need to be signed in to submit a request."); return false; }

    const payload = {
      owner_id: user.id,
      vehicle_id: $("requestVehicle").value || null,
      request_type: $("requestType").value,
      urgency: $("requestUrgency").value,
      title: $("requestTitle").value.trim(),
      details: $("requestDetails").value.trim(),
      status: "New",
      attachments: []
    };

    if(!payload.title || !payload.details || !payload.request_type){
      msg("Fill out request type, title, and details.");
      return false;
    }

    msg("Creating service request...");
    const { data: request, error } = await supabaseClient.from("service_requests").insert(payload).select("*").single();
    if(error){ msg("Request error: " + error.message); return false; }

    const files = Array.from($("requestFiles").files || []);
    const attachments = [];
    const progress = $("uploadProgress");
    const progressBar = progress ? progress.querySelector("span") : null;
    if(progress && files.length) progress.style.display = "";

    for(let i=0; i<files.length; i++){
      const file = files[i];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${request.id}/${Date.now()}-${i}-${safeName}`;
      msg(`Uploading ${i+1} of ${files.length}: ${file.name}`);
      const { error: uploadError } = await supabaseClient.storage.from("service-media").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if(uploadError){ msg("Upload error: " + uploadError.message); continue; }
      attachments.push({ path, name: file.name, type: file.type, size: file.size });
      if(progressBar) progressBar.style.width = `${Math.round(((i+1)/files.length)*100)}%`;
    }

    if(attachments.length){
      const { error: updateError } = await supabaseClient.from("service_requests").update({ attachments }).eq("id", request.id);
      if(updateError){ msg("Request saved, but attachment list failed: " + updateError.message); }
    }

    event.target.reset();
    if(progress) setTimeout(() => { progress.style.display = "none"; if(progressBar) progressBar.style.width = "0"; }, 900);
    msg("Service request submitted. Tom's Garage can now view it in admin.");
    await loadRequests();
    return false;
  }

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

  async function loadRequests(){
    const rows = $("requestRows"); if(!rows) return; rows.innerHTML = "";
    const { data, error } = await supabaseClient.from("service_requests").select("*").order("created_at", { ascending: false });
    if(error){ rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }
    if(!data.length){ rows.innerHTML = `<tr><td colspan="6">No service requests yet.</td></tr>`; return; }
    for(const r of data){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHTML(new Date(r.created_at).toLocaleDateString())}</td><td>${escapeHTML(vehicleName(r.vehicle_id))}</td><td><b>${escapeHTML(r.title)}</b><br><span class="muted">${escapeHTML(r.request_type || "")}</span></td><td>${escapeHTML(r.urgency || "Normal")}</td><td>${statusBadge(r.status)}</td><td>${await mediaLinks(r.attachments || [])}</td>`;
      rows.appendChild(tr);
    }
  }

  async function loadRepairs(){
    const rows = $("historyRows"); if(!rows) return; rows.innerHTML = "";
    const { data, error } = await supabaseClient.from("repair_records").select("*, vehicles(year_make_model,nickname)").order("service_date", { ascending: false });
    if(error){ rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }
    if(!data.length){ rows.innerHTML = `<tr><td colspan="6">No repair records yet.</td></tr>`; return; }
    data.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHTML(r.service_date)}</td><td>${escapeHTML((r.vehicles && (r.vehicles.nickname || r.vehicles.year_make_model)) || "Vehicle")}</td><td>${escapeHTML(r.title)}</td><td>${statusBadge(r.status)}</td><td>${money(r.cost)}</td><td class="note-cell">${escapeHTML(r.notes || "No notes added yet.")}</td>`;
      rows.appendChild(tr);
    });
  }

  async function loadInvoices(){
    const rows = $("invoiceRows"); if(!rows) return; rows.innerHTML = "";
    const { data, error } = await supabaseClient.from("invoices").select("*").order("created_at", { ascending: false });
    if(error){ rows.innerHTML = `<tr><td colspan="4">${escapeHTML(error.message)}</td></tr>`; return; }
    if(!data.length){ rows.innerHTML = `<tr><td colspan="4">No invoices yet.</td></tr>`; return; }
    data.forEach(i => {
      const pay = i.payment_url && i.status !== "Paid" ? `<a class="btn btn-primary btn-small" href="${escapeHTML(i.payment_url)}" target="_blank" rel="noopener">Pay Now</a>` : statusBadge(i.status);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHTML(i.title)}</td><td>${money(i.amount)}</td><td>${statusBadge(i.status)}</td><td>${pay}</td>`;
      rows.appendChild(tr);
    });
  }

  async function loadCredits(){
    const el = $("creditTotal"); if(!el) return;
    const { data, error } = await supabaseClient.from("credit_ledger").select("*").eq("status", "Active");
    if(error){ el.textContent = "$0"; return; }
    const total = data.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    el.textContent = money(total);
  }

  function copyReferralBackend(){
    const code = $("memberReferralCode").textContent;
    navigator.clipboard.writeText(code).then(() => msg("Referral code copied: " + code));
  }

  window.addEventListener("error", e => msg("Script error: " + e.message));
  document.addEventListener("DOMContentLoaded", init);
})();
