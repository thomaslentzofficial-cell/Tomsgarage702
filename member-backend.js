
(function(){
  const $ = (id) => document.getElementById(id);

  function msg(text){
    const el = $("memberMessage");
    if(el) el.textContent = text || "";
    console.log("[Tom's Garage Member]", text || "");
  }

  function money(n){ return "$" + Number(n || 0).toFixed(2); }

  function escapeHTML(str){
    return String(str || "").replace(/[&<>"']/g, function(m){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m];
    });
  }

  function show(el, yes=true){
    if(el) el.style.display = yes ? "" : "none";
  }

  function getClient(){
    const url = window.TG_SUPABASE_URL;
    const key = window.TG_SUPABASE_ANON_KEY;

    if(!window.supabase || !window.supabase.createClient){
      msg("Supabase library did not load. Check internet connection or browser blocking scripts.");
      return null;
    }

    if(!url || !key || url.includes("PASTE_") || key.includes("PASTE_")){
      msg("Backend config missing. Paste your Supabase Project URL and anon public key into supabase-config.js.");
      return null;
    }

    return window.supabase.createClient(url, key);
  }

  let supabaseClient = null;

  async function init(){
    msg("Backend script loaded. Checking Supabase config...");
    document.querySelectorAll("form").forEach(function(form){
      form.setAttribute("action", "javascript:void(0)");
    });

    supabaseClient = getClient();
    if(!supabaseClient) return;

    msg("Supabase config found. Ready to sign in or create account.");

    const signInForm = $("signInForm");
    const signUpForm = $("signUpForm");
    const vehicleForm = $("vehicleForm");

    if(signInForm) signInForm.addEventListener("submit", signIn);
    if(signUpForm) signUpForm.addEventListener("submit", signUp);
    if(vehicleForm) vehicleForm.addEventListener("submit", addVehicleBackend);

    const signOutBtn = $("signOutBtn");
    if(signOutBtn) signOutBtn.addEventListener("click", signOutMember);

    const copyBtn = $("copyReferralBtn");
    if(copyBtn) copyBtn.addEventListener("click", copyReferralBackend);

    const { data } = await supabaseClient.auth.getSession();
    await renderAuth(data.session);

    supabaseClient.auth.onAuthStateChange(function(_event, session){
      renderAuth(session);
    });
  }

  async function renderAuth(session){
    show($("authBox"), !session);
    show($("portalBox"), !!session);

    if(session){
      msg("Signed in. Loading portal...");
      await loadPortal(session.user);
    }
  }

  async function signUp(event){
    event.preventDefault();
    if(!supabaseClient) supabaseClient = getClient();
    if(!supabaseClient) return false;

    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value.trim();
    const full_name = $("signupName").value.trim();
    const phone = $("signupPhone").value.trim();

    if(!email || !password || !full_name){
      msg("Fill out name, email, and password.");
      return false;
    }

    msg("Creating account...");

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: full_name, phone: phone } }
    });

    if(error){
      msg("Signup error: " + error.message);
      return false;
    }

    msg("Account created. If Supabase requires email confirmation, check your email. Otherwise, try signing in.");
    return false;
  }

  async function signIn(event){
    event.preventDefault();
    if(!supabaseClient) supabaseClient = getClient();
    if(!supabaseClient) return false;

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value.trim();

    if(!email || !password){
      msg("Enter your email and password.");
      return false;
    }

    msg("Signing in...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if(error){
      msg("Sign in error: " + error.message);
      return false;
    }

    msg("Signed in. Loading your portal...");
    await renderAuth(data.session);
    return false;
  }

  async function signOutMember(){
    if(!supabaseClient) return;
    await supabaseClient.auth.signOut();
    msg("Signed out.");
  }

  async function loadPortal(user){
    const { data: profile, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if(profileErr){
      msg("Profile not ready yet: " + profileErr.message);
      return;
    }

    $("memberName").textContent = profile.full_name || "Garage Member";
    $("memberEmail").textContent = profile.email || user.email;
    $("memberRole").textContent = profile.role || "customer";
    $("memberReferralCode").textContent = profile.referral_code || "Pending";

    await Promise.all([loadVehicles(), loadRepairs(), loadInvoices(), loadCredits()]);
    msg("Portal loaded.");
  }

  async function loadVehicles(){
    const list = $("vehicleList");
    if(!list) return;
    list.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    if(error){
      list.innerHTML = `<div class="notice">${escapeHTML(error.message)}</div>`;
      return;
    }

    if(!data.length){
      list.innerHTML = `<div class="notice">No vehicles added yet.</div>`;
      return;
    }

    data.forEach(function(v){
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <small>Garage Vehicle</small>
        <h3>${escapeHTML(v.nickname || "Vehicle")}</h3>
        <p><b>${escapeHTML(v.year_make_model)}</b></p>
        <p>${escapeHTML(v.mileage || "Mileage not listed")}</p>
        <p>${escapeHTML(v.notes || "No notes yet")}</p>
      `;
      list.appendChild(card);
    });
  }

  async function addVehicleBackend(event){
    event.preventDefault();
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData.user;
    if(!user){
      msg("You need to be signed in to add a vehicle.");
      return false;
    }

    const payload = {
      owner_id: user.id,
      nickname: $("vehicleName").value.trim(),
      year_make_model: $("vehicleInfo").value.trim(),
      mileage: $("vehicleMileage").value.trim(),
      notes: $("vehicleMods").value.trim()
    };

    const { error } = await supabaseClient.from("vehicles").insert(payload);
    if(error){
      msg("Vehicle error: " + error.message);
      return false;
    }

    event.target.reset();
    msg("Vehicle added.");
    await loadVehicles();
    return false;
  }

  async function loadRepairs(){
    const rows = $("historyRows");
    if(!rows) return;
    rows.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("repair_records")
      .select("*, vehicles(year_make_model,nickname)")
      .order("service_date", { ascending: false });

    if(error){
      rows.innerHTML = `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    if(!data.length){
      rows.innerHTML = `<tr><td colspan="5">No repair records yet.</td></tr>`;
      return;
    }

    data.forEach(function(r){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(r.service_date)}</td>
        <td>${escapeHTML((r.vehicles && (r.vehicles.nickname || r.vehicles.year_make_model)) || "Vehicle")}</td>
        <td>${escapeHTML(r.title)}</td>
        <td><span class="badge">${escapeHTML(r.status)}</span></td>
        <td>${money(r.cost)}</td>
      `;
      rows.appendChild(tr);
    });
  }

  async function loadInvoices(){
    const rows = $("invoiceRows");
    if(!rows) return;
    rows.innerHTML = "";

    const { data, error } = await supabaseClient
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if(error){
      rows.innerHTML = `<tr><td colspan="4">${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    if(!data.length){
      rows.innerHTML = `<tr><td colspan="4">No invoices yet.</td></tr>`;
      return;
    }

    data.forEach(function(i){
      const tr = document.createElement("tr");
      const pay = i.payment_url ? `<a class="btn btn-primary" href="${escapeHTML(i.payment_url)}" target="_blank" rel="noopener">Pay Now</a>` : `<span class="badge">${escapeHTML(i.status)}</span>`;
      tr.innerHTML = `
        <td>${escapeHTML(i.title)}</td>
        <td>${money(i.amount)}</td>
        <td><span class="badge">${escapeHTML(i.status)}</span></td>
        <td>${pay}</td>
      `;
      rows.appendChild(tr);
    });
  }

  async function loadCredits(){
    const el = $("creditTotal");
    if(!el) return;

    const { data, error } = await supabaseClient
      .from("credit_ledger")
      .select("*")
      .eq("status", "Active");

    if(error){
      el.textContent = "$0";
      return;
    }

    const total = data.reduce(function(sum, c){
      return sum + Number(c.amount || 0);
    }, 0);

    el.textContent = money(total);
  }

  function copyReferralBackend(){
    const code = $("memberReferralCode").textContent;
    navigator.clipboard.writeText(code).then(function(){
      msg("Referral code copied: " + code);
    });
  }

  window.signUp = signUp;
  window.signIn = signIn;
  window.signOutMember = signOutMember;

  window.addEventListener("error", function(e){
    msg("Script error: " + e.message);
  });

  document.addEventListener("DOMContentLoaded", init);
})();
