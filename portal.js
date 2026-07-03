
const storeKey = "tomsGarageMemberPortal";

const starter = {
  credits: 0,
  balance: "0.00",
  vehicles: [
    {
      name: "Example 335i",
      info: "2011 BMW 335i",
      mileage: "Mileage TBD",
      mods: "Performance build / diagnostics"
    }
  ],
  history: [
    {
      date: "Coming Soon",
      vehicle: "Example 335i",
      work: "Repair history will appear here after admin backend setup.",
      status: "Portal Ready"
    }
  ]
};

function loadData(){
  const raw = localStorage.getItem(storeKey);
  if(!raw){
    localStorage.setItem(storeKey, JSON.stringify(starter));
    return starter;
  }
  try { return JSON.parse(raw); } catch(e){ return starter; }
}

function saveData(data){
  localStorage.setItem(storeKey, JSON.stringify(data));
}

function showTab(id, btn){
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(btn) btn.classList.add("active");
}

function render(){
  const data = loadData();
  const creditText = "$" + Number(data.credits || 0).toFixed(0);
  const c1 = document.getElementById("creditTotal");
  const c2 = document.getElementById("creditTotal2");
  if(c1) c1.textContent = creditText;
  if(c2) c2.textContent = creditText;
  const bal = document.getElementById("openBalance");
  if(bal) bal.textContent = "$" + (data.balance || "0.00");

  const list = document.getElementById("vehicleList");
  if(list){
    list.innerHTML = "";
    data.vehicles.forEach((v, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <small>Garage Vehicle ${idx + 1}</small>
        <h3>${escapeHTML(v.name)}</h3>
        <p><b>${escapeHTML(v.info)}</b></p>
        <p>${escapeHTML(v.mileage || "Mileage not listed")}</p>
        <p>${escapeHTML(v.mods || "No notes yet")}</p>
        <button class="btn btn-danger" onclick="deleteVehicle(${idx})">Remove</button>
      `;
      list.appendChild(card);
    });
  }

  const rows = document.getElementById("historyRows");
  if(rows){
    rows.innerHTML = "";
    data.history.forEach(h => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(h.date)}</td>
        <td>${escapeHTML(h.vehicle)}</td>
        <td>${escapeHTML(h.work)}</td>
        <td><span class="badge">${escapeHTML(h.status)}</span></td>
      `;
      rows.appendChild(tr);
    });
  }
}

function addVehicle(event){
  event.preventDefault();
  const data = loadData();
  data.vehicles.push({
    name: document.getElementById("vehicleName").value,
    info: document.getElementById("vehicleInfo").value,
    mileage: document.getElementById("vehicleMileage").value,
    mods: document.getElementById("vehicleMods").value
  });
  saveData(data);
  event.target.reset();
  render();
}

function deleteVehicle(index){
  const data = loadData();
  data.vehicles.splice(index, 1);
  saveData(data);
  render();
}

function copyReferral(){
  const code = document.getElementById("refCode").textContent;
  navigator.clipboard.writeText(code).then(() => alert("Referral code copied: " + code)).catch(() => alert(code));
}

function escapeHTML(str){
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

document.addEventListener("DOMContentLoaded", render);
