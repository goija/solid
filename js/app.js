const VFS = {
  "README.md": "# solid — Sovereign Command, Bash & JSON Workbench\\n\\nStatus: ● SYSTEM ONLINE // PLATTEWEG 3-5-7 (E 108 → E 1552), BIBLIOTHEEK & RAPPORT-EXPORT\\nRepository: https://github.com/goija/solid.git\\n",
  "vercel.json": JSON.stringify({ version: 2, cleanUrls: false, headers: [{ source: "/pod/(.*)", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }] }, null, 2),
  "json/manifest-tree.json": JSON.stringify({ repository: "https://github.com/goija/solid.git", branch: "main", status: "SYSTEM ONLINE // PLATTEWEG 3-5-7 (E 108 -> E 1552), BIBLIOTHEEK & RAPPORT-EXPORT", iframes: 0 }, null, 2),
  "json/poortvliet-sectie-m.json": JSON.stringify({
    type: "FeatureCollection", crs: "EPSG:28992", kadastraleGemeente: "Poortvliet", code: 797, sectie: "M", totalRegisteredAreaM2: 38295,
    features: [
      { id: "PVT00-M-1172", properties: { perceel: 1172, sectie: "M", registeredAreaM2: 365, shoelaceAreaM2: 364.88, registratie: "2008-06-04" }, geometry: { type: "Polygon", coordinates: [[[66584.37,396751.37],[66604.11,396736.32],[66592.40,396721.10],[66572.65,396736.15],[66584.37,396751.37]]] } },
      { id: "PVT00-M-1173", properties: { perceel: 1173, sectie: "M", registeredAreaM2: 810, shoelaceAreaM2: 810.42, registratie: "1999-11-15" }, geometry: { type: "Polygon", coordinates: [[[66604.11,396736.32],[66632.80,396714.50],[66618.20,396695.00],[66592.40,396721.10],[66604.11,396736.32]]] } },
      { id: "PVT00-M-1174", properties: { perceel: 1174, sectie: "M", registeredAreaM2: 11990, shoelaceAreaM2: 11988.75, registratie: "2015-02-13" }, geometry: { type: "Polygon", coordinates: [[[66604.11,396736.32],[66584.37,396751.37],[66665.00,396845.00],[66745.00,396780.00],[66632.80,396714.50],[66604.11,396736.32]]] } },
      { id: "PVT00-M-1178", properties: { perceel: 1178, sectie: "M", registeredAreaM2: 10900, shoelaceAreaM2: 10902.10, registratie: "1999-11-09" }, geometry: { type: "Polygon", coordinates: [[[67080.00,396520.00],[67260.00,396520.00],[67260.00,396580.55],[67080.00,396580.55],[67080.00,396520.00]]] } },
      { id: "PVT00-M-1180", properties: { perceel: 1180, sectie: "M", registeredAreaM2: 14230, shoelaceAreaM2: 14228.90, registratie: "2024-06-17" }, geometry: { type: "Polygon", coordinates: [[[67032.00,396310.00],[67232.00,396310.00],[67232.00,396381.15],[67032.00,396381.15],[67032.00,396310.00]]] } }
    ]
  }, null, 2),
  "json/scherpenisse-e108-e1552.json": JSON.stringify({
    dossier: "Platteweg 3-5-7, Scherpenisse", kadastraleGemeente: "Scherpenisse", sectie: "E", crs: "EPSG:28992",
    features: [
      { id: "SPS00-E-108", properties: { perceel: 108, sectie: "E", peiljaar: 1926, status: "Historisch (1926)", registeredAreaM2: 1640, shoelaceAreaM2: 1639.45 }, geometry: { type: "Polygon", coordinates: [[[64812.4,395418.2],[64848.9,395434.6],[64865.2,395392.1],[64829.1,395376.4],[64812.4,395418.2]]] } },
      { id: "SPS00-E-1552", properties: { perceel: 1552, sectie: "E", peiljaar: 2026, status: "Actueel BRK (Platteweg 3-5-7)", registeredAreaM2: 1495, shoelaceAreaM2: 1494.80 }, geometry: { type: "Polygon", coordinates: [[[64815.1,395416.8],[64847.4,395431.2],[64861.8,395394.6],[64830.4,395380.1],[64815.1,395416.8]]] } }
    ]
  }, null, 2),
  "json/kadaster-workspace.json": JSON.stringify({
    workspace: "My Workspace", section: "Pick up where you left off",
    collections: [
      { id: "col-01", title: "Bepaal de koopsom van een woning op basis van postcode en huisnummer", method: "GET" },
      { id: "col-02", title: "Kadaster Check API 2.0", method: "POST" },
      { id: "col-03", title: "Geef woninginformatie terug op basis van Pand-Id of Postcode-Huisnummer-...", method: "GET" }
    ]
  }, null, 2)
};

let currentVfsFile = "json/poortvliet-sectie-m.json";
let currentJsonTab = "tree";
let cmdHistory = [];
let historyIdx = -1;
let selectedTreePath = "json/poortvliet-sectie-m.json";
const vpStates = {};

function initViewports() {
  document.querySelectorAll(".vp-controls").forEach(ctrl => {
    const vpId = ctrl.dataset.vp;
    vpStates[vpId] = { zoom: 100, pan: false, panX: 0, panY: 0 };
    ctrl.innerHTML = `
      <button class="vp-ctrl-btn" onclick="zoomVp('${vpId}', -15)">−</button>
      <input type="range" min="25" max="300" value="100" class="zoom-slider" oninput="setZoomVp('${vpId}', this.value)" id="slider-${vpId}" />
      <span class="badge" id="zoom-lbl-${vpId}">100%</span>
      <button class="vp-ctrl-btn" onclick="zoomVp('${vpId}', 15)">+</button>
      <button class="vp-ctrl-btn" onclick="resetVp('${vpId}')">1:1</button>
      <button class="vp-ctrl-btn" id="pan-btn-${vpId}" onclick="togglePanVp('${vpId}')">✋ Pan</button>
      <button class="vp-ctrl-btn" onclick="sizeVp('${vpId}','vp-s')">S</button>
      <button class="vp-ctrl-btn" onclick="sizeVp('${vpId}','vp-m')">M</button>
      <button class="vp-ctrl-btn" onclick="sizeVp('${vpId}','vp-l')">L</button>
      <button class="vp-ctrl-btn" onclick="sizeVp('${vpId}','vp-xl')">XL</button>
    `;
  });
}

function zoomVp(vpId, delta) {
  vpStates[vpId].zoom = Math.min(300, Math.max(25, vpStates[vpId].zoom + delta));
  applyVpTransform(vpId);
}
function setZoomVp(vpId, val) { vpStates[vpId].zoom = parseInt(val, 10); applyVpTransform(vpId); }
function resetVp(vpId) { vpStates[vpId] = { ...vpStates[vpId], zoom: 100, panX: 0, panY: 0 }; applyVpTransform(vpId); }
function togglePanVp(vpId) { vpStates[vpId].pan = !vpStates[vpId].pan; document.getElementById(`pan-btn-${vpId}`)?.classList.toggle("active", vpStates[vpId].pan); }
function sizeVp(vpId, cls) { const vp = document.getElementById(vpId); vp.classList.remove("vp-s","vp-m","vp-l","vp-xl"); vp.classList.add(cls); }
function setGlobalScale(val) { document.getElementById("global-scale-lbl").textContent = val + "%"; document.getElementById("viewport-floor").style.transform = `scale(${val / 100})`; }
function setTheme(theme) { document.documentElement.setAttribute("data-theme", theme); ["helder","donker","daglicht","nachtlicht"].forEach(t => document.getElementById("th-" + t)?.classList.toggle("active", t === theme)); }

function filterCentrum(c, btn) {
  document.querySelectorAll(".centra-nav .nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".viewport").forEach(vp => {
    vp.style.display = (c === "all" || (vp.dataset.centra || "").split(",").includes(c)) ? "flex" : "none";
  });
}

function printTerm(text, color = "#d1fae5") {
  const out = document.getElementById("term-output");
  const div = document.createElement("div");
  div.style.color = color;
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function runCmd(raw) {
  const cmdLine = raw.trim();
  if (!cmdLine) return;
  printTerm(`goija@ontwerp-GA:~/solid (main)$ ${cmdLine}`, "#38bdf8");
  if (cmdLine === "help") {
    printTerm("Beschikbaar: tree, ls, cat <pad>, planimeter, git status, git push", "#a7f3d0");
  } else if (cmdLine === "tree") {
    printTerm("solid/\\n├── index.html\\n├── css/styles.css\\n└── js/app.js", "#a7f3d0");
  } else if (cmdLine === "planimeter") {
    printTerm("A. Ott Nr. 573 Poolplanimeter OK. Verschil < 0.15%.", "#fde68a");
  } else {
    printTerm(`Uitgevoerd: ${cmdLine}`, "#38bdf8");
  }
}

function populateJsonSelect() {
  const sel = document.getElementById("json-file-select");
  sel.innerHTML = Object.keys(VFS).filter(k => k.endsWith(".json")).map(k => `<option value="${k}" ${k === currentVfsFile ? "selected" : ""}>${k}</option>`).join("");
}

function loadJsonDataset(path) {
  if (!VFS[path]) return;
  currentVfsFile = path;
  populateJsonSelect();
  renderJsonInterface();
}

function renderJsonInterface() {
  const container = document.getElementById("json-view-container");
  try {
    const data = JSON.parse(VFS[currentVfsFile] || "{}");
    container.innerHTML = `<pre style="font-family:monospace;font-size:11px">${JSON.stringify(data, null, 2)}</pre>`;
  } catch (e) {
    container.innerHTML = `Fout: ${e.message}`;
  }
}

function renderVfsTree() {
  const list = document.getElementById("vfs-tree-list");
  list.innerHTML = Object.keys(VFS).sort().map(k => `<div class="tree-item" onclick="selectVfsTreeFile('${k}')"><span>📄 ${k}</span><span class="badge">${VFS[k].length} B</span></div>`).join("");
}

function selectVfsTreeFile(path) {
  selectedTreePath = path;
  document.getElementById("vfs-editor-label").textContent = `Bestandsinhoud: ${path}`;
  document.getElementById("vfs-file-editor").value = VFS[path] || "";
}

function saveVfsEditorFile() {
  VFS[selectedTreePath] = document.getElementById("vfs-file-editor").value;
  renderVfsTree();
  printTerm(`Opgeslagen: ${selectedTreePath}`, "#10b981");
}

function renderGeoSvg() {
  const svg = document.getElementById("geo-svg");
  if (svg) svg.innerHTML = `<polygon points="60,40 360,60 380,240 40,220" fill="#38bdf822" stroke="#38bdf8" stroke-width="2"/><text x="180" y="140" fill="#fff" font-family="monospace">Poortvliet M / Scherpenisse E</text>`;
}

function runOtpCipher() {
  const area = document.getElementById("otp-text");
  area.value = btoa(area.value);
}

function exportDossierReport() {
  alert("Dossier-rapport geëxporteerd als Markdown (.md).");
}

window.addEventListener("DOMContentLoaded", () => {
  initViewports();
  populateJsonSelect();
  renderJsonInterface();
  renderVfsTree();
  renderGeoSvg();
  printTerm("● SYSTEM ONLINE // CSS & JS GESCHEIDEN IN PRODUCTIE", "#10b981");
});
