
(function(){
  const $ = (id) => document.getElementById(id);
  let supabaseClient = null;

  function msg(text){
    const el = $("adminMessage");
    if(el) el.textContent = text || "";
    console.log("[Tom's Garage Admin]", text || "");
  }
  function escapeHTML(str){
    return String(str || "").replace(/[&<>"']/g, function(m){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m];
    });
  }
  function money(n){ return "$" + Number(n || 0).toFixed(2); }
  function show(el, yes=true){ if(el) el.style.display = yes ? "" : "none"; }

  function getClient(){
    const url = window.TG_SUPABASE_URL;
    const key = window.TG_SUPABASE_ANON_KEY;

    if(!window.supabase || !window.supabase.createClient){
      msg("Supabase library did not load.");
      return null;
    }
    if(!url || !key || url.includes("PASTE_") || key.includes("PASTE_")){
      msg("Backend config missing. Paste your Supabase Project URL and anon public key into supabase-config.js.");
      return null;
    }
    return window.supabase.createClient(url, key);
  }

  async function init(){
    msg("Admin backend script loaded. Checking config...");
    document.querySelectorAll("form").forEach(function(form){
      form.setAttribute("action", "javascript:void(0)");
    });

    supabaseClient = getClient();
    if(!supabaseClient) return;

    msg("Supabase config found. Ready for admin sign in.");

    const authForm = $("adminSignInForm");
    if(authForm) authForm.addEventListener("submit", adminSignIn);

    const signOutBtn = $("adminSignOutBtn");
    if(signOutBtn) signOutBtn.addEventListener("click", adminSignOut);

    const jobForm = $("adminJobForm");
    if(jobForm) jobForm.addEventListener("submit", adminAddJobBackend);

    const invoiceForm = $("adminInvoiceForm");
    if(invoiceForm) invoiceForm.addEventListener("submit", adminAddInvoiceBackend);

    const creditForm = $("adminCreditForm");
    if(creditForm) creditForm.addEventListener("submit", adminAddCreditBackend);

    const { data } = await supabaseClient.auth.getSession();
    await renderAuth(data.session);

    supabaseClient.auth.onAuthStateChange(function(_event, session){
      renderAuth(session);
    });
  }

  async function renderAuth(session){
    show($("adminAuth"), !session);
    show($("adminApp"), false);
    if(!session) return;

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if(error){
      msg("Profile not ready: " + error.message);
      return;
    }

    if(!["owner","admin","tech"].includes(profile.role)){
      msg("Signed in, but this account is not admin yet. Run the owner update SQL command.");
      return;
    }

    $("adminName").textContent = profile.full_name || profile.email || "Admin";
    $("adminRole").textContent = profile.role;
    show($("adminApp"), true);
    msg("Admin dashboard loaded.");
    await loadAdminData();
  }

  async function adminSignIn(event){
    event.preventDefault();
    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value.trim();
    msg("Signing in...");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error) msg("Admin sign in error: " + error.message);
  }

  async function adminSignOut(){
    if(!supabaseClient) return;
    await supabaseClient.auth.signOut();
    msg("Signed out.");
  }

  async function loadAdminData(){
    await Promise.all([loadProfiles(), loadJobs(), loadInvoices(), loadCredits()]);
  }

  async function loadProfiles(){
    const { data, error } = await supabaseClient.from("profiles").select("*").order("created_at", { ascending:false });
    const rows = $("memberRows");
    if(!rows) return;
    rows.innerHTML = "";

    if(error){
      rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    $("statMembers").textContent = data.length;

    data.forEach(function(p){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(p.full_name || "")}</td>
        <td>${escapeHTML(p.phone || "")}</td>
        <td>${escapeHTML(p.email || "")}</td>
        <td>${escapeHTML(p.referral_code || "")}</td>
        <td><span class="badge">${escapeHTML(p.role)}</span></td>
        <td>${escapeHTML(p.id)}</td>
      `;
      rows.appendChild(tr);
    });

    document.querySelectorAll(".customer-select").forEach(function(sel){
      const current = sel.value;
      sel.innerHTML = `<option value="">Select customer</option>`;
      data.forEach(function(p){
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.full_name || p.email || "Customer"} — ${p.email || ""}`;
        sel.appendChild(opt);
      });
      sel.value = current;
    });
  }

  async function loadJobs(){
    const { data, error } = await supabaseClient
      .from("repair_records")
      .select("*, profiles(full_name,email), vehicles(year_make_model,nickname)")
      .order("service_date", { ascending:false });

    const rows = $("jobRows");
    if(!rows) return;
    rows.innerHTML = "";

    if(error){
      rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    $("statJobs").textContent = data.filter(j => j.status !== "Complete").length;

    data.forEach(function(j){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML((j.profiles && (j.profiles.full_name || j.profiles.email)) || "Customer")}</td>
        <td>${escapeHTML((j.vehicles && (j.vehicles.nickname || j.vehicles.year_make_model)) || "Vehicle")}</td>
        <td>${escapeHTML(j.title)}</td>
        <td><span class="badge">${escapeHTML(j.status)}</span></td>
        <td>${money(j.cost)}</td>
        <td>${escapeHTML(j.notes || "")}</td>
      `;
      rows.appendChild(tr);
    });
  }

  async function loadInvoices(){
    const { data, error } = await supabaseClient.from("invoices").select("*, profiles(full_name,email)").order("created_at", { ascending:false });
    const rows = $("invoiceRows");
    if(!rows) return;
    rows.innerHTML = "";
    if(error){
      rows.innerHTML = `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`;
      return;
    }
    data.forEach(function(i){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML((i.profiles && (i.profiles.full_name || i.profiles.email)) || "Customer")}</td>
        <td>${escapeHTML(i.title)}</td>
        <td>${money(i.amount)}</td>
        <td><span class="badge">${escapeHTML(i.status)}</span></td>
        <td>${escapeHTML(i.payment_url || "")}</td>
      `;
      rows.appendChild(tr);
    });
  }

  async function loadCredits(){
    const { data, error } = await supabaseClient.from("credit_ledger").select("amount,status");
    if(error){
      $("statCredits").textContent = "$0";
      return;
    }
    const active = data.filter(c => c.status === "Active").reduce((sum,c)=>sum+Number(c.amount||0),0);
    $("statCredits").textContent = money(active);
  }

  async function adminAddJobBackend(event){
    event.preventDefault();
    const payload = {
      owner_id: $("jobCustomer").value,
      title: $("jobTitle").value.trim(),
      status: $("jobStatus").value,
      notes: $("jobNotes").value.trim(),
      cost: Number($("jobCost").value || 0),
      service_date: $("jobDate").value || new Date().toISOString().slice(0,10)
    };
    const { error } = await supabaseClient.from("repair_records").insert(payload);
    if(error){ msg("Repair error: " + error.message); return; }
    event.target.reset();
    msg("Repair added.");
    await loadJobs();
  }

  async function adminAddInvoiceBackend(event){
    event.preventDefault();
    const payload = {
      owner_id: $("invoiceCustomer").value,
      title: $("invoiceTitle").value.trim(),
      amount: Number($("invoiceAmount").value || 0),
      status: $("invoiceStatus").value,
      payment_url: $("invoicePaymentUrl").value.trim()
    };
    const { error } = await supabaseClient.from("invoices").insert(payload);
    if(error){ msg("Invoice error: " + error.message); return; }
    event.target.reset();
    msg("Invoice added.");
    await loadInvoices();
  }

  async function adminAddCreditBackend(event){
    event.preventDefault();
    const payload = {
      owner_id: $("creditCustomer").value,
      amount: Number($("creditAmount").value || 0),
      reason: $("creditReason").value.trim(),
      source: "admin",
      status: "Active"
    };
    const { error } = await supabaseClient.from("credit_ledger").insert(payload);
    if(error){ msg("Credit error: " + error.message); return; }
    event.target.reset();
    msg("Credit added.");
    await loadCredits();
  }

  window.addEventListener("error", function(e){
    msg("Script error: " + e.message);
  });

  document.addEventListener("DOMContentLoaded", init);
})();
