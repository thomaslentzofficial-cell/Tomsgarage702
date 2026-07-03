
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const configured = SUPABASE_URL && SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);

function escapeHTML(str){
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
function money(n){ return "$" + Number(n || 0).toFixed(2); }
function show(el, yes=true){ if(el) el.style.display = yes ? "" : "none"; }
function msg(text){ const m = $("adminMessage"); if(m) m.textContent = text || ""; }
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
  show($("adminAuth"), !session);
  show($("adminApp"), false);
  if(!session) return;

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
  if(error){ msg("Profile not ready yet or email confirmation required."); return; }

  if(!["owner","admin","tech"].includes(profile.role)){
    msg("Signed in, but this account does not have admin access yet. Set tomsgarage702@gmail.com to owner using the SQL command in the setup guide.");
    return;
  }

  $("adminName").textContent = profile.full_name || profile.email || "Admin";
  $("adminRole").textContent = profile.role;
  show($("adminApp"), true);
  msg("");
  await loadAdminData();
}

window.adminSignIn = async function(event){
  event.preventDefault();
  if(!requireConfig()) return;
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  msg(error ? error.message : "");
};

window.adminSignOut = async function(){
  if(!requireConfig()) return;
  await supabase.auth.signOut();
};

async function loadAdminData(){
  await Promise.all([loadProfiles(), loadJobs(), loadInvoices(), loadCredits()]);
}

async function loadProfiles(){
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending:false });
  const rows = $("memberRows");
  rows.innerHTML = "";
  if(error){ rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }

  $("statMembers").textContent = data.length;
  data.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(p.full_name || "")}</td>
      <td>${escapeHTML(p.phone || "")}</td>
      <td>${escapeHTML(p.email || "")}</td>
      <td>${escapeHTML(p.referral_code || "")}</td>
      <td><span class="badge">${escapeHTML(p.role)}</span></td>
      <td><button class="btn" onclick="promoteOwner('${p.id}')">Make Owner</button></td>
    `;
    rows.appendChild(tr);
  });

  const selects = document.querySelectorAll(".customer-select");
  selects.forEach(sel => {
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

window.promoteOwner = async function(id){
  if(!confirm("Make this account owner?")) return;
  const { error } = await supabase.from("profiles").update({ role:"owner" }).eq("id", id);
  if(error){ msg(error.message); return; }
  await loadProfiles();
};

async function loadJobs(){
  const { data, error } = await supabase
    .from("repair_records")
    .select("*, profiles(full_name,email), vehicles(year_make_model,nickname)")
    .order("service_date", { ascending:false });
  const rows = $("jobRows");
  rows.innerHTML = "";
  if(error){ rows.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`; return; }

  const openJobs = data.filter(j => j.status !== "Complete").length;
  $("statJobs").textContent = openJobs;
  data.forEach(j => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(j.profiles?.full_name || j.profiles?.email || "Customer")}</td>
      <td>${escapeHTML(j.vehicles?.nickname || j.vehicles?.year_make_model || "Vehicle")}</td>
      <td>${escapeHTML(j.title)}</td>
      <td><span class="badge">${escapeHTML(j.status)}</span></td>
      <td>${money(j.cost)}</td>
      <td>${escapeHTML(j.notes || "")}</td>
    `;
    rows.appendChild(tr);
  });
}

async function loadInvoices(){
  const { data, error } = await supabase
    .from("invoices")
    .select("*, profiles(full_name,email)")
    .order("created_at", { ascending:false });
  const rows = $("invoiceRows");
  rows.innerHTML = "";
  if(error){ rows.innerHTML = `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`; return; }
  data.forEach(i => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(i.profiles?.full_name || i.profiles?.email || "Customer")}</td>
      <td>${escapeHTML(i.title)}</td>
      <td>${money(i.amount)}</td>
      <td><span class="badge">${escapeHTML(i.status)}</span></td>
      <td>${escapeHTML(i.payment_url || "")}</td>
    `;
    rows.appendChild(tr);
  });
}

async function loadCredits(){
  const { data, error } = await supabase.from("credit_ledger").select("amount,status");
  if(error){ $("statCredits").textContent = "$0"; return; }
  const active = data.filter(c => c.status === "Active").reduce((sum,c)=>sum+Number(c.amount||0),0);
  $("statCredits").textContent = money(active);
}

window.adminAddJobBackend = async function(event){
  event.preventDefault();
  const owner_id = $("jobCustomer").value;
  const payload = {
    owner_id,
    title: $("jobTitle").value.trim(),
    status: $("jobStatus").value,
    notes: $("jobNotes").value.trim(),
    cost: Number($("jobCost").value || 0),
    service_date: $("jobDate").value || new Date().toISOString().slice(0,10)
  };
  const { error } = await supabase.from("repair_records").insert(payload);
  if(error){ msg(error.message); return; }
  event.target.reset();
  msg("Repair record added.");
  await loadJobs();
};

window.adminAddInvoiceBackend = async function(event){
  event.preventDefault();
  const payload = {
    owner_id: $("invoiceCustomer").value,
    title: $("invoiceTitle").value.trim(),
    amount: Number($("invoiceAmount").value || 0),
    status: $("invoiceStatus").value,
    payment_url: $("invoicePaymentUrl").value.trim()
  };
  const { error } = await supabase.from("invoices").insert(payload);
  if(error){ msg(error.message); return; }
  event.target.reset();
  msg("Invoice added.");
  await loadInvoices();
};

window.adminAddCreditBackend = async function(event){
  event.preventDefault();
  const payload = {
    owner_id: $("creditCustomer").value,
    amount: Number($("creditAmount").value || 0),
    reason: $("creditReason").value.trim(),
    source: "admin",
    status: "Active"
  };
  const { error } = await supabase.from("credit_ledger").insert(payload);
  if(error){ msg(error.message); return; }
  event.target.reset();
  msg("Credit added.");
  await loadCredits();
};

init();
