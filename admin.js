
const adminKey = "tomsGarageAdminPhase3";

const starter = {
  members: [
    {name:"Garage Member", phone:"725-252-9073", email:"member@example.com", vehicle:"BMW 335i", credit:0, status:"Active"}
  ],
  jobs: [
    {customer:"Garage Member", vehicle:"BMW 335i", title:"Portal setup / repair history ready", status:"Open", notes:"Backend connection next."}
  ]
};

function loadAdmin(){
  const raw = localStorage.getItem(adminKey);
  if(!raw){
    localStorage.setItem(adminKey, JSON.stringify(starter));
    return starter;
  }
  try { return JSON.parse(raw); } catch(e){ return starter; }
}
function saveAdmin(data){ localStorage.setItem(adminKey, JSON.stringify(data)); }

function adminAddMember(event){
  event.preventDefault();
  const data = loadAdmin();
  data.members.push({
    name: val("adminName"),
    phone: val("adminPhone"),
    email: val("adminEmail"),
    vehicle: val("adminVehicle"),
    credit: Number(val("adminCredit") || 0),
    status: val("adminStatus")
  });
  saveAdmin(data);
  event.target.reset();
  renderAdmin();
}

function adminAddJob(event){
  event.preventDefault();
  const data = loadAdmin();
  data.jobs.push({
    customer: val("jobCustomer"),
    vehicle: val("jobVehicle"),
    title: val("jobTitle"),
    status: val("jobStatus"),
    notes: val("jobNotes")
  });
  saveAdmin(data);
  event.target.reset();
  renderAdmin();
}

function renderAdmin(){
  const data = loadAdmin();
  const openJobs = data.jobs.filter(j => j.status !== "Complete").length;
  const credits = data.members.reduce((sum, m) => sum + Number(m.credit || 0), 0);
  setText("statMembers", data.members.length);
  setText("statJobs", openJobs);
  setText("statCredits", "$" + credits.toFixed(0));

  const memberRows = document.getElementById("memberRows");
  memberRows.innerHTML = "";
  data.members.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(m.name)}</td>
      <td>${escapeHTML(m.phone)}</td>
      <td>${escapeHTML(m.email)}</td>
      <td>${escapeHTML(m.vehicle)}</td>
      <td>$${Number(m.credit || 0).toFixed(0)}</td>
      <td><span class="badge">${escapeHTML(m.status)}</span></td>
    `;
    memberRows.appendChild(tr);
  });

  const jobRows = document.getElementById("jobRows");
  jobRows.innerHTML = "";
  data.jobs.forEach(j => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(j.customer)}</td>
      <td>${escapeHTML(j.vehicle)}</td>
      <td>${escapeHTML(j.title)}</td>
      <td><span class="badge">${escapeHTML(j.status)}</span></td>
      <td>${escapeHTML(j.notes)}</td>
    `;
    jobRows.appendChild(tr);
  });
}

function val(id){ return document.getElementById(id).value.trim(); }
function setText(id, value){ const el = document.getElementById(id); if(el) el.textContent = value; }
function escapeHTML(str){
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
document.addEventListener("DOMContentLoaded", renderAdmin);
