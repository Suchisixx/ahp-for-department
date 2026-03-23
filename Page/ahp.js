// ═══════════════════════════════════════════════════════════════
// ahp.js — Logic phân tích AHP cho ApartmentBroker DSS
// Kết nối backend FastAPI: http://localhost:8000
// ═══════════════════════════════════════════════════════════════

const API = "http://localhost:8000";

// ── Tiêu chí AHP ────────────────────────────────────────────────
const CRIT = [
  { id: "C1", name: "Tài chính", color: "#2563eb" },
  { id: "C2", name: "Nội thất", color: "#16a34a" },
  { id: "C3", name: "Chủ đầu tư", color: "#9333ea" },
  { id: "C4", name: "Pháp lý", color: "#c8922a" },
  { id: "C5", name: "Hạ tầng xã hội", color: "#0891b2" },
  { id: "C6", name: "Tiện ích nội khu", color: "#dc2626" },
  { id: "C7", name: "Ngoại thất", color: "#7c3aed" },
  { id: "C8", name: "Phong thủy", color: "#d97706" },
];
const N = 8;
const RI = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

// ── Expert weights (CR = 1.1%) ───────────────────────────────────
const EW = [0.2295, 0.2295, 0.135, 0.0826, 0.0751, 0.0751, 0.1292, 0.0439];
const EM = [
  [1, 1, 2, 3, 3, 3, 2, 5],
  [1, 1, 2, 3, 3, 3, 2, 5],
  [0.5, 0.5, 1, 2, 2, 2, 1, 4],
  [1 / 3, 1 / 3, 0.5, 1, 1, 1, 0.5, 3],
  [1 / 3, 1 / 3, 0.5, 1, 1, 1, 0.5, 3],
  [1 / 3, 1 / 3, 0.5, 1, 1, 1, 0.5, 3],
  [0.5, 0.5, 1, 2, 2, 2, 1, 3],
  [0.2, 0.2, 0.25, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1],
];

// ── Preset matrices ──────────────────────────────────────────────
const PS = {
  balanced: Array.from({ length: 8 }, () => Array(8).fill(1)),
  price: [
    [1, 3, 5, 3, 3, 3, 2, 5],
    [1 / 3, 1, 2, 1, 1, 1, 1, 2],
    [1 / 5, 0.5, 1, 1, 1, 1, 1, 1],
    [1 / 3, 1, 1, 1, 1, 1, 1, 2],
    [1 / 3, 1, 1, 1, 1, 1, 1, 2],
    [1 / 3, 1, 1, 1, 1, 1, 1, 2],
    [0.5, 1, 1, 1, 1, 1, 1, 2],
    [0.2, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 1],
  ],
  quality: [
    [1, 0.5, 2, 2, 2, 2, 1, 3],
    [2, 1, 3, 3, 3, 3, 2, 5],
    [0.5, 1 / 3, 1, 1, 1, 1, 0.5, 2],
    [0.5, 1 / 3, 1, 1, 1, 1, 0.5, 2],
    [0.5, 1 / 3, 1, 1, 1, 1, 0.5, 2],
    [0.5, 1 / 3, 1, 1, 1, 1, 0.5, 2],
    [1, 0.5, 2, 2, 2, 2, 1, 3],
    [1 / 3, 0.2, 0.5, 0.5, 0.5, 0.5, 1 / 3, 1],
  ],
  legal: [
    [1, 1, 2, 1 / 3, 2, 2, 2, 3],
    [1, 1, 2, 1 / 3, 2, 2, 2, 3],
    [0.5, 0.5, 1, 0.2, 1, 1, 1, 2],
    [3, 3, 5, 1, 5, 5, 4, 7],
    [0.5, 0.5, 1, 0.2, 1, 1, 1, 2],
    [0.5, 0.5, 1, 0.2, 1, 1, 1, 2],
    [0.5, 0.5, 1, 0.25, 1, 1, 1, 2],
    [1 / 3, 1 / 3, 0.5, 1 / 7, 0.5, 0.5, 0.5, 1],
  ],
  location: [
    [1, 1, 1, 1, 2, 2, 1, 3],
    [1, 1, 1, 1, 2, 2, 1, 3],
    [1, 1, 1, 1, 2, 2, 1, 3],
    [1, 1, 1, 1, 2, 2, 1, 3],
    [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 2],
    [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 2],
    [1, 1, 1, 1, 2, 2, 1, 3],
    [1 / 3, 1 / 3, 1 / 3, 1 / 3, 0.5, 0.5, 1 / 3, 1],
  ],
};

// ── State ────────────────────────────────────────────────────────
let curMode = "expert";
let curMat = Array.from({ length: N }, () => Array(N).fill(1));
let lastRes = null;
let chW = null;
let chTop10 = null;
let lastFocusedTrigger = null;
let activeCriterionMatrixId = null;
const PAIRWISE_EPS = 0.001;

// ════════════════════════════════════════════════════════════════
// KHỞI ĐỘNG
// ════════════════════════════════════════════════════════════════
// Đây là hàm gọi khi trang load xong. Nó chuẩn bị giao diện và kiểm tra
// xem backend (FastAPI) đã chạy chưa.
async function init() {
  // Vẽ giao diện: bảng trọng số, ma trận, v.v.
  buildEW();
  buildMat();

  // Mặc định chọn preset "price" (ưu tiên giá)
  applyPreset("price");

  // Nếu URL là ahp.html?mode=custom thì kích chế độ custom, còn không thì expert.
  const m = new URLSearchParams(location.search).get("mode");
  setMode(m === "custom" ? "custom" : "expert");

  // Gọi backend để kiểm tra kết nối (và hiển thị trạng thái trên trang)
  await pingAPI();
}

// ── Kiểm tra kết nối backend ─────────────────────────────────────
// Hàm này gọi endpoint /health để kiểm tra FastAPI có đang chạy không.
async function pingAPI() {
  const dot = document.getElementById("api-dot");
  const lbl = document.getElementById("api-lbl");
  const banner = document.getElementById("api-banner");
  const retryBar = document.getElementById("retry-bar");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const r = await fetch(API + "/health", { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error("HTTP " + r.status);

    dot.className = "api-dot ok";
    if (lbl) lbl.textContent = "";
    if (banner) banner.style.display = "none";
    if (retryBar) retryBar.style.display = "none";
  } catch (err) {
    clearTimeout(timer);
    console.error("pingAPI failed:", err);
    dot.className = "api-dot";
    if (lbl) lbl.textContent = "";
    if (banner) banner.style.display = "none";
    if (retryBar) retryBar.style.display = "none";
  }
}

async function retryPing() {
  const banner = document.getElementById("api-banner");
  if (banner) banner.style.display = "none";
  await pingAPI();
}

// BUILD UI

function buildEW() {
  const sortedCrit = CRIT.map((c, i) => ({
    ...c,
    weight: EW[i],
    order: i,
  })).sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.order - b.order;
  });

  document.getElementById("ew-grid").innerHTML = sortedCrit
    .map(
      (c) => `
        <div class="ew-item">
            <div class="ew-name">${c.name}</div>
            <div class="ew-bg"><div class="ew-fill" style="width:${Math.round(c.weight * 100)}%;background:${c.color}"></div></div>
            <div class="ew-pct">${(c.weight * 100).toFixed(1)}%</div>
        </div>`,
    )
    .join("");
}

function buildMat() {
  let h = `<thead><tr><th class="rh">Tiêu chí</th>${CRIT.map((c) => `<th>${c.id}</th>`).join("")}</tr></thead><tbody>`;
  for (let i = 0; i < N; i++) {
    h += `<tr><th class="rh">${CRIT[i].id} · ${CRIT[i].name}</th>`;
    for (let j = 0; j < N; j++) {
      if (i === j) h += `<td class="diag"><input value="1" readonly></td>`;
      else if (j < i)
        h += `<td class="recip"><input id="r_${j}_${i}" readonly tabindex="-1"></td>`;
      else
        h += `<td><input id="m_${i}_${j}" type="number" min="0.11" max="9" step="1" value="1"
                          oninput="onCell(${i},${j},this.value)" onclick="this.select()"></td>`;
    }
    h += "</tr>";
  }
  document.getElementById("mat-tbl").innerHTML = h + "</tbody>";
}

// MA TRẬN + CR (preview phía client, tính chính xác ở backend)

function buildMat() {
  let h = `
    <div class="alt-matrix-table-shell criteria-input-table-shell">
      <table class="alt-matrix-table criteria-input-table">
        <thead>
          <tr>
            <th class="alt-sticky-col alt-row-head">TiÃªu chÃ­</th>
            ${CRIT.map((c) => `<th title="${escapeHtml(`${c.id} · ${c.name}`)}"><span>${c.id}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>`;

  for (let i = 0; i < N; i += 1) {
    h += `<tr><th class="alt-sticky-col alt-row-head criteria-row-head">${escapeHtml(`${CRIT[i].id} Â· ${CRIT[i].name}`)}</th>`;
    for (let j = 0; j < N; j += 1) {
      if (i === j) {
        h += `
          <td class="alt-heat-cell alt-heat-diag criteria-cell criteria-cell-diag" data-matrix-cell="${i}-${j}">
            <span class="criteria-cell-value">1</span>
          </td>`;
      } else if (j < i) {
        h += `
          <td class="alt-heat-cell criteria-cell criteria-cell-readonly ${getCriteriaMatrixHeatClass(curMat[i][j])}" data-matrix-cell="${i}-${j}">
            <input class="criteria-cell-input criteria-cell-input--readonly" id="r_${j}_${i}" value="${curMat[i][j].toFixed(3)}" readonly tabindex="-1">
          </td>`;
      } else {
        h += `
          <td class="alt-heat-cell criteria-cell criteria-cell-editable ${getCriteriaMatrixHeatClass(curMat[i][j])}" data-matrix-cell="${i}-${j}">
            <input class="criteria-cell-input" id="m_${i}_${j}" type="number" min="0.11" max="9" step="1" value="${formatCriteriaInputValue(curMat[i][j])}" oninput="onCell(${i},${j},this.value)" onclick="this.select()">
          </td>`;
      }
    }
    h += "</tr>";
  }

  h += "</tbody></table></div>";
  const matrixHost = document.getElementById("mat-tbl");
  matrixHost.innerHTML = h;
  const stickyHead = matrixHost.querySelector("thead .alt-sticky-col");
  if (stickyHead) stickyHead.textContent = "Ti\u00eau ch\u00ed";
  matrixHost.querySelectorAll("thead th:not(.alt-sticky-col)").forEach((node, index) => {
    node.title = `${CRIT[index].id} \u00b7 ${CRIT[index].name}`;
  });
  matrixHost.querySelectorAll(".criteria-row-head").forEach((node, index) => {
    node.textContent = `${CRIT[index].id} \u00b7 ${CRIT[index].name}`;
  });
  renderCriteriaMatrixState();
}

function formatCriteriaInputValue(value) {
  const numericValue = Number(value) || 1;
  if (numericValue === 1) return "1";
  if (Number.isInteger(numericValue)) return String(numericValue);
  return numericValue.toFixed(2).replace(/\.00$/, "");
}

function getCriteriaMatrixHeatClass(value) {
  const numericValue = Number(value) || 1;
  if (Math.abs(numericValue - 1) < 0.001) return "criteria-heat-neutral";
  if (numericValue >= 8) return "criteria-heat-max-up";
  if (numericValue >= 6) return "criteria-heat-strong-up";
  if (numericValue >= 4) return "criteria-heat-mid-up";
  if (numericValue >= 2) return "criteria-heat-slight-up";
  if (numericValue <= 0.125) return "criteria-heat-max-down";
  if (numericValue <= 1 / 6) return "criteria-heat-strong-down";
  if (numericValue <= 0.25) return "criteria-heat-mid-down";
  if (numericValue <= 0.5) return "criteria-heat-slight-down";
  return "criteria-heat-neutral";
}

function renderCriteriaMatrixState() {
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const cell = document.querySelector(`[data-matrix-cell="${i}-${j}"]`);
      if (!cell) continue;

      cell.classList.remove(
        "criteria-heat-neutral",
        "criteria-heat-slight-up",
        "criteria-heat-mid-up",
        "criteria-heat-strong-up",
        "criteria-heat-max-up",
        "criteria-heat-slight-down",
        "criteria-heat-mid-down",
        "criteria-heat-strong-down",
        "criteria-heat-max-down",
      );

      if (i === j) {
        cell.classList.add("alt-heat-diag");
        continue;
      }

      cell.classList.add(getCriteriaMatrixHeatClass(curMat[i][j]));
      const input = cell.querySelector("input");
      if (input && input.readOnly) {
        input.value = curMat[i][j].toFixed(3);
      }
    }
  }
}

function onCell(i, j, v) {
  let x = parseFloat(v);
  if (isNaN(x) || x <= 0) return;
  if (x > 9) x = 9;
  curMat[i][j] = x;
  curMat[j][i] = 1 / x;
  const e = document.getElementById(`m_${i}_${j}`);
  if (e) e.value = formatCriteriaInputValue(x);
  const r = document.getElementById(`r_${i}_${j}`);
  if (r) r.value = (1 / x).toFixed(3);
  previewCR();
}

function syncDOM() {
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const e = document.getElementById(`m_${i}_${j}`);
      if (e) {
        let v = parseFloat(e.value) || 1;
        if (v <= 0) v = 1;
        if (v > 9) v = 9;
        e.value = formatCriteriaInputValue(v);
        curMat[i][j] = v;
        curMat[j][i] = 1 / v;
      }
    }
}

function calcCR(mat) {
  const A = mat.map((r) => [...r]);
  const n = N;
  const cs = Array(n).fill(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cs[j] += A[i][j];
  const nm = A.map((row) => row.map((v, j) => v / cs[j]));
  const w = nm.map((row) => row.reduce((s, v) => s + v, 0) / n);
  const Aw = A.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
  const cv = Aw.map((v, i) => v / w[i]);
  const lmax = cv.reduce((s, v) => s + v, 0) / n;
  const ci = (lmax - n) / (n - 1);
  const ri = RI[n] || 1.49;
  const cr = ri > 0 ? ci / ri : 0;
  return { w, lmax, ci, cr, ok: cr < 0.1 };
}

function previewCR() {
  syncDOM();
  renderCriteriaMatrixState();
  const result = calcCR(curMat);
  showCR(result);
  renderPreviewMath(result);
}
function checkCR() {
  syncDOM();
  renderCriteriaMatrixState();
  const result = calcCR(curMat);
  showCR(result);
  renderPreviewMath(result);
}

function showCR({ w, lmax, ci, cr, ok }) {
  const box = document.getElementById("cr-box");
  const num = document.getElementById("cr-num");
  const msg = document.getElementById("cr-msg");
  const weightsHost = document.getElementById("wchips");
  const pct = (cr * 100).toFixed(2);

  num.textContent = pct + "%";
  ["ok", "bad", "warn"].forEach((c) => {
    box.classList.remove(c);
    num.classList.remove(c);
  });
  const cls = cr < 0.1 ? "ok" : cr < 0.15 ? "warn" : "bad";
  box.classList.add(cls);
  num.classList.add(cls);
  msg.textContent =
    cr < 0.1
      ? "\u2713 L\u1ef1a ch\u1ecdn h\u1ee3p l\u00fd \u2014 b\u1ea1n c\u00f3 th\u1ec3 xem k\u1ebft qu\u1ea3"
      : cr < 0.15
        ? "\u26a0 C\u00f2n h\u01a1i l\u1ec7ch nhau \u2014 n\u00ean xem l\u1ea1i"
        : "\u2715 C\u00e1c l\u1ef1a ch\u1ecdn ch\u01b0a h\u1ee3p l\u00fd \u2014 c\u1ea7n \u0111i\u1ec1u ch\u1ec9nh";

  document.getElementById("btn-custom").disabled = !ok;
  if (weightsHost) {
    weightsHost.innerHTML = w
      .map((wi, i) => {
        const criterion = CRIT[i];
        return `
          <div class="wc wc--weight">
            <div class="wc-top">
              <span class="wc-id">${criterion.id}</span>
              <span class="wc-name">${escapeHtml(criterion.name)}</span>
            </div>
            <div class="wc-val">${(wi * 100).toFixed(1)}%</div>
          </div>`;
      })
      .join("");
  }
  document.getElementById("lmax-line").innerHTML =
    `<span class="math-rich-line">
      ${latexInline(`\\lambda_{\\max} = ${lmax.toFixed(4)}`, `λmax = ${lmax.toFixed(4)}`)}
      <span class="math-divider">·</span>
      ${latexInline(`\\mathrm{CI} = ${ci.toFixed(4)}`, `CI = ${ci.toFixed(4)}`)}
    </span>`;
  renderMathInScope(document.getElementById("panel-custom"));
  document.getElementById("lmax-line").innerHTML =
    `<span class="math-rich-line">
      ${latexInline(`\\lambda_{\\max} = ${lmax.toFixed(4)}`, `λmax = ${lmax.toFixed(4)}`)}
      <span class="math-divider">·</span>
      ${latexInline(`\\mathrm{CI} = ${ci.toFixed(4)}`, `CI = ${ci.toFixed(4)}`)}
    </span>`;
  renderMathInScope(document.getElementById("panel-custom"));
  document.getElementById("lmax-line").textContent =
    `λmax = ${lmax.toFixed(4)} · CI = ${ci.toFixed(4)}`;
}

// ════════════════════════════════════════════════════════════════
// GỌI BACKEND
// ════════════════════════════════════════════════════════════════
async function callAPI(matrix, tenPhien) {
  showLoad("\u0110ang t\u00ednh k\u1ebft qu\u1ea3 ph\u00f9 h\u1ee3p...");
  showErr("");
  try {
    const res = await fetch(API + "/ahp/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ten_phien: tenPhien, matrix }),
    });
    if (!res.ok) {
      const e = await res
        .json()
        .catch(() => ({ detail: "Lỗi không xác định" }));
      throw new Error(e?.detail?.msg || e?.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    // Response: { session_id, ten_phien, cr, ci, lambda_max, cr_ok,
    //             criteria_matrix:[[...]], weights:[{id,name,weight,pct}], total_canho,
    //             ranked:[{rank, ahp_score, score_detail:{C1..C8}, canho:{...}}] }
    hideLoad();
    return data;
  } catch (e) {
    hideLoad();
    showErr("Lỗi: " + e.message);
    return null;
  }
}

async function runExpert() {
  const d = await callAPI(EM, "Chuyên gia");
  if (d) renderAll(d);
}

async function runCustom() {
  syncDOM();
  const { cr, ok } = calcCR(curMat);
  if (!ok) {
    showErr(
      "C\u00e1c l\u1ef1a ch\u1ecdn hi\u1ec7n ch\u01b0a th\u1eadt s\u1ef1 h\u1ee3p l\u00fd. H\u00e3y ch\u1ec9nh l\u1ea1i m\u1ed9t v\u00e0i \u00f4 r\u1ed3i th\u1eed l\u1ea1i.",
    );
    return;
  }
  const d = await callAPI(curMat, `Tùy chỉnh (CR=${(cr * 100).toFixed(1)}%)`);
  if (d) renderAll(d);
}

// ════════════════════════════════════════════════════════════════
// RENDER KẾT QUẢ
// ════════════════════════════════════════════════════════════════
function renderAll(data) {
  lastRes = data;

  document.getElementById("results-wrap").classList.add("show");

  // Session badge
  document.getElementById("session-info").innerHTML =
    `<div class="session-badge">
            Session <b>#${data.session_id}</b> &nbsp;·&nbsp;
            CR = <b>${(data.cr * 100).toFixed(2)}%</b> &nbsp;·&nbsp;
            <b>${data.total_canho}</b> căn hộ phân tích &nbsp;·&nbsp;
            Chế độ: <b>${data.ten_phien}</b>
        </div>`;

  const weights = data.weights.map((w) => w.weight);
  const sessionBadge = document.querySelector("#session-info .session-badge");
  if (sessionBadge) {
    sessionBadge.innerHTML = `Session <b>#${data.session_id}</b> &nbsp;·&nbsp;
      ${latexInline(`\\mathrm{CR} = ${(data.cr * 100).toFixed(2)}\\%`, `CR = ${(data.cr * 100).toFixed(2)}%`)} &nbsp;·&nbsp;
      <b>${data.total_canho}</b> căn hộ phân tích &nbsp;·&nbsp;
      Chế độ: <b>${escapeHtml(data.ten_phien)}</b>`;
  }
  const top10 = data.ranked.slice(0, 10); // ← CHỈ LẤY TOP 10
  const refer = data.ranked.slice(10, 15); // ← 5 CĂN THAM KHẢO (hạng 11-15)

  renderDecisionDossier(data, top10);
  renderTop10(top10);
  renderRefer(refer);
  renderCharts(weights, top10);
  hydrateStaticMathCopy();
  renderMathInScope(document);
  renderAltMatrix(top10); // Ma trận so sánh cặp giữa các phương án

  renderMathInScope(document);
  document
    .getElementById("results-wrap")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDecisionDossier(data, top10) {
  const section = document.getElementById("decision-dossier-section");
  const body = document.getElementById("decision-dossier-body");
  if (!section || !body || !top10?.length) {
    if (section) section.style.display = "none";
    return;
  }

  section.style.display = "";

  const weights = data.weights.map((weight) => ({
    ...weight,
    criterion: getCriterionMeta(weight.id),
  }));
  const recommendation = getRecommendationCopy(top10, weights);
  const dominantCriterion = recommendation.dominantCriterion;
  const criteriaMatrix = getCriteriaMatrixFallback(data);
  const criteriaNames = CRIT.map((criterion) => ({
    full: `${criterion.id} · ${criterion.name}`,
    short: criterion.id,
  }));
  const criteriaRankMap = {};
  [...weights]
    .sort((left, right) => right.weight - left.weight)
    .forEach((criterion, index) => {
      criteriaRankMap[criterion.id] = index + 1;
    });

  const criterionSections = buildCriterionComparisonSections(top10, weights);
  const preferredCriterionId =
    activeCriterionMatrixId && criterionSections.some((section) => section.criterionId === activeCriterionMatrixId)
      ? activeCriterionMatrixId
      : dominantCriterion.id;
  activeCriterionMatrixId = preferredCriterionId;

  const winner = top10[0];
  const winnerLabel = getComparisonNames([winner])[0]?.short || `#${winner.rank}`;
  const runnerUp = top10[1];
  const topAdvantage = recommendation.strongestAdvantage;

  const criteriaTableRows = criteriaMatrix
    .map((row, rowIndex) => {
      const criterionId = weights[rowIndex]?.id || CRIT[rowIndex]?.id;
      const rowRank = criteriaRankMap[criterionId] || rowIndex + 1;
      const rowClasses = rowRank === 1 ? "is-winner" : rowRank <= 3 ? "is-top3" : "";
      const weight = weights[rowIndex];

      return `
        <tr class="${rowClasses}">
          <th class="alt-sticky-col alt-row-head" title="${escapeHtml(criteriaNames[rowIndex].full)}">${escapeHtml(criteriaNames[rowIndex].full)}</th>
          ${row
            .map((value, colIndex) => {
              if (rowIndex === colIndex) {
                return '<td class="alt-heat-cell alt-heat-diag">1.000</td>';
              }
              return `<td class="alt-heat-cell ${getHeatClass(value)}">${value.toFixed(3)}</td>`;
            })
            .join("")}
          <td class="alt-weight-col">
            <div class="alt-weight-main">${formatPct(weight.weight)}</div>
            <div class="alt-weight-sub">${weight.weight.toFixed(4)}</div>
          </td>
          <td class="alt-rank-col">${getRankChip(rowRank)}</td>
        </tr>`;
    })
    .join("");

  const criterionTabs = criterionSections
    .map((sectionItem) => {
      const isActive = sectionItem.criterionId === preferredCriterionId;
      return `
        <button
          type="button"
          class="criterion-tab ${isActive ? "is-active" : ""}"
          id="criterion-tab-${sectionItem.criterionId}"
          aria-selected="${isActive ? "true" : "false"}"
          aria-controls="criterion-panel-${sectionItem.criterionId}"
          onclick="setCriterionMatrixTab('${sectionItem.criterionId}')">
          <span class="criterion-tab-id">${sectionItem.criterionId}</span>
          <span class="criterion-tab-name">${escapeHtml(sectionItem.criterionName)}</span>
          <span class="criterion-tab-weight">${sectionItem.pct.toFixed(1)}%</span>
        </button>`;
    })
    .join("");

  const criterionPanels = criterionSections
    .map((sectionItem) => {
      const isActive = sectionItem.criterionId === preferredCriterionId;
      const summary = getCriterionSectionSummary(sectionItem);
      const leader = sectionItem.topRankings[0];
      const runner = sectionItem.topRankings[1];

      return `
        <section
          class="criterion-panel ${isActive ? "is-active" : ""}"
          id="criterion-panel-${sectionItem.criterionId}"
          ${isActive ? "" : "hidden"}>
          <div class="criterion-panel-summary">
            <article class="criterion-summary-card">
              <span class="criterion-summary-label">Tiêu chí</span>
              <div class="criterion-summary-value">${escapeHtml(sectionItem.criterionName)}</div>
              <div class="criterion-summary-note">Đang chiếm ${sectionItem.pct.toFixed(1)}% trọng số quyết định.</div>
            </article>
            <article class="criterion-summary-card">
              <span class="criterion-summary-label">Đứng đầu tiêu chí</span>
              <div class="criterion-summary-value">${escapeHtml(leader.label.short)}</div>
              <div class="criterion-summary-note">Điểm thành phần ${leader.value.toFixed(3)}.</div>
            </article>
            <article class="criterion-summary-card">
              <span class="criterion-summary-label">Khoảng cách với #2</span>
              <div class="criterion-summary-value">${summary.ratio.toFixed(2)}x</div>
              <div class="criterion-summary-note">Chênh ${summary.gapPct.toFixed(2)}% so với ${escapeHtml(runner?.label.short || "phương án kế tiếp")}.</div>
            </article>
          </div>
          <div class="criterion-ranking-strip">
            ${sectionItem.topRankings
              .slice(0, 3)
              .map(
                (entry, index) =>
                  `<span class="criterion-ranking-chip">${index + 1}. ${escapeHtml(entry.label.short)} · ${entry.value.toFixed(3)}</span>`,
              )
              .join("")}
          </div>
          <div class="alt-matrix-table-shell">
            <table class="alt-matrix-table">
              <thead>
                <tr>
                  <th class="alt-sticky-col alt-row-head">Phương án</th>
                  ${sectionItem.names
                    .map(
                      (name) =>
                        `<th title="${escapeHtml(name.full)}"><span>${escapeHtml(name.short)}</span></th>`,
                    )
                    .join("")}
                  <th class="alt-weight-col">Ưu tiên cục bộ</th>
                  <th class="alt-rank-col">Hạng</th>
                </tr>
              </thead>
              <tbody>
                ${sectionItem.matrix
                  .map((row, rowIndex) => {
                    const rowRank = sectionItem.analysis.rankMap[rowIndex];
                    const rowClass = rowRank === 1 ? "is-winner" : rowRank <= 3 ? "is-top3" : "";
                    return `
                      <tr class="${rowClass}">
                        <th class="alt-sticky-col alt-row-head" title="${escapeHtml(sectionItem.names[rowIndex].full)}">${escapeHtml(sectionItem.names[rowIndex].short)}</th>
                        ${row
                          .map((value, colIndex) => {
                            if (rowIndex === colIndex) {
                              return '<td class="alt-heat-cell alt-heat-diag">1.000</td>';
                            }
                            return `<td class="alt-heat-cell ${getHeatClass(value)}">${value.toFixed(3)}</td>`;
                          })
                          .join("")}
                        <td class="alt-weight-col">
                          <div class="alt-weight-main">${formatPct(sectionItem.analysis.weights[rowIndex])}</div>
                          <div class="alt-weight-sub">${sectionItem.values[rowIndex].toFixed(4)}</div>
                        </td>
                        <td class="alt-rank-col">${getRankChip(rowRank)}</td>
                      </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="criterion-panel-note">
            Ma trận này được dựng từ điểm tiêu chí ${sectionItem.criterionId} của Top 10 hiện tại để giải thích xu hướng ưu tiên, không phải ma trận người dùng nhập tay.
          </div>
        </section>`;
    })
    .join("");

  body.innerHTML = `
    <div class="dossier-stack">
      <section class="dossier-summary">
        <div class="dossier-summary-grid">
          <article class="dossier-hero-card">
            <span class="dossier-card-label">Khuyến nghị hệ thống</span>
            <h3 class="dossier-hero-title">${escapeHtml(recommendation.headline)}</h3>
            <p class="dossier-hero-copy">${escapeHtml(recommendation.detail)}</p>
            <div class="dossier-hero-chips">
              <span class="dossier-chip dossier-chip--winner">Top 1: ${escapeHtml(winnerLabel)}</span>
              <span class="dossier-chip">${recommendation.gapPct.toFixed(2)}% so với #2</span>
              <span class="dossier-chip dossier-chip--${recommendation.gapPct >= 2 ? "strong" : "soft"}">${recommendation.verdictVerb}</span>
            </div>
          </article>
          <article class="dossier-mini-card">
            <span class="dossier-card-label">Tiêu chí chi phối</span>
            <div class="dossier-mini-value">${escapeHtml(dominantCriterion.name)}</div>
            <p class="dossier-mini-copy">Đang nặng nhất với ${dominantCriterion.pct.toFixed(1)}% tổng trọng số.</p>
          </article>
          <article class="dossier-mini-card">
            <span class="dossier-card-label">Lợi thế rõ nhất</span>
            <div class="dossier-mini-value">${escapeHtml(topAdvantage.name)}</div>
            <p class="dossier-mini-copy">${escapeHtml(winnerLabel)} nhỉnh hơn rõ nhất trên tiêu chí này khi so với ${escapeHtml(
              runnerUp ? getComparisonNames([runnerUp])[0].short : "nhóm còn lại",
            )}.</p>
          </article>
          <article class="dossier-mini-card">
            <span class="dossier-card-label">Độ nhất quán đầu vào</span>
            <div class="dossier-mini-value">CR ${(data.cr * 100).toFixed(2)}%</div>
            <p class="dossier-mini-copy">λmax ${Number(data.lambda_max).toFixed(4)} · ${data.cr < 0.1 ? "đủ ổn định để đọc quyết định" : "nên kiểm tra lại ma trận tiêu chí"}.</p>
          </article>
        </div>
      </section>

      <section class="dossier-section">
        <div class="dossier-section-head">
          <div>
            <div class="dossier-section-title">1. Ma trận tiêu chí đã dùng để tính trọng số</div>
            <div class="dossier-section-sub">Chính là ma trận 8x8 người dùng nhập hoặc bộ chuyên gia đã chọn.</div>
          </div>
          <div class="dossier-metrics">
            <span class="alt-foot-metric">λmax <b>${Number(data.lambda_max).toFixed(4)}</b></span>
            <span class="alt-foot-metric">CI <b>${Number(data.ci).toFixed(4)}</b></span>
            <span class="alt-foot-metric">CR <b>${(data.cr * 100).toFixed(2)}%</b></span>
          </div>
        </div>
        <div class="alt-matrix-table-shell">
          <table class="alt-matrix-table">
            <thead>
              <tr>
                <th class="alt-sticky-col alt-row-head">Tiêu chí</th>
                ${criteriaNames
                  .map((name) => `<th title="${escapeHtml(name.full)}"><span>${escapeHtml(name.short)}</span></th>`)
                  .join("")}
                <th class="alt-weight-col">Trọng số</th>
                <th class="alt-rank-col">Ưu tiên</th>
              </tr>
            </thead>
            <tbody>${criteriaTableRows}</tbody>
          </table>
        </div>
      </section>

      <section class="dossier-section">
        <div class="dossier-section-head">
          <div>
            <div class="dossier-section-title">2. Ma trận phương án theo từng tiêu chí</div>
            <div class="dossier-section-sub">Mỗi tiêu chí tạo ra một ma trận Top 10 riêng để giải thích vì sao phương án dẫn đầu ở lớp cuối cùng.</div>
          </div>
        </div>
        <div class="criterion-tabs" role="tablist" aria-label="Ma trận theo từng tiêu chí">
          ${criterionTabs}
        </div>
        <div class="criterion-panels">
          ${criterionPanels}
        </div>
      </section>
    </div>`;

  const dossierMiniCards = body.querySelectorAll(".dossier-mini-card");
  const consistencyCard = dossierMiniCards[dossierMiniCards.length - 1];
  if (consistencyCard) {
    consistencyCard.querySelector(".dossier-mini-value").innerHTML = latexInline(
      `\\mathrm{CR} = ${(data.cr * 100).toFixed(2)}\\%`,
      `CR ${(data.cr * 100).toFixed(2)}%`,
    );
    consistencyCard.querySelector(".dossier-mini-copy").innerHTML = `
      ${latexInline(`\\lambda_{\\max} = ${Number(data.lambda_max).toFixed(4)}`, `λmax ${Number(data.lambda_max).toFixed(4)}`)}
      <span class="math-divider">·</span>
      ${data.cr < 0.1 ? "đủ ổn định để đọc quyết định" : "nên kiểm tra lại ma trận tiêu chí"}.
    `;
  }

  const metrics = body.querySelector(".dossier-metrics");
  if (metrics) {
    metrics.innerHTML = `
      <span class="alt-foot-metric">${latexInline(`\\lambda_{\\max} = ${Number(data.lambda_max).toFixed(4)}`, `λmax ${Number(data.lambda_max).toFixed(4)}`)}</span>
      <span class="alt-foot-metric">${latexInline(`\\mathrm{CI} = ${Number(data.ci).toFixed(4)}`, `CI ${Number(data.ci).toFixed(4)}`)}</span>
      <span class="alt-foot-metric">${latexInline(`\\mathrm{CR} = ${(data.cr * 100).toFixed(2)}\\%`, `CR ${(data.cr * 100).toFixed(2)}%`)}</span>
    `;
  }

  renderMathInScope(body);
}

function setCriterionMatrixTab(criterionId) {
  activeCriterionMatrixId = criterionId;
  document.querySelectorAll(".criterion-tab").forEach((tab) => {
    const isActive = tab.id === `criterion-tab-${criterionId}`;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll(".criterion-panel").forEach((panel) => {
    const isActive = panel.id === `criterion-panel-${criterionId}`;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function latexInline(tex, fallbackText = tex) {
  return `<span class="math-latex" data-latex="${escapeHtml(tex)}" aria-label="${escapeHtml(fallbackText)}">${escapeHtml(fallbackText)}</span>`;
}

function renderMathInScope(scope = document) {
  if (!scope?.querySelectorAll) return;
  scope.querySelectorAll("[data-latex]").forEach((node) => {
    const tex = node.getAttribute("data-latex") || "";
    const fallbackText = node.getAttribute("aria-label") || tex;
    if (!window.katex?.render) {
      node.textContent = fallbackText;
      return;
    }
    try {
      window.katex.render(tex, node, {
        throwOnError: false,
        strict: "ignore",
        displayMode: node.getAttribute("data-latex-display") === "block",
      });
      node.classList.add("is-rendered");
    } catch (_error) {
      node.textContent = fallbackText;
    }
  });
}

function renderPreviewMath({ lmax, ci }) {
  const line = document.getElementById("lmax-line");
  if (!line) return;
  line.innerHTML = `<span class="math-rich-line">
    ${latexInline(`\\lambda_{\\max} = ${lmax.toFixed(4)}`, `λmax = ${lmax.toFixed(4)}`)}
    <span class="math-divider">·</span>
    ${latexInline(`\\mathrm{CI} = ${ci.toFixed(4)}`, `CI = ${ci.toFixed(4)}`)}
  </span>`;
  renderMathInScope(line);
}

function hydrateStaticMathCopy() {
  const altMatrixNote = document.querySelector(".alt-matrix-note");
  if (altMatrixNote) {
    altMatrixNote.innerHTML = `<b>Cách đọc nhanh:</b>
      ${latexInline(`a_{ij} = \\frac{\\mathrm{AHP}_i}{\\mathrm{AHP}_j}`, "aij = AHPi / AHPj")}.
      Giá trị gần <b>1.00</b> là tương đương, lớn hơn <b>1.05</b> là căn ở hàng nhỉnh hơn rõ,
      còn nhỏ hơn <b>0.95</b> là yếu hơn rõ. Cột <b>Trọng số PA</b> là ưu tiên cuối cùng sau chuẩn hóa;
      cột <b>Hạng</b> cho biết thứ tự của từng phương án trong Top 10.`;
    renderMathInScope(altMatrixNote);
  }
}

window.renderMathInScope = renderMathInScope;

function getApartmentProjectName(ch) {
  const projectName = ch?.du_an?.trim();
  if (!projectName || projectName.toLowerCase().includes("không thuộc")) {
    return "";
  }
  return projectName;
}

function getApartmentLocation(ch) {
  return [ch?.phuong?.trim(), getApartmentProjectName(ch)]
    .filter(Boolean)
    .join(" · ");
}

function getCriterionMeta(criterionId) {
  return CRIT.find((criterion) => criterion.id === criterionId) || {
    id: criterionId,
    name: criterionId,
  };
}

function getComparisonNames(items) {
  return items.map((item) => {
    const title = item?.canho?.title || "";
    const project = getApartmentProjectName(item?.canho);
    if (project) {
      return {
        full: `#${item.rank} ${project}`,
        short: `#${item.rank} ${project.substring(0, 18)}${project.length > 18 ? "…" : ""}`,
      };
    }

    return {
      full: `#${item.rank} ${title || "Căn hộ"}`,
      short: `#${item.rank} ${title.substring(0, 20)}${title.length > 20 ? "…" : ""}`,
    };
  });
}

function getPairwiseRatio(valueA, valueB) {
  const a = Math.max(Number(valueA) || 0, 0);
  const b = Math.max(Number(valueB) || 0, 0);
  if (a === 0 && b === 0) return 1;
  return Math.max(a, PAIRWISE_EPS) / Math.max(b, PAIRWISE_EPS);
}

function buildRatioMatrix(values) {
  return Array.from({ length: values.length }, (_, rowIndex) =>
    Array.from({ length: values.length }, (_, colIndex) =>
      getPairwiseRatio(values[rowIndex], values[colIndex]),
    ),
  );
}

function buildPriorityAnalysis(matrix) {
  const n = matrix.length;
  const colSum = Array(n).fill(0);
  for (let colIndex = 0; colIndex < n; colIndex += 1) {
    for (let rowIndex = 0; rowIndex < n; rowIndex += 1) {
      colSum[colIndex] += matrix[rowIndex][colIndex];
    }
  }

  const normalized = matrix.map((row) =>
    row.map((value, colIndex) => value / colSum[colIndex]),
  );
  const weights = normalized.map(
    (row) => row.reduce((sum, value) => sum + value, 0) / n,
  );
  const aw = matrix.map((row) =>
    row.reduce((sum, value, colIndex) => sum + value * weights[colIndex], 0),
  );
  const consistencyVector = aw.map((value, rowIndex) => value / weights[rowIndex]);
  const lambdaMax =
    consistencyVector.reduce((sum, value) => sum + value, 0) / n;
  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const cr = ci / (RI[n] || 1.49);
  const rankOrder = weights
    .map((weight, index) => ({ idx: index, weight }))
    .sort((left, right) => right.weight - left.weight)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const rankMap = {};
  rankOrder.forEach((entry) => {
    rankMap[entry.idx] = entry.rank;
  });

  return {
    weights,
    lambdaMax,
    ci,
    cr,
    rankOrder,
    rankMap,
  };
}

function getHeatClass(value) {
  if (value >= 1.2) return "heat-strong-up";
  if (value > 1.05) return "heat-up";
  if (value >= 0.95) return "heat-neutral";
  if (value >= 0.8) return "heat-down";
  return "heat-strong-down";
}

function getRankChip(rank) {
  const classes =
    rank === 1
      ? "alt-rank-chip alt-rank-1"
      : rank === 2
        ? "alt-rank-chip alt-rank-2"
        : rank === 3
          ? "alt-rank-chip alt-rank-3"
          : "alt-rank-chip";
  return `<span class="${classes}">#${rank}</span>`;
}

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function getRecommendationCopy(top10, weights) {
  const winner = top10[0];
  const runnerUp = top10[1];
  const gapPct = runnerUp
    ? (winner.ahp_score - runnerUp.ahp_score) * 100
    : winner.ahp_score * 100;
  const dominantCriterion = [...weights].sort(
    (left, right) => right.weight - left.weight,
  )[0];

  const advantageByCriterion = weights
    .map((criterion) => {
      const winnerScore = Number(winner?.score_detail?.[criterion.id] ?? 0);
      const runnerScore = Number(runnerUp?.score_detail?.[criterion.id] ?? 0);
      return {
        criterion,
        winnerScore,
        runnerScore,
        weightedDiff: (winnerScore - runnerScore) * criterion.weight,
      };
    })
    .sort((left, right) => right.weightedDiff - left.weightedDiff);

  const strongestAdvantage = advantageByCriterion[0]?.criterion || dominantCriterion;
  const verdictVerb = gapPct >= 2 ? "nên chọn" : "đề xuất sát nút";
  const winnerName = getComparisonNames([winner])[0]?.short || `#${winner.rank}`;
  const runnerUpName = runnerUp
    ? getComparisonNames([runnerUp])[0]?.short || `#${runnerUp.rank}`
    : "phương án còn lại";

  return {
    verdictVerb,
    gapPct,
    dominantCriterion,
    strongestAdvantage,
    headline: `${winnerName} là phương án ${verdictVerb}.`,
    detail:
      gapPct >= 2
        ? `Khoảng cách với ${runnerUpName} đủ rõ để xem đây là lựa chọn ưu tiên nhất.`
        : `Khoảng cách với ${runnerUpName} khá sát, nên xem đây là đề xuất mạnh nhất nhưng vẫn cần đối chiếu thêm thực địa.`,
  };
}

function getCriteriaMatrixFallback(data) {
  if (Array.isArray(data?.criteria_matrix) && data.criteria_matrix.length === N) {
    return data.criteria_matrix;
  }
  return data?.ten_phien?.toLowerCase().includes("chuyên gia") ? EM : curMat;
}

function getCriterionSectionSummary(section) {
  const leader = section.topRankings[0];
  const runnerUp = section.topRankings[1];
  const gapPct = runnerUp ? (leader.value - runnerUp.value) * 100 : leader.value * 100;
  const ratio = runnerUp ? getPairwiseRatio(leader.value, runnerUp.value) : 1;
  return {
    gapPct,
    ratio,
  };
}

function buildCriterionComparisonSections(top10, weights) {
  return weights.map((criterion) => {
    const names = getComparisonNames(top10);
    const values = top10.map((item) => Number(item?.score_detail?.[criterion.id] ?? 0));
    const matrix = buildRatioMatrix(values);
    const analysis = buildPriorityAnalysis(matrix);
    const topRankings = top10
      .map((item, index) => ({
        rank: item.rank,
        label: names[index],
        value: values[index],
      }))
      .sort((left, right) => right.value - left.value);

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      weight: criterion.weight,
      pct: criterion.pct,
      names,
      values,
      matrix,
      analysis,
      topRankings,
    };
  });
}

function getResultCardAriaLabel(item) {
  const apartmentName = item?.canho?.title?.trim() || "Căn hộ";
  const location = getApartmentLocation(item?.canho);
  const score = item?.ahp_score != null ? (item.ahp_score * 100).toFixed(1) : "?";

  return `Xem chi tiết ${apartmentName}${location ? `, ${location}` : ""}, hạng #${item?.rank ?? "?"}, điểm ${score} trên 100`;
}

function handleResultCardKeydown(event, idx, triggerEl) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  openModal(idx, triggerEl);
}

function decorateResultCards(containerId, items, actionClassName) {
  const cards = document.querySelectorAll(`#${containerId} > div`);
  cards.forEach((card, index) => {
    const item = items[index];
    if (!item) return;

    const modalIndex = item.rank - 1;
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", getResultCardAriaLabel(item));
    card.onkeydown = (event) => handleResultCardKeydown(event, modalIndex, card);

    if (actionClassName && !card.querySelector(`.${actionClassName}`)) {
      const action = document.createElement("div");
      action.className = actionClassName;
      action.setAttribute("aria-hidden", "true");
      action.innerHTML = '<span>Xem chi tiết</span><span class="rc-action-icon">→</span>';
      const body = card.querySelector(".rc-body");
      if (body) {
        body.appendChild(action);
      }
    }
  });
}

// ── Top 10 dạng card 2 cột ────────────────────────────────────────
function renderTop10(top10) {
  function tNT(v) {
    const m = {
      "Cao cấp": "g",
      "Cao Cấp": "g",
      "Đầy đủ": "b",
      "Đầy Đủ": "b",
      "Cơ bản": "a",
      "Cơ Bản": "a",
      "Không có": "r",
    };
    return v ? `<span class="tag tag-${m[v] || "gray"}">${v}</span>` : "";
  }
  function tPL(v) {
    const s = (v || "").toLowerCase();
    if (s.includes("sổ đỏ") || s.includes("sổ hồng"))
      return `<span class="tag tag-g">Sổ đỏ/Hồng</span>`;
    if (s.includes("giấy tờ")) return `<span class="tag tag-a">Giấy tờ</span>`;
    if (s.includes("hợp đồng"))
      return `<span class="tag tag-gray">HĐ mua bán</span>`;
    return "";
  }

  const medals = ["🥇", "🥈", "🥉"];
  const numCls = ["n1", "n2", "n3"];
  const cardCls = { 1: "rank1", 2: "rank2", 3: "rank3" };

  const html = top10
    .map((item) => {
      const ch = item.canho;
      const r = item.rank;
      const isTop3 = r <= 3;
      const nc = numCls[r - 1] || "nn";
      const cc = cardCls[r] || "";
      const label = medals[r - 1] || r;
      const pct = Math.round(item.ahp_score * 100);
      const ariaLabel = escapeHtml(getResultCardAriaLabel(item));

      return `
        <div class="rank-card ${isTop3 ? "top3 " : ""}${cc}" onclick="openModal(${r - 1}, this)" tabindex="0" role="button" aria-label="${ariaLabel}">
            <div class="rc-num ${nc}">${label}</div>
            <div class="rc-body">
                <div class="rc-title">${ch.title || "—"}</div>
                <div class="rc-meta">
                    ${ch.phuong || ""}
                    ${ch.du_an && !ch.du_an.toLowerCase().includes("không thuộc") ? " · " + ch.du_an : ""}
                </div>
                <div class="rc-tags">
                    ${tNT(ch.noi_that)}
                    ${tPL(ch.phap_ly)}
                    ${ch.so_phong_ngu ? `<span class="tag tag-gray">${ch.so_phong_ngu}PN</span>` : ""}
                    ${ch.dien_tich ? `<span class="tag tag-gray">${ch.dien_tich}m²</span>` : ""}
                </div>
                <div class="rc-bottom">
                    <div class="rc-price">${ch.gia_ty ? ch.gia_ty + " tỷ" : "—"}<span style="font-size:10px;color:var(--text3);font-weight:400"> ${ch.gia_per_m2 ? "· " + ch.gia_per_m2 + " tr/m²" : ""}</span></div>
                    <div class="rc-score-wrap">
                        <div class="rc-score">${pct}</div>
                        <div class="rc-score-bar"><div class="rc-score-fill" style="width:${pct}%"></div></div>
                    </div>
                </div>
            </div>
        </div>`;
    })
    .join("");

  document.getElementById("top10-grid").innerHTML = html;
  decorateResultCards("top10-grid", top10, "rc-action");
  document.getElementById("rank-title").textContent =
    `Top 10 phương án phù hợp nhất`;
}

// ── 5 căn hộ tham khảo (hạng 11-15) ──────────────────────────────
function renderRefer(refer) {
  if (!refer || !refer.length) {
    document.getElementById("refer-section").style.display = "none";
    return;
  }
  document.getElementById("refer-section").style.display = "";

  document.getElementById("refer-grid").innerHTML = refer
    .map((item) => {
      const ch = item.canho;
      const pct = Math.round(item.ahp_score * 100);
      return `
        <div class="refer-card" onclick="openModal(${item.rank - 1}, this)">
            <div class="refer-rank">#${item.rank}</div>
            <div class="refer-score">${pct}</div>
            <div class="refer-name">${ch.title || "—"}</div>
            <div class="refer-price">${ch.gia_ty ? ch.gia_ty + " tỷ" : "—"}</div>
            <div class="refer-meta">${ch.dien_tich || "?"}m² · ${ch.so_phong_ngu || 0}PN · ${ch.phuong || ""}</div>
        </div>`;
    })
    .join("");
  decorateResultCards("refer-grid", refer);
}

// ── Biểu đồ ────────────────────────────────────────────────────────
function renderCharts(weights, top10) {
  const criterionLabels = CRIT.map((c) => c.name.split(" "));
  const getTop10TooltipTitle = (index) => {
    const item = top10[index];
    const apartmentTitle = item?.canho?.title?.trim();
    const projectName = item?.canho?.du_an?.trim();

    return apartmentTitle || projectName || `#${item?.rank ?? index + 1}`;
  };

  if (chW) {
    chW.destroy();
    chW = null;
  }
  if (chTop10) {
    chTop10.destroy();
    chTop10 = null;
  }

  // Chart 1: Trọng số tiêu chí
  chW = new Chart(document.getElementById("chart-w").getContext("2d"), {
    type: "bar",
    data: {
      labels: criterionLabels,
      datasets: [
        {
          data: weights.map((w) => +(w * 100).toFixed(1)),
          backgroundColor: CRIT.map((c) => c.color),
          borderRadius: 5,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => CRIT[items[0]?.dataIndex]?.name || "",
            label: (ctx) => `${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: "#718096", maxRotation: 0 },
        },
        y: {
          ticks: {
            callback: (v) => v + "%",
            font: { size: 10 },
            color: "#718096",
          },
          grid: { color: "#f0ede8" },
        },
      },
    },
  });

  // Chart 2: Điểm Top 10 (nằm ngang, dễ đọc)
  chTop10 = new Chart(document.getElementById("chart-top10").getContext("2d"), {
    type: "bar",
    data: {
      labels: top10.map((x) => `#${x.rank}`),
      datasets: [
        {
          label: "Điểm AHP",
          data: top10.map((x) => +(x.ahp_score * 100).toFixed(1)),
          backgroundColor: top10.map((_, i) =>
            i < 3 ? "#c8922a" : i < 5 ? "#1a3a5c" : "#5b7fa6",
          ),
          borderRadius: 4,
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: "y", // nằm ngang
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => getTop10TooltipTitle(items[0]?.dataIndex ?? 0),
            label: (ctx) => `Điểm: ${ctx.parsed.x.toFixed(1)}/100`,
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { font: { size: 10 }, color: "#718096" },
          grid: { color: "#f0ede8" },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: "#718096" },
        },
      },
    },
  });
}

// ════════════════════════════════════════════════════════════════
// MA TRẬN SO SÁNH CẶP GIỮA CÁC PHƯƠNG ÁN
// Theo lý thuyết AHP (tài liệu Saaty): sau khi có trọng số tiêu chí,
// ta tính ma trận so sánh cặp phương án cho từng tiêu chí rồi tổng hợp.
// Ở đây dùng điểm AHP tổng hợp: a[i][j] = score[i] / score[j]
// ════════════════════════════════════════════════════════════════
function renderAltMatrix(top10) {
  const section = document.getElementById("alt-matrix-section");
  const wrap = document.getElementById("alt-matrix-wrap");
  const body = document.getElementById("alt-matrix-body");
  const btn = document.getElementById("alt-matrix-toggle");
  if (!top10 || top10.length < 2) {
    section.style.display = "none";
    if (body) body.style.display = "";
    if (btn) {
      btn.textContent = "Thu gọn ma trận ▲";
      btn.setAttribute("aria-expanded", "true");
    }
    return;
  }
  section.style.display = "";
  if (body) body.style.display = "";
  if (btn) {
    btn.textContent = "Thu gọn ma trận ▲";
    btn.setAttribute("aria-expanded", "true");
  }

  const n = top10.length;
  const scores = top10.map((item) => item.ahp_score); // điểm tổng hợp từ backend
  const names = top10.map((item) => {
    const t = item.canho.title || "";
    // Rút gọn tên: lấy tên dự án hoặc 25 ký tự đầu
    const du_an = getApartmentProjectName(item.canho);
    if (du_an && !du_an.toLowerCase().includes("không thuộc")) {
      return {
        full: `#${item.rank} ${du_an}`,
        short: `#${item.rank} ${du_an.substring(0, 18)}${du_an.length > 18 ? "…" : ""}`,
      };
    }
    return {
      full: `#${item.rank} ${t || "Căn hộ"}`,
      short: `#${item.rank} ${t.substring(0, 20)}${t.length > 20 ? "…" : ""}`,
    };
  });

  // Tính ma trận a[i][j] = score[i] / score[j]
  const mat = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => scores[i] / scores[j]),
  );

  // Tính trọng số phương án (cột priority vector)
  // Chuẩn hóa: tổng cột → chia → trung bình hàng (giống bước 2 AHP)
  const colSum = Array(n).fill(0);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) colSum[j] += mat[i][j];
  const norm = mat.map((row) => row.map((v, j) => v / colSum[j]));
  const weights_pa = norm.map((row) => row.reduce((s, v) => s + v, 0) / n);

  // Tính CR của ma trận phương án
  const Aw = mat.map((row) =>
    row.reduce((s, v, j) => s + v * weights_pa[j], 0),
  );
  const cv = Aw.map((v, i) => v / weights_pa[i]);
  const lmax_pa = cv.reduce((s, v) => s + v, 0) / n;
  const RI_PA = {
    1: 0,
    2: 0,
    3: 0.58,
    4: 0.9,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
  };
  const ci_pa = (lmax_pa - n) / (n - 1);
  const cr_pa = ci_pa / (RI_PA[n] || 1.49);

  // Xếp hạng theo weights_pa
  const rankOrder = weights_pa
    .map((w, i) => ({ idx: i, w }))
    .sort((a, b) => b.w - a.w)
    .map((o, r) => ({ ...o, rank: r + 1 }));
  const rankMap = {};
  rankOrder.forEach((o) => {
    rankMap[o.idx] = o.rank;
  });

  const winner = rankOrder[0];
  const runnerUp = rankOrder[1];
  const winnerName = names[winner.idx];
  const runnerUpName = names[runnerUp.idx];
  const leadRatio = runnerUp ? weights_pa[winner.idx] / weights_pa[runnerUp.idx] : 1;
  const leadPct = runnerUp
    ? ((weights_pa[winner.idx] - weights_pa[runnerUp.idx]) * 100).toFixed(2)
    : "0.00";
  const consistencyTone = cr_pa < 0.1 ? "ok" : cr_pa < 0.15 ? "warn" : "soft-warn";
  const consistencyText =
    cr_pa < 0.1
      ? "Ma trận ổn định, có thể tin cậy để đọc thứ hạng."
      : cr_pa < 0.15
        ? "Ma trận vẫn đọc được, nhưng chênh lệch khá sít."
        : "CR cao hơn mức lý tưởng, nên đọc theo xu hướng tổng thể.";

  function getHeatClass(value) {
    if (value >= 1.2) return "heat-strong-up";
    if (value > 1.05) return "heat-up";
    if (value >= 0.95) return "heat-neutral";
    if (value >= 0.8) return "heat-down";
    return "heat-strong-down";
  }

  function getRankChip(rank) {
    const cls =
      rank === 1
        ? "alt-rank-chip alt-rank-1"
        : rank === 2
          ? "alt-rank-chip alt-rank-2"
          : rank === 3
            ? "alt-rank-chip alt-rank-3"
            : "alt-rank-chip";
    return `<span class="${cls}">#${rank}</span>`;
  }

  const summary = `
    <div class="alt-matrix-summary">
      <article class="alt-summary-card alt-summary-card--winner">
        <span class="alt-summary-label">Phương án dẫn đầu</span>
        <div class="alt-summary-value">${escapeHtml(winnerName.short)}</div>
        <div class="alt-summary-note">Đứng đầu theo trọng số PA cuối cùng.</div>
      </article>
      <article class="alt-summary-card">
        <span class="alt-summary-label">Khoảng cách với #2</span>
        <div class="alt-summary-value">${leadRatio.toFixed(2)}x</div>
        <div class="alt-summary-note">Cao hơn ${leadPct}% so với ${escapeHtml(runnerUpName.short)}.</div>
      </article>
      <article class="alt-summary-card">
        <span class="alt-summary-label">Độ nhất quán</span>
        <div class="alt-summary-value">CR ${(cr_pa * 100).toFixed(2)}%</div>
        <div class="alt-summary-note">λmax ${lmax_pa.toFixed(4)} · ${consistencyText}</div>
      </article>
    </div>
    <div class="alt-matrix-legend">
      <span class="alt-legend-chip alt-legend-chip--down">&lt; 0.95: yếu hơn rõ</span>
      <span class="alt-legend-chip alt-legend-chip--neutral">0.95–1.05: gần ngang nhau</span>
      <span class="alt-legend-chip alt-legend-chip--up">&gt; 1.05: nhỉnh hơn rõ</span>
      <span class="alt-consistency-chip alt-consistency-chip--${consistencyTone}">
        ${cr_pa < 0.1 ? "CR tốt" : cr_pa < 0.15 ? "CR sát ngưỡng" : "CR cần lưu ý"}
      </span>
    </div>`;

  // Render bảng HTML
  let h = `${summary}
    <div class="alt-matrix-table-shell">
      <table class="alt-matrix-table"><thead><tr>
        <th class="alt-sticky-col alt-row-head">Phương án</th>
        ${names
          .map(
            (nm) =>
              `<th title="${escapeHtml(nm.full)}"><span>${escapeHtml(nm.short)}</span></th>`,
          )
          .join("")}
        <th class="alt-weight-col">Trọng số PA</th>
        <th class="alt-rank-col">Hạng</th>
    </tr></thead><tbody>`;

  for (let i = 0; i < n; i++) {
    const rowRank = rankMap[i];
    const rowClasses = [
      rowRank === 1 ? "is-winner" : "",
      rowRank <= 3 ? "is-top3" : "",
    ]
      .filter(Boolean)
      .join(" ");

    h += `<tr class="${rowClasses}"><th class="alt-sticky-col alt-row-head" title="${escapeHtml(names[i].full)}">${escapeHtml(names[i].short)}</th>`;
    for (let j = 0; j < n; j++) {
      const v = mat[i][j];
      if (i === j) {
        h += `<td class="alt-heat-cell alt-heat-diag">1.000</td>`;
      } else {
        const heatClass = getHeatClass(v);
        h += `<td class="alt-heat-cell ${heatClass}" data-value="${v.toFixed(3)}">${v.toFixed(3)}</td>`;
      }
    }
    h += `
      <td class="alt-weight-col">
        <div class="alt-weight-main">${(weights_pa[i] * 100).toFixed(2)}%</div>
        <div class="alt-weight-sub">${weights_pa[i].toFixed(4)}</div>
      </td>`;
    h += `<td class="alt-rank-col">${getRankChip(rowRank)}</td>`;
    h += "</tr>";
  }

  h += `</tbody></table></div>
    <div class="alt-matrix-foot">
      <div class="alt-foot-metric">λmax <b>${lmax_pa.toFixed(4)}</b></div>
      <div class="alt-foot-metric">CI <b>${ci_pa.toFixed(4)}</b></div>
      <div class="alt-foot-metric">CR <b>${(cr_pa * 100).toFixed(2)}%</b></div>
      <div class="alt-foot-caption">${consistencyText}</div>
    </div>`;
  wrap.innerHTML = h;
  const summaryCards = wrap.querySelectorAll(".alt-summary-card");
  const consistencyCard = summaryCards[summaryCards.length - 1];
  if (consistencyCard) {
    consistencyCard.querySelector(".alt-summary-value").innerHTML = latexInline(
      `\\mathrm{CR} = ${(cr_pa * 100).toFixed(2)}\\%`,
      `CR ${(cr_pa * 100).toFixed(2)}%`,
    );
    consistencyCard.querySelector(".alt-summary-note").innerHTML = `
      ${latexInline(`\\lambda_{\\max} = ${lmax_pa.toFixed(4)}`, `λmax ${lmax_pa.toFixed(4)}`)}
      <span class="math-divider">·</span>
      ${consistencyText}
    `;
  }

  const footMetrics = wrap.querySelector(".alt-matrix-foot");
  if (footMetrics) {
    footMetrics.innerHTML = `
      <div class="alt-foot-metric">${latexInline(`\\lambda_{\\max} = ${lmax_pa.toFixed(4)}`, `λmax ${lmax_pa.toFixed(4)}`)}</div>
      <div class="alt-foot-metric">${latexInline(`\\mathrm{CI} = ${ci_pa.toFixed(4)}`, `CI ${ci_pa.toFixed(4)}`)}</div>
      <div class="alt-foot-metric">${latexInline(`\\mathrm{CR} = ${(cr_pa * 100).toFixed(2)}\\%`, `CR ${(cr_pa * 100).toFixed(2)}%`)}</div>
      <div class="alt-foot-caption">${consistencyText}</div>
    `;
  }
  renderMathInScope(section);
}

function toggleAltMatrix() {
  const body = document.getElementById("alt-matrix-body");
  const btn = document.getElementById("alt-matrix-toggle");
  const hidden = body.style.display === "none";
  body.style.display = hidden ? "" : "none";
  btn.textContent = hidden ? "Thu gọn ma trận ▲" : "Mở rộng ma trận ▼";
  btn.setAttribute("aria-expanded", hidden ? "true" : "false");
}

// ════════════════════════════════════════════════════════════════
// MODAL CHI TIẾT
// ════════════════════════════════════════════════════════════════
function openModal(idx, triggerEl) {
  if (!lastRes) return;
  const item = lastRes.ranked[idx];
  const ch = item.canho;
  const det = item.score_detail || {};
  const modal = document.getElementById("modal");
  const closeButton = document.querySelector(".modal-x");
  const locationLine = getApartmentLocation(ch);
  const priceValue = ch.gia_ty ? `${ch.gia_ty} tỷ` : "—";
  const priceMeta = ch.gia_per_m2 ? `${ch.gia_per_m2} tr/m²` : "Chưa có giá/m²";
  const wMap = {};
  lastFocusedTrigger = triggerEl || document.activeElement;
  lastRes.weights.forEach((w) => {
    wMap[w.id] = w;
  });

  const tgs = (s) =>
    s
      ? s
          .split("|")
          .map((t) => `<span class="tag tag-b">${t.trim()}</span>`)
          .join(" ")
      : '<span class="tag tag-gray">—</span>';
  const modalIcons = {
    home:
      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-6h6v6"/>',
    dollarSign:
      '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    ruler:
      '<path d="M4 7h16v10H4z"/><path d="M8 7v4"/><path d="M12 7v3"/><path d="M16 7v4"/>',
    armchair:
      '<path d="M7 11V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3"/><path d="M5 11h14v5H5z"/><path d="M7 16v3"/><path d="M17 16v3"/><path d="M4 11v3"/><path d="M20 11v3"/>',
    fileText:
      '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h2"/>',
    building2:
      '<path d="M6 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M3 22h18"/><path d="M10 9h1"/><path d="M13 9h1"/><path d="M10 13h1"/><path d="M13 13h1"/><path d="M10 17h1"/><path d="M13 17h1"/>',
    mapPin:
      '<path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z"/><circle cx="12" cy="11" r="2.5"/>',
    compass:
      '<circle cx="12" cy="12" r="9"/><path d="m14.8 9.2-4.2 1.8-1.8 4.2 4.2-1.8 1.8-4.2Z"/>',
    calendar:
      '<path d="M7 2v4"/><path d="M17 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/>',
    map:
      '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5"/><path d="M15 6.5V20"/>',
    sparkles:
      '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z"/><path d="M19 14l.7 1.8L21.5 16l-1.8.7L19 18.5l-.7-1.8L16.5 16l1.8-.7Z"/><path d="M5 14l.7 1.8L7.5 16l-1.8.7L5 18.5l-.7-1.8L2.5 16l1.8-.7Z"/>',
    barChart3:
      '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-11"/>',
    externalLink:
      '<path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/>',
    trendingUp:
      '<path d="M3 17 9 11l4 4 8-8"/><path d="M14 7h7v7"/>',
  };
  const modalIcon = (name) =>
    `<svg class="modal-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">${modalIcons[name] || ""}</svg>`;
  const modalLabel = (iconName, text) =>
    `<span class="modal-label-line">${modalIcon(iconName)}<span>${text}</span></span>`;
  const modalInline = (iconName, text) =>
    `<span class="detail-inline-row">${modalIcon(iconName)}<span>${text}</span></span>`;
  const rankBadgeClass = item.rank <= 3 ? ` rank-${item.rank}` : "";

  document.getElementById("modal-ttl").textContent = ch.title || "Căn hộ";
  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = `
        <div class="detail-section-label">${modalLabel("home", "Thông tin căn hộ")}</div>
        <div class="ig">
            <div class="ig-item"><div class="ig-lbl">${modalLabel("dollarSign", "Giá bán")}</div>
                <div class="ig-val" style="color:var(--green);font-family:'Playfair Display',serif;font-size:18px;font-weight:700">
                    ${ch.gia_ty || "—"} tỷ <span style="font-size:12px;color:var(--text3)">(${ch.gia_per_m2 || "?"} tr/m²)</span>
                </div>
            </div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("ruler", "Diện tích & phòng")}</div><div class="ig-val">${ch.dien_tich || "?"}m² · ${ch.so_phong_ngu || 0}PN/${ch.so_phong_wc || 0}WC</div></div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("armchair", "Nội thất")}</div><div class="ig-val">${ch.noi_that || "—"}</div></div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("fileText", "Pháp lý")}</div><div class="ig-val">${ch.phap_ly || "—"}</div></div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("building2", "Dự án")}</div><div class="ig-val">${ch.du_an || "—"}</div></div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("mapPin", "Phường")}</div><div class="ig-val">${ch.phuong || "—"}</div></div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("compass", "Hướng nhà/Ban công")}</div><div class="ig-val">${ch.huong_nha || "—"} / ${ch.huong_ban_cong || "—"}</div></div>
            <div class="ig-item"><div class="ig-lbl">${modalLabel("calendar", "Ngày đăng")}</div><div class="ig-val">${ch.ngay_dang ? new Date(ch.ngay_dang).toLocaleDateString("vi-VN") : "—"}</div></div>
            <div class="ig-item full"><div class="ig-lbl">${modalLabel("map", "Hạ tầng xã hội")}</div><div class="ig-val">${tgs(ch.tien_ich_ha_tang)}</div></div>
            <div class="ig-item full"><div class="ig-lbl">${modalLabel("sparkles", "Tiện ích nội khu")}</div><div class="ig-val">${tgs(ch.tien_ich_noi_khu)}</div></div>
        </div>
        <div class="detail-section-label">${modalLabel("barChart3", "Điểm theo từng tiêu chí")}</div>
        <div class="bd-grid">
            ${CRIT.map((c) => {
              const s = det[c.id];
              const w = wMap[c.id];
              return `<div class="bd-item" style="--criterion-color:${c.color}">
                    <div class="bd-name">${c.name}</div>
                    <div class="bd-s">${s != null ? (s * 100).toFixed(0) : "?"}</div>
                    <div class="bd-w">Mức độ quan trọng ${w ? w.pct.toFixed(1) + "%" : "?"}</div>
                </div>`;
            }).join("")}
        </div>
        ${
          ch.url
            ? `<div style="margin-top:18px">
            <a href="${ch.url}" target="_blank" class="detail-source-link">
                <span class="detail-inline-row">${modalIcon("externalLink")}<span>Xem tin gốc trên thuviennhadat.vn →</span></span>
            </a>
        </div>`
            : ""
        }`;

  const summary = document.createElement("div");
  summary.className = "detail-summary";
  summary.innerHTML = `
        <div class="detail-summary-main">
            <div class="detail-rank-badge${rankBadgeClass}">#${item.rank}</div>
            <div class="detail-summary-copy">
                <div class="detail-summary-label">Thông tin nổi bật</div>
                <div class="detail-summary-score">${modalInline("trendingUp", `Hạng #${item.rank} · Điểm AHP ${(item.ahp_score * 100).toFixed(1)}/100`)}</div>
                <div class="detail-summary-meta">${modalInline("mapPin", locationLine || "Chưa có thông tin vị trí hoặc dự án")}</div>
            </div>
        </div>
        <div class="detail-price-card">
            <div class="detail-price-label">${modalLabel("dollarSign", "Giá tham khảo")}</div>
            <div class="detail-price-value">${priceValue}</div>
            <div class="detail-price-meta">${priceMeta}</div>
        </div>`;

  const infoGrid = modalBody.querySelector(".ig");
  const leadingBlock = modalBody.firstElementChild;
  if (leadingBlock && leadingBlock !== infoGrid) {
    leadingBlock.replaceWith(summary);
  } else {
    modalBody.prepend(summary);
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  closeButton?.focus();
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
    lastFocusedTrigger.focus();
  }
}

// ════════════════════════════════════════════════════════════════
// MODE + PRESET + RESET
// ════════════════════════════════════════════════════════════════
function setMode(m) {
  curMode = m;
  document
    .getElementById("tab-expert")
    .classList.toggle("active", m === "expert");
  document
    .getElementById("tab-custom")
    .classList.toggle("active", m === "custom");
  document.getElementById("panel-expert").style.display =
    m === "expert" ? "" : "none";
  document.getElementById("panel-custom").style.display =
    m === "custom" ? "" : "none";
}

// Áp preset (một bộ ma trận AHP có sẵn) lên ma trận hiện tại.
// Hàm này được gọi khi nhấn nút “Cân bằng / Ưu tiên giá / …”.
function applyPreset(name) {
  // Xóa trạng thái active của tất cả nút preset
  document
    .querySelectorAll(".pbtn")
    .forEach((b) => b.classList.remove("active"));

  // Bật trạng thái active cho nút tương ứng với preset name
  const btn = document.querySelector(`.pbtn[data-preset="${name}"]`);
  if (btn && btn.classList) {
    btn.classList.add("active");
  } else if (btn) {
    console.warn("applyPreset: found element without classList", btn);
  }

  // Lấy ma trận preset từ PS (Preset matrices)
  const pre = PS[name];
  if (!pre) return; // Nếu không tồn tại preset, không làm gì cả

  // Cập nhật dữ liệu ma trận lưu trong curMat
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) curMat[i][j] = pre[i][j];

  // Cập nhật DOM (các ô input) theo ma trận preset
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const e = document.getElementById(`m_${i}_${j}`);
      if (e)
        e.value =
          pre[i][j] === 1
            ? "1"
            : pre[i][j] > 1
              ? pre[i][j].toFixed(0)
              : (1 / pre[j][i]).toFixed(2);
      const r = document.getElementById(`r_${i}_${j}`);
      if (r) r.value = (1 / pre[i][j]).toFixed(3);
    }

  // Tính CR & hiển thị (preview) dựa trên ma trận mới
  previewCR();
}

function resetMatrix() {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) curMat[i][j] = 1;
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const e = document.getElementById(`m_${i}_${j}`);
      if (e) e.value = 1;
      const r = document.getElementById(`r_${i}_${j}`);
      if (r) r.value = "1.000";
    }
  previewCR();
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function showLoad(msg) {
  document.getElementById("loading-txt").textContent = msg;
  document.getElementById("loading").classList.add("show");
}
function hideLoad() {
  document.getElementById("loading").classList.remove("show");
}
function showErr(msg) {
  const e = document.getElementById("err-box");
  e.textContent = msg;
  e.classList.toggle("show", !!msg);
}

// Modal click-outside
document.addEventListener("DOMContentLoaded", () => {
  hydrateStaticMathCopy();
  renderMathInScope(document);
  document.querySelector(".modal-x")?.setAttribute("aria-label", "Đóng chi tiết căn hộ");
  const resultHint = document.querySelector("#rank-title")?.nextElementSibling;
  if (resultHint && resultHint.classList.contains("card-sub")) {
    resultHint.textContent = "Click hoặc nhấn Enter trên từng căn hộ để xem chi tiết và điểm thành phần";
  }
  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("modal").classList.contains("open")) {
      closeModal();
    }
  });
  init();
});
