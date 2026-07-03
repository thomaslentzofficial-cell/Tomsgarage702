
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const configured = SUPABASE_URL && SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);

function money(n){ return "$" + Number(n || 0).toFixed(2); }
function escapeHTML(str){
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function show(el, yes=true){ if(el) el.style.display = yes ? "" : "none"; }
function msg(text){ const m = $("memberMessage"); if(m) m.textContent = text || ""; }

function requireConfig(){
  if(configured) return true;
  msg("Backend not connected yet. Edit supabase-config.js with your Supabase URL and anon key.");
  return false;
}

async function init(){
  if(!requireConfig()) return;
  const { data } = await supabase.auth.getSession();
  renderAuth(data.session);
  supabase.auth.onAuthStateChange((_event, session) => renderAuth(session));
}

async function renderAuth(session){
  show($("authBox"), !session);
  show($("portalBox"), !!session);
  if(session) await loadPortal(session.user);
}

window.signUp = async function(event){
  event.preventDefault();
  if(!requireConfig()) return;
  msg("Creating account...");
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value.trim();
  const full_name = $("signupName").value.trim();
  const phone = $("signupPhone").value.trim();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name, phone } }
  });

  msg(error ? error.message : "Account created. Check email if confirmation is required, then sign in.");
};

window.signIn = async function(event){
  event.preventDefault();
  if(!requireConfig()) return;
  msg("Signing in...");
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  msg(error ? error.message : "");
};

window.signOutMember = async function(){
  if(!requireConfig()) return;
  await supabase.auth.signOut();
  msg("Signed out.");
};

async function loadPortal(user){
  msg("");
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if(profileErr){
    msg("Profile not ready yet. Refresh once, or confirm your email if Supabase requires it.");
    return;
  }

  $("memberName").textContent = profile.full_name || "Garage Member";
  $("memberEmail").textContent = profile.email || user.email;
  $("memberRole").textContent = profile.role || "customer";
  $("memberReferralCode").textContent = profile.referral_code || "Pending";

  await Promise.all([
    loadVehicles(user.id),
    loadRepairs(user.id),
    loadInvoices(user.id),
    loadCredits(user.id)
  ]);
}

async function loadVehicles(userId){
  const list = $("vehicleList");
  list.innerHTML = "";
  const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
  if(error){ list.innerHTML = `<div class="notice">${escapeHTML(error.message)}</div>`; return; }
  if(!data.length){ list.innerHTML = `<div class="notice">No vehicles added yet.</div>`; return; }

  data.forEach(v => {
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

window.addVehicleBackend = async function(event){
  event.preventDefault();
  if(!requireConfig()) return;
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return;

  const payload = {
    owner_id: user.id,
    nickname: $("vehicleName").value.trim(),
    year_make_model: $("vehicleInfo").value.trim(),
    mileage: $("vehicleMileage").value.trim(),
    notes: $("vehicleMods").value.trim()
  };

  const { error } = await supabase.from("vehicles").insert(payload);
  if(error){ msg(error.message); return; }
  event.target.reset();
  msg("Vehicle added.");
  await loadVehicles(user.id);
};

async function loadRepairs(){
  const rows = $("historyRows");
  rows.innerHTML = "";
  const { data, error } = await supabase
    .from("repair_records")
    .select("*, vehicles(year_make_model,nickname)")
    .order("service_date", { ascending: false });

  if(error){ rows.innerHTML = `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`; return; }
  if(!data.length){ rows.innerHTML = `<tr><td colspan="5">No repair records yet.</td></tr>`; return; }

  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(r.service_date)}</td>
      <td>${escapeHTML(r.vehicles?.nickname || r.vehicles?.year_make_model || "Vehicle")}</td>
      <td>${escapeHTML(r.title)}</td>
      <td><span class="badge">${escapeHTML(r.status)}</span></td>
      <td>${money(r.cost)}</td>
    `;
    rows.appendChild(tr);
  });
}

async function loadInvoices(){
  const rows = $("invoiceRows");
  rows.innerHTML = "";
  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if(error){ rows.innerHTML = `<tr><td colspan="4">${escapeHTML(error.message)}</td></tr>`; return; }
  if(!data.length){ rows.innerHTML = `<tr><td colspan="4">No invoices yet.</td></tr>`; return; }

  data.forEach(i => {
    const tr = document.createElement("tr");
    const pay = i.payment_url ? `<a class="btn btn-primary" href="${escapeHTML(i.payment_url)}">Pay</a>` : `<span class="badge">${escapeHTML(i.status)}</span>`;
    tr.innerHTML = `
      <td>${escapeHTML(i.title)}</td>
      <td>${money(i.amount)}</td>
      <td>${escapeHTML(i.status)}</td>
      <td>${pay}</td>
    `;
    rows.appendChild(tr);
  });
}

async function loadCredits(){
  const { data, error } = await supabase.from("credit_ledger").select("*").eq("status", "Active");
  if(error){ $("creditTotal").textContent = "$0"; return; }
  const total = data.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  $("creditTotal").textContent = money(total);
}

window.copyReferralBackend = async function(){
  const code = $("memberReferralCode").textContent;
  navigator.clipboard.writeText(code).then(() => msg("Referral code copied: " + code));
};

init();
