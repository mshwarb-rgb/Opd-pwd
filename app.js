// OPD v6.1.1 – two diagnoses, disposition last, one-line disposition
const APP_VERSION = "6.1.1";
const KEY = "opdVisitsV6";

const Genders = ["Male", "Female"];
const AgeLabels = {Under5:"<5", FiveToFourteen:"5-14", FifteenToSeventeen:"15-17", EighteenPlus:"≥18"};
const AgeKeys = Object.keys(AgeLabels);
const WWOpts = ["WW", "NonWW"];
const Dispositions = ["Discharged","Admitted","Ref to ED","Ref Out"];
const Diagnoses = [
  [1, "Respiratory Tract Infection", "Medical"],
  [2, "Acute Watery Diarrhea", "Medical"],
  [3, "Acute Bloody Diarrhea", "Medical"],
  [4, "Acute Viral Hepatitis", "Medical"],
  [5, "Other GI Diseases", "Medical"],
  [6, "Scabies", "Medical"],
  [7, "Skin Infection", "Medical"],
  [8, "Other Skin Diseases", "Medical"],
  [9, "Genitourinary Diseases", "Medical"],
  [10, "Musculoskeletal Diseases", "Medical"],
  [11, "Hypertension", "Medical"],
  [12, "Diabetes", "Medical"],
  [13, "Epilepsy", "Medical"],
  [14, "Eye Diseases", "Medical"],
  [15, "ENT Diseases", "Medical"],
  [16, "Other Medical Diseases", "Medical"],
  [17, "Fracture", "Surgical"],
  [18, "Burn", "Surgical"],
  [19, "Gunshot Wound (GSW)", "Surgical"],
  [20, "Other Wound", "Surgical"],
  [21, "Other Surgical", "Surgical"],
];
const DiagByNo = Object.fromEntries(Diagnoses.map(([n, name, cat]) => [n, {name, cat}]));

function loadAll(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(e){ return []; } }
function saveAll(list){ localStorage.setItem(KEY, JSON.stringify(list)); }
function sortedAll(){ return loadAll().slice().sort((a,b)=>b.timestamp-a.timestamp); }

// Selections
let selPID=""; let selGender=null; let selAge=null; 
let selDiags=[];  // up to two numbers
let selWW=null; let selDisp=null;
let editUid=null; let browseIndex=-1;

// DOM
let pidDisplay, pidStatus, err; let scrNew, scrSum, scrData;

window.initOPD = function initOPD(){
  document.getElementById("version").textContent = "v" + APP_VERSION;
  pidDisplay = document.getElementById("pid-display");
  pidStatus = document.getElementById("pid-status");
  err = document.getElementById("error");
  scrNew = document.getElementById("screen-new");
  scrSum = document.getElementById("screen-summary");
  scrData = document.getElementById("screen-data");

  document.getElementById("nav-new").onclick = () => showScreen("new");
  document.getElementById("nav-summary").onclick = () => { showScreen("summary"); renderSummary(); };
  document.getElementById("nav-data").onclick = () => { showScreen("data"); renderTable(); };

  document.querySelectorAll(".k").forEach(btn => btn.onclick = onKeypad);
  document.getElementById("prev-patient").onclick = () => browseMove(1);
  document.getElementById("next-patient").onclick = () => browseMove(-1);
  document.getElementById("duplicate-last").onclick = duplicateLast;

  document.getElementById("save-new").onclick = () => onSave(true);
  document.getElementById("save-dup").onclick = () => onSave(false);
  document.getElementById("update").onclick = onUpdate;
  document.getElementById("cancel-edit").onclick = cancelEdit;
  document.getElementById("reset").onclick = resetForm;

  document.getElementById("export-csv").onclick = () => downloadCSV(sortedAll());
  document.getElementById("export-xls").onclick = () => downloadXLS(sortedAll());
  document.getElementById("backup-json").onclick = () => downloadJSON(sortedAll());
  document.getElementById("restore-btn").onclick = () => document.getElementById("restore-json").click();
  document.getElementById("restore-json").onchange = restoreJSON;
  document.getElementById("clear-all").onclick = clearAll;

  buildSelectors();
  updatePID();
  showScreen("new");
};

function showScreen(name){
  scrNew.style.display = (name==="new")?"":"none";
  scrSum.style.display = (name==="summary")?"":"none";
  scrData.style.display = (name==="data")?"":"none";
}

function buildSelectors(){
  // Gender, Age
  makeChips(document.getElementById("gender-chips"), Genders, i => { selGender=i; buildSelectors(); }, selGender);
  makeChips(document.getElementById("age-chips"), Object.values(AgeLabels), i => { selAge=i; buildSelectors(); }, selAge);

  // Diagnoses (multi-select up to 2)
  makeDiagTiles(document.getElementById("diagnosis-grid"), Diagnoses, selDiags);
  const diagCount = document.getElementById("diag-count");
  if (diagCount) diagCount.textContent = selDiags.length ? `${selDiags.length}/2 selected` : "";

  // WW visible if any selected is Surgical
  const anySurg = selDiags.some(no => DiagByNo[no]?.cat === "Surgical");
  const wwSec = document.getElementById("ww-section");
  if (anySurg) {
    wwSec.style.display = "";
    makeChips(document.getElementById("ww-chips"), WWOpts, i => { selWW=i; buildSelectors(); }, selWW);
  } else {
    wwSec.style.display = "none"; selWW=null;
    const ww = document.getElementById("ww-chips"); if (ww) ww.innerHTML="";
  }

  // Disposition (one line)
  makeChips(document.getElementById("disp-chips"), Dispositions, i => { selDisp=i; buildSelectors(); }, selDisp);
}

function makeChips(container, options, onSelect, current){
  container.innerHTML = "";
  options.forEach((label, idx) => {
    const div = document.createElement("div");
    div.className = "chip" + (current===idx ? " selected": "");
    div.textContent = label;
    div.onclick = () => onSelect(idx);
    container.appendChild(div);
  });
}

function makeDiagTiles(container, items, selectedNos){
  container.innerHTML = "";
  items.forEach(([no, name, cat]) => {
    const div = document.createElement("div");
    const isSel = selectedNos.includes(no);
    div.className = "tile" + (isSel ? " selected":"");
    div.innerHTML = `<div>${no}. ${name}</div><div class="small">${cat}</div>`;
    div.onclick = () => toggleDiag(no);
    container.appendChild(div);
  });
}

function toggleDiag(no){
  const idx = selDiags.indexOf(no);
  if (idx >= 0) {
    selDiags.splice(idx,1);
  } else {
    if (selDiags.length < 2) selDiags.push(no);
    else { selDiags.shift(); selDiags.push(no); } // replace oldest
  }
  buildSelectors();
}

function onKeypad(e){
  const k = e.currentTarget.dataset.k;
  if (k === "C") selPID = "";
  else if (k === "B") selPID = selPID.slice(0, -1);
  else if (/^\d$/.test(k)) { if (selPID.length < 3) selPID += k; }
  updatePID();
}
function updatePID(){
  pidDisplay.textContent = selPID ? selPID : "---";
  pidStatus.textContent = "";
}

function validateSelection(requirePID=true){
  err.style.color = "#d93025"; err.textContent = "";
  if (requirePID && (!selPID || selPID.length === 0)) { err.textContent = "Enter Patient ID (max 3 digits)."; return false; }
  if (selGender===null || selAge===null || !selDiags.length || selDisp===null) { err.textContent="Select Gender, Age, ≥1 Diagnosis (max 2), and Disposition."; return false; }
  const anySurg = selDiags.some(no => DiagByNo[no]?.cat === "Surgical");
  if (anySurg && selWW===null) { err.textContent="Select WW or Non-WW for surgical diagnosis."; return false; }
  return true;
}

function newUid(){ return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,7); }
function buildVisit(uidOverride=null, tsOverride=null){
  const diags = selDiags.slice(0,2);
  const names = diags.map(no => DiagByNo[no]?.name || "");
  const cats  = diags.map(no => DiagByNo[no]?.cat || "");
  const anySurg = cats.includes("Surgical");
  return {
    uid: uidOverride || newUid(),
    timestamp: tsOverride || Date.now(),
    patientId: selPID,
    gender: Genders[selGender],
    ageGroup: AgeKeys[selAge],
    ageLabel: AgeLabels[AgeKeys[selAge]],
    diagnosisNos: diags,                // array for internal use
    diagnosisNames: names,              // array for internal use
    diagnosisNoStr: diags.join("+"),    // combined for table/export
    diagnosisNameStr: names.join(" + "),
    clinicalCategory: anySurg ? "Surgical" : "Medical",
    wwFlag: anySurg ? (WWOpts[selWW] || "NA") : "NA",
    disposition: Dispositions[selDisp]
  };
}

function onSave(clearSelections){
  if (!validateSelection(true)) return;
  const all = loadAll();
  all.push(buildVisit());
  saveAll(all);
  tinyToast(clearSelections ? "Saved. New entry ready." : "Saved. Duplicated selections.", true);
  if (clearSelections) cancelEdit(); else { selPID=""; updatePID(); }
}
function onUpdate(){
  if (!validateSelection(false)) return;
  if (!editUid) return tinyToast("Not in edit mode.", false);
  const all = loadAll();
  const idx = all.findIndex(v => v.uid === editUid);
  if (idx === -1) return tinyToast("Record not found.", false);
  all[idx] = buildVisit(editUid, all[idx].timestamp);
  saveAll(all);
  tinyToast("Updated.", true);
  cancelEdit();
}

function enterEdit(record){
  editUid = record.uid;
  selPID = record.patientId || "";
  selGender = Genders.indexOf(record.gender);
  selAge = AgeKeys.indexOf(record.ageGroup);
  // Back-compat: if older record had single diagnosisNo, normalize
  if (record.diagnosisNos && Array.isArray(record.diagnosisNos)) selDiags = record.diagnosisNos.slice(0,2);
  else if (record.diagnosisNo) selDiags = [record.diagnosisNo];
  else if (record.diagnosisNoStr) selDiags = record.diagnosisNoStr.split("+").map(n=>parseInt(n,10)).filter(Boolean).slice(0,2);
  else selDiags = [];
  const anySurg = selDiags.some(no => DiagByNo[no]?.cat === "Surgical");
  selWW = anySurg ? (record.wwFlag==="WW" ? 0 : record.wwFlag==="NonWW" ? 1 : null) : null;
  selDisp = Dispositions.indexOf(record.disposition);
  updatePID(); buildSelectors();
  document.getElementById("save-new").style.display = "none";
  document.getElementById("save-dup").style.display = "none";
  document.getElementById("update").style.display = "";
  document.getElementById("cancel-edit").style.display = "";
  showScreen("new");
}
function cancelEdit(){
  editUid = null;
  selPID=""; selGender=null; selAge=null; selDiags=[]; selWW=null; selDisp=null;
  updatePID(); buildSelectors();
  document.getElementById("save-new").style.display = "";
  document.getElementById("save-dup").style.display = "";
  document.getElementById("update").style.display = "none";
  document.getElementById("cancel-edit").style.display = "none";
}
function resetForm(){ cancelEdit(); }

function browseMove(delta){
  const list = sortedAll();
  if (!list.length) return tinyToast("No records.", false);
  if (browseIndex < 0) browseIndex = 0;
  browseIndex = Math.min(Math.max(browseIndex + delta, 0), list.length - 1);
  enterEdit(list[browseIndex]);
}
function duplicateLast(){
  const list = sortedAll();
  if (!list.length) return tinyToast("No previous records.", false);
  const last = list[0];
  selGender = Genders.indexOf(last.gender);
  selAge = AgeKeys.indexOf(last.ageGroup);
  if (last.diagnosisNos) selDiags = last.diagnosisNos.slice(0,2);
  else if (last.diagnosisNoStr) selDiags = last.diagnosisNoStr.split("+").map(n=>parseInt(n,10)).filter(Boolean).slice(0,2);
  else if (typeof last.diagnosisNo === "number") selDiags = [last.diagnosisNo];
  else selDiags = [];
  selWW = (last.clinicalCategory==="Surgical") ? (last.wwFlag==="WW" ? 0 : last.wwFlag==="NonWW" ? 1 : null) : null;
  selDisp = Dispositions.indexOf(last.disposition);
  buildSelectors();
  tinyToast("Selections duplicated. Enter a new Patient ID.", true);
}

/* ---------- Summary ---------- */
function renderSummary(){
  const all = loadAll();
  const today = new Date(); today.setHours(0,0,0,0);
  const start = +today, end = start + 86400000 - 1;
  const list = all.filter(v => v.timestamp >= start && v.timestamp <= end);

  const total = list.length;
  const male = list.filter(v => v.gender==="Male").length;
  const female = list.filter(v => v.gender==="Female").length;
  const a0 = list.filter(v => v.ageGroup==="Under5").length;
  const a1 = list.filter(v => v.ageGroup==="FiveToFourteen").length;
  const a2 = list.filter(v => v.ageGroup==="FifteenToSeventeen").length;
  const a3 = list.filter(v => v.ageGroup==="EighteenPlus").length;
  const ww = list.filter(v => v.clinicalCategory==="Surgical" && v.wwFlag==="WW").length;
  const non = list.filter(v => v.clinicalCategory==="Surgical" && v.wwFlag==="NonWW").length;

  document.getElementById("k-total").textContent = total;
  document.getElementById("k-male").textContent = male;
  document.getElementById("k-female").textContent = female;
  document.getElementById("k-ww").textContent = `${ww}/${non}`;
  document.getElementById("age-breakdown").textContent = `<5 ${a0}, 5–14 ${a1}, 15–17 ${a2}, ≥18 ${a3}`;

  // Age × Gender table
  const ag = {Under5:{Male:0,Female:0}, FiveToFourteen:{Male:0,Female:0}, FifteenToSeventeen:{Male:0,Female:0}, EighteenPlus:{Male:0,Female:0}};
  list.forEach(v => { ag[v.ageGroup][v.gender]++; });
  const tbody = document.querySelector("#age-gender-table tbody");
  tbody.innerHTML="";
  [["<5","Under5"],["5-14","FiveToFourteen"],["15-17","FifteenToSeventeen"],["≥18","EighteenPlus"]].forEach(([label,key])=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td>${ag[key].Male}</td><td>${ag[key].Female}</td>`;
    tbody.appendChild(tr);
  });

  // Top diagnoses (count first diagnosis entry)
  const counts = {};
  list.forEach(v => {
    const firstName = (v.diagnosisNames && v.diagnosisNames[0]) || v.diagnosisName || "";
    if (!firstName) return;
    counts[firstName] = (counts[firstName]||0) + 1;
  });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const cont = document.getElementById("top-diags"); cont.innerHTML="";
  top.forEach(([name,c]) => { const div=document.createElement("div"); div.textContent=`${name}: ${c}`; cont.appendChild(div); });
}

/* ---------- Table & export ---------- */
function renderTable(){
  const all = sortedAll();
  const tbody = document.querySelector("#data-table tbody");
  tbody.innerHTML = "";
  const fmt = (t)=> new Date(t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  all.forEach(v => {
    const tr = document.createElement("tr");
    const nos = v.diagnosisNoStr || (Array.isArray(v.diagnosisNos)? v.diagnosisNos.join("+") : (v.diagnosisNo ?? ""));
    const names = v.diagnosisNameStr || (Array.isArray(v.diagnosisNames)? v.diagnosisNames.join(" + ") : (v.diagnosisName ?? ""));
    tr.innerHTML = `<td>${fmt(v.timestamp)}</td>
      <td>${v.patientId || ""}</td>
      <td>${v.gender}</td>
      <td>${v.ageLabel || ""}</td>
      <td>${nos}</td>
      <td>${names}</td>
      <td>${(v.clinicalCategory||"")[0] || ""}</td>
      <td>${v.wwFlag || "NA"}</td>
      <td>${v.disposition || ""}</td>
      <td><button class="btn secondary" data-uid="${v.uid}" style="padding:6px 8px;">Edit</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button[data-uid]").forEach(btn => {
    btn.onclick = () => {
      const uid = btn.getAttribute("data-uid");
      const all = sortedAll();
      const rec = all.find(r => r.uid === uid);
      const idx = all.findIndex(r => r.uid === uid);
      if (rec) { browseIndex = idx; enterEdit(rec); }
    };
  });
}

function downloadCSV(list){
  const header = ["timestamp","patient_id","gender","age_group","diagnosis_nos","diagnosis_names","clinical_category","ww_flag","disposition"];
  const rows = [header].concat(list.map(v => [
    v.timestamp, v.patientId || "", v.gender, v.ageLabel || "", 
    v.diagnosisNoStr || (Array.isArray(v.diagnosisNos)? v.diagnosisNos.join("+") : (v.diagnosisNo ?? "")),
    v.diagnosisNameStr || (Array.isArray(v.diagnosisNames)? v.diagnosisNames.join(" + ") : (v.diagnosisName ?? "")),
    v.clinicalCategory || "", v.wwFlag || "NA", v.disposition || ""
  ]));
  const csv = rows.map(r => r.map(x => (""+x).replace(/,/g,";")).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  const d = new Date(); const pad=(n)=>(""+n).padStart(2,"0");
  a.download = `OPD_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

function downloadXLS(list){
  const header = ["timestamp","patient_id","gender","age_group","diagnosis_nos","diagnosis_names","clinical_category","ww_flag","disposition"];
  const rows = list.map(v => [
    v.timestamp, v.patientId || "", v.gender, v.ageLabel || "",
    v.diagnosisNoStr || (Array.isArray(v.diagnosisNos)? v.diagnosisNos.join("+") : (v.diagnosisNo ?? "")),
    v.diagnosisNameStr || (Array.isArray(v.diagnosisNames)? v.diagnosisNames.join(" + ") : (v.diagnosisName ?? "")),
    v.clinicalCategory || "", v.wwFlag || "NA", v.disposition || ""
  ]);
  let html = '<table><tr>' + header.map(h=>`<th>${h}</th>`).join('') + '</tr>';
  rows.forEach(r => { html += '<tr>' + r.map(x=>`<td>${String(x).replace(/[<&>]/g,s=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[s]))}</td>`).join('') + '</tr>'; });
  html += '</table>';
  const blob = new Blob([html], {type:"application/vnd.ms-excel"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  const d = new Date(); const pad=(n)=>(""+n).padStart(2,"0");
  a.download = `OPD_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.xls`;
  a.click(); URL.revokeObjectURL(a.href);
}

function downloadJSON(list){
  const blob = new Blob([JSON.stringify(list)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "OPD_backup.json"; a.click(); URL.revokeObjectURL(a.href);
}
function restoreJSON(e){
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Invalid file");
      const byUid = {}; sortedAll().forEach(x => byUid[x.uid] = x);
      data.forEach(x => { byUid[x.uid || (Date.now()+"-"+Math.random())] = x; });
      const merged = Object.values(byUid).sort((a,b)=>a.timestamp-b.timestamp);
      saveAll(merged); renderTable();
      tinyToast("Data restored/merged.", true);
    } catch(err) { tinyToast("Restore failed: " + err.message, false); }
  };
  reader.readAsText(file);
}
function clearAll(){
  if (!confirm("Clear ALL saved visits from this device?")) return;
  saveAll([]); renderTable(); tinyToast("Cleared.", true);
}

function tinyToast(msg, ok){
  err.style.color = ok ? "#107c41" : "#d93025";
  err.textContent = msg;
  setTimeout(()=>{ err.textContent=""; err.style.color="#d93025"; }, 1400);
    }
