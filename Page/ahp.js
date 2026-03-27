// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ahp.js — Logic phân tích AHP cho ApartmentBroker DSS
// Kết nối backend FastAPI: http://localhost:8000
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const API = "http://localhost:8000";
const DEFAULT_LLM_MODEL_FALLBACK = "openai/gpt-4o-mini";

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
let chLlmTop10 = null;
let chLlmRadar = null;
let lastFocusedTrigger = null;
let modalGalleryImages = [];
let activeModalImageIndex = 0;
let activeCriterionMatrixId = null;
let apiInfoCache = null;
let llmInsightsExpanded = false;
let llmExpandedTextKeys = new Set();
let llmChartsExpanded = null;
let llmChartsManual = false;
let llmChartsRenderFrame = 0;
let llmChartSignature = "";
let compareSelection = [];
let compareResult = null;
let compareSupportChart = null;
let compareRadarChart = null;
let lastCompareTrigger = null;
let activeApartmentChatContext = null;
let apartmentChatHistory = [];
let apartmentChatOpen = false;
let apartmentChatLoading = false;
let apartmentChatSuggestions = [];
let aiIntakeResult = null;
let aiIntakeLoading = false;
const PAIRWISE_EPS = 0.001;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KHá»žI Äá»˜NG
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ÄÃ¢y lÃ  hÃ m gá»i khi trang load xong. NÃ³ chuáº©n bá»‹ giao diá»‡n vÃ  kiá»ƒm tra
// xem backend (FastAPI) đã chạy chưa.
async function init() {
  // Váº½ giao diá»‡n: báº£ng trá»ng sá»‘, ma tráº­n, v.v.
  buildEW();
  buildMat();

  // Máº·c Ä‘á»‹nh chá»n preset "price" (Æ°u tiÃªn giÃ¡)
  applyPreset("price");

  // Nếu URL là ahp.html?mode=custom thì kích chế độ custom, còn không thì expert.
  const m = new URLSearchParams(location.search).get("mode");
  setMode(m === "custom" ? "custom" : "expert");

  // Gá»i backend Ä‘á»ƒ kiá»ƒm tra káº¿t ná»‘i (vÃ  hiá»ƒn thá»‹ tráº¡ng thÃ¡i trÃªn trang)
  await loadApiInfo();
  syncLlmControls();
  await pingAPI();
}

// ── Kiểm tra kết nối backend ─────────────────────────────────────
// HÃ m nÃ y gá»i endpoint /health Ä‘á»ƒ kiá»ƒm tra FastAPI cÃ³ Ä‘ang cháº¡y khÃ´ng.
async function loadApiInfo() {
  const llmNote = document.getElementById("llm-note");

  try {
    const response = await fetch(API + "/api-info");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    apiInfoCache = await response.json();

    if (llmNote) {
      llmNote.textContent = apiInfoCache?.llm_enabled
        ? "AI dang ho tro 3 viec: goi y cau hinh ban dau, dien giai shortlist va tra loi theo tung can ho."
        : "Backend chua co OPENROUTER_API_KEY. Ban van xem duoc AHP, nhung cac tinh nang AI se tam chua san sang.";
    }
    renderAiIntakeResult();
    renderApartmentChatShell();
  } catch (error) {
    console.warn("loadApiInfo failed:", error);
    if (llmNote) {
      llmNote.textContent =
        "Khong lay duoc cau hinh OpenRouter tu backend. He thong se dung model ban nhap neu backend co ho tro AI.";
    }
    renderAiIntakeResult();
    renderApartmentChatShell();
  }
}

function syncLlmControls() {
  const enabledInput = document.getElementById("llm-enabled");
  if (!enabledInput) return;
  renderAiIntakeResult();
  renderCompareToolbar();
  renderApartmentChatShell();
}

function getCurrentLlmModel() {
  return (
    apiInfoCache?.llm_default_model?.trim() ||
    DEFAULT_LLM_MODEL_FALLBACK
  );
}

function getAiRuntimeState() {
  const userEnabled = document.getElementById("llm-enabled")?.checked ?? true;
  const backendEnabled = apiInfoCache?.llm_enabled ?? true;
  const model = getCurrentLlmModel();
  return { userEnabled, backendEnabled, model };
}

function fillAiIntakePrompt(text) {
  const input = document.getElementById("assistant-intake-input");
  if (!input) return;
  input.value = text;
  input.focus();
}

function getPresetLabel(presetId) {
  const labels = {
    balanced: "Cân bằng",
    price: "Ưu tiên giá",
    quality: "Chất lượng sống",
    legal: "Pháp lý",
    location: "Vị trí",
  };
  return labels[presetId] || "Cân bằng";
}

function buildMatrixFromWeights(weightList) {
  const weights = CRIT.map((criterion) => {
    const match = weightList.find((item) => item.id === criterion.id);
    return Math.max(Number(match?.weight) || 0, 0.0001);
  });
  return weights.map((rowWeight) =>
    weights.map((colWeight) => Number((rowWeight / colWeight).toFixed(4))),
  );
}

function applyMatrixProfile(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== N) return;

  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      curMat[i][j] = Number(matrix[i][j]) || 1;
    }
  }

  document.querySelectorAll(".pbtn").forEach((button) => button.classList.remove("active"));

  for (let i = 0; i < N; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      const editable = document.getElementById(`m_${i}_${j}`);
      const reciprocal = document.getElementById(`r_${i}_${j}`);
      if (editable) editable.value = formatCriteriaInputValue(curMat[i][j]);
      if (reciprocal) reciprocal.value = curMat[j][i].toFixed(3);
    }
  }

  previewCR();
}

function renderAiIntakeResult() {
  const host = document.getElementById("assistant-intake-result");
  const runButton = document.getElementById("assistant-intake-run");
  const applyButton = document.getElementById("assistant-intake-apply");
  const input = document.getElementById("assistant-intake-input");
  if (!host || !runButton || !applyButton || !input) return;

  const { backendEnabled, userEnabled } = getAiRuntimeState();
  const disabled = !backendEnabled || !userEnabled;

  runButton.disabled = disabled || aiIntakeLoading;
  applyButton.disabled = aiIntakeLoading || !(aiIntakeResult?.status === "success");
  input.disabled = aiIntakeLoading;

  if (!backendEnabled) {
    host.innerHTML = `
      <div class="assistant-result-empty is-warning">
        <div class="assistant-result-title">AI co-pilot chưa sẵn sàng</div>
        <p class="assistant-result-copy">Backend chưa bật OpenRouter nên hiện tại bạn vẫn dùng được AHP, nhưng chưa thể nhờ AI gợi ý cấu hình ban đầu.</p>
      </div>`;
    return;
  }

  if (!userEnabled) {
    host.innerHTML = `
      <div class="assistant-result-empty">
        <div class="assistant-result-title">Bật AI để dùng co-pilot</div>
            <p class="assistant-result-copy">Bật góc nhìn AI ở bên dưới để AI có thể đọc nhu cầu và đề xuất cấu hình AHP ban đầu cho bạn.</p>
      </div>`;
    return;
  }

  if (aiIntakeLoading) {
    host.innerHTML = `
      <div class="assistant-result-empty">
        <div class="assistant-result-title">AI đang đọc nhu cầu của bạn</div>
        <p class="assistant-result-copy">Hệ thống đang tóm ý định mua để ở, gợi ý preset phù hợp và quy đổi sang trọng số ban đầu cho 8 tiêu chí.</p>
      </div>`;
    return;
  }

  if (!aiIntakeResult) {
    host.innerHTML = `
      <div class="assistant-result-empty">
        <div class="assistant-result-title">AI sẽ giúp bạn làm gì?</div>
        <p class="assistant-result-copy">AI sẽ đọc nhu cầu ở thực của bạn, gợi ý một preset phù hợp, đề xuất trọng số ban đầu cho 8 tiêu chí và để bạn chỉnh tay trước khi chạy AHP.</p>
      </div>`;
    return;
  }

  if (aiIntakeResult.status !== "success") {
    host.innerHTML = `
      <div class="assistant-result-empty is-warning">
        <div class="assistant-result-title">AI chưa gợi ý được cấu hình</div>
        <p class="assistant-result-copy">${escapeHtml(
          aiIntakeResult.error || "Hiện AI chưa đủ dữ liệu để đề xuất cấu hình ban đầu cho nhu cầu này.",
        )}</p>
      </div>`;
    return;
  }

  const profile = aiIntakeResult.intent_profile || {};
  const topWeights = [...(aiIntakeResult.suggested_weights || [])]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 4);
  const metaChips = [profile.budget, profile.preferred_area, profile.bedroom_need]
    .filter(Boolean)
    .map((value) => `<span class="assistant-result-chip">${escapeHtml(value)}</span>`)
    .join("");

  host.innerHTML = `
    <div class="assistant-result-card">
      <div class="assistant-result-topline">
        <div class="assistant-result-title">AI đã hiểu nhu cầu ban đầu của bạn</div>
        <span class="assistant-result-chip assistant-result-chip--accent">Preset: ${escapeHtml(
          getPresetLabel(aiIntakeResult.recommended_preset),
        )}</span>
      </div>
      <p class="assistant-result-copy">${escapeHtml(profile.goal || "AI đã tóm tắt nhu cầu ở thực của bạn.")}</p>
      ${metaChips ? `<div class="assistant-result-chip-row">${metaChips}</div>` : ""}
      <div class="assistant-result-section">
        <div class="assistant-result-label">Ưu tiên nổi bật</div>
        <div class="assistant-result-list">
          ${(profile.top_priorities?.length
            ? profile.top_priorities
            : ["Đang ưu tiên một cấu hình cân bằng để bắt đầu."])
            .map((item) => `<span class="assistant-result-pill">${escapeHtml(item)}</span>`)
            .join("")}
        </div>
      </div>
      <div class="assistant-result-section">
        <div class="assistant-result-label">Trọng số AI đang gợi ý</div>
        <div class="assistant-weight-grid">
          ${topWeights
            .map(
              (item) => `
                <div class="assistant-weight-card">
                  <div class="assistant-weight-name">${escapeHtml(item.name)}</div>
                  <div class="assistant-weight-value">${item.pct.toFixed(1)}%</div>
                </div>`,
            )
            .join("")}
        </div>
      </div>
      <div class="assistant-result-section">
        <div class="assistant-result-label">Cách AI quy đổi</div>
        <p class="assistant-result-copy">${escapeHtml(aiIntakeResult.explanation || "")}</p>
      </div>
    </div>`;
}

async function runAiIntake() {
  const input = document.getElementById("assistant-intake-input");
  if (!input || aiIntakeLoading) return;

  const userInput = input.value.trim();
  if (!userInput) {
    showErr("Hãy mô tả ngắn nhu cầu của bạn để AI có thể gợi ý cấu hình ban đầu.");
    input.focus();
    return;
  }

  const { backendEnabled, userEnabled, model } = getAiRuntimeState();
  if (!backendEnabled || !userEnabled) {
    renderAiIntakeResult();
    return;
  }

  aiIntakeLoading = true;
  aiIntakeResult = null;
  renderAiIntakeResult();
  showLoad("AI dang quy doi nhu cau thanh cau hinh AHP...");
  showErr("");

  try {
    const response = await fetch(API + "/ahp/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_input: userInput,
        llm_model: model,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => ({ detail: "Khong the doc loi tu backend" }));
      throw new Error(errorPayload?.detail || `HTTP ${response.status}`);
    }

    aiIntakeResult = await response.json();
  } catch (error) {
    aiIntakeResult = {
      status: "failed",
      error: error.message || "Khong the tao cau hinh AI intake luc nay.",
    };
  } finally {
    aiIntakeLoading = false;
    hideLoad();
    renderAiIntakeResult();
  }
}

function applyAiIntakeSuggestion() {
  if (aiIntakeResult?.status !== "success" || !aiIntakeResult.suggested_weights?.length) return;

  applyMatrixProfile(buildMatrixFromWeights(aiIntakeResult.suggested_weights));
  setMode("custom");
  document.getElementById("panel-custom")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function pingAPI() {
  const dot = document.getElementById("api-dot");
  const lbl = document.getElementById("api-lbl");
  const banner = document.getElementById("api-banner");
  const retryBar = document.getElementById("retry-bar");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const r = await fetch(API + "/api-info", { signal: controller.signal });
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
            <th class="alt-sticky-col alt-row-head">Tiêu chí</th>
            ${CRIT.map((c) => `<th title="${escapeHtml(`${c.id} · ${c.name}`)}"><span class="criteria-col-head">${escapeHtml(`${c.id} · ${c.name}`)}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>`;

  for (let i = 0; i < N; i += 1) {
    h += `<tr><th class="alt-sticky-col alt-row-head criteria-row-head">${escapeHtml(`${CRIT[i].id} · ${CRIT[i].name}`)}</th>`;
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GỌI BACKEND
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function callAPI(matrix, tenPhien) {
  showLoad("Dang tinh ket qua phu hop...");
  showErr("");
  try {
    const llmModel = getCurrentLlmModel();
    const llmEnabled = document.getElementById("llm-enabled")?.checked ?? true;
    const res = await fetch(API + "/ahp/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ten_phien: tenPhien,
        matrix,
        llm_model: llmModel,
        llm_enabled: llmEnabled,
      }),
    });
    if (!res.ok) {
      const e = await res
        .json()
        .catch(() => ({ detail: "Loi khong xac dinh" }));
      throw new Error(e?.detail?.msg || e?.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    hideLoad();
    return data;
  } catch (e) {
    hideLoad();
    showErr("Loi: " + e.message);
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

function prefersCompactLlmLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function destroyLlmCharts() {
  if (chLlmTop10) {
    chLlmTop10.destroy();
    chLlmTop10 = null;
  }
  if (chLlmRadar) {
    chLlmRadar.destroy();
    chLlmRadar = null;
  }
  llmChartSignature = "";
}

function cancelScheduledLlmCharts() {
  if (!llmChartsRenderFrame) return;
  cancelAnimationFrame(llmChartsRenderFrame);
  llmChartsRenderFrame = 0;
}

function resetLlmSectionState() {
  llmInsightsExpanded = false;
  llmExpandedTextKeys = new Set();
  llmChartsManual = false;
  llmChartsExpanded = !prefersCompactLlmLayout();
  cancelScheduledLlmCharts();
  destroyLlmCharts();
}

function getLlmChartSignature(top10 = getTopRankedItems(), analysis = lastRes?.llm_analysis) {
  const insightEntries = getLlmInsightEntries(top10, analysis);
  if (!insightEntries.length) return "";

  const leadInsight = insightEntries[0]?.insight;
  return JSON.stringify({
    ids: insightEntries.map(({ insight }) => insight.canho_id ?? insight.rank),
    scores: insightEntries.map(({ insight }) => insight.llm_support_score),
    leadScores: CRIT.map((criterion) => leadInsight?.criterion_scores?.[criterion.id] ?? 0),
  });
}

function scheduleLlmChartsRender(data, top10, options = {}) {
  cancelScheduledLlmCharts();
  if (!llmChartsExpanded) {
    destroyLlmCharts();
    return;
  }

  const signature = options.signature || getLlmChartSignature(top10, data?.llm_analysis);
  if (!signature) {
    destroyLlmCharts();
    return;
  }

  llmChartsRenderFrame = requestAnimationFrame(() => {
    llmChartsRenderFrame = 0;
    renderLlmCharts(data, top10, { signature });
  });
}

function syncLlmChartShell() {
  const toggle = document.querySelector("[data-llm-charts-toggle]");
  const shell = document.getElementById("llm-dashboard-charts");
  if (!toggle || !shell) return;

  const chartShell = shell.closest(".llm-chart-shell");
  if (chartShell) {
    chartShell.classList.toggle("is-open", !!llmChartsExpanded);
    chartShell.classList.toggle("is-collapsed", !llmChartsExpanded);
  }

  shell.hidden = !llmChartsExpanded;
  shell.classList.toggle("is-hidden", !llmChartsExpanded);
  shell.style.display = llmChartsExpanded ? "" : "none";
  toggle.textContent = llmChartsExpanded ? "Ẩn biểu đồ AI" : "Hiện biểu đồ AI";
  toggle.setAttribute("aria-expanded", llmChartsExpanded ? "true" : "false");
}

function handleLlmViewportChange() {
  if (!lastRes?.llm_analysis || llmChartsManual) return;

  const shouldExpand = !prefersCompactLlmLayout();
  if (llmChartsExpanded === shouldExpand) return;

  llmChartsExpanded = shouldExpand;
  syncLlmChartShell();

  if (llmChartsExpanded) {
    scheduleLlmChartsRender(lastRes, getTopRankedItems(lastRes));
    return;
  }

  cancelScheduledLlmCharts();
  destroyLlmCharts();
}

function toggleLlmCopy(key) {
  if (!key) return;

  if (llmExpandedTextKeys.has(key)) {
    llmExpandedTextKeys.delete(key);
  } else {
    llmExpandedTextKeys.add(key);
  }

  const wrapper = document.querySelector(`[data-llm-copy-key="${CSS.escape(key)}"]`);
  if (!wrapper) return;

  const isExpanded = llmExpandedTextKeys.has(key);
  wrapper.classList.toggle("is-expanded", isExpanded);
  wrapper.classList.toggle("is-clamped", !isExpanded);

  const button = wrapper.querySelector("[data-llm-toggle]");
  if (!button) return;
  button.textContent = isExpanded ? "Thu gọn" : "Xem thêm";
  button.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function toggleLlmChartsExpanded() {
  if (!lastRes?.llm_analysis) return;

  llmChartsManual = true;
  llmChartsExpanded = !llmChartsExpanded;
  syncLlmChartShell();

  if (llmChartsExpanded) {
    scheduleLlmChartsRender(lastRes, getTopRankedItems(lastRes));
    return;
  }

  cancelScheduledLlmCharts();
  destroyLlmCharts();
}

function renderExpandableLlmCopy(text, options = {}) {
  const fallback = options.fallback || "";
  const finalText = String(text || "").trim() || fallback;
  const variant = options.variant || "summary";
  const limit = options.limit ?? 280;
  const key = options.key || `${variant}-${finalText.slice(0, 32)}`;
  const isExpandable = finalText.length > limit;
  const isExpanded = !isExpandable || llmExpandedTextKeys.has(key);

  return `
    <div
      class="llm-copy-block llm-copy-block--${variant} ${isExpanded ? "is-expanded" : "is-clamped"}"
      data-llm-copy-key="${escapeHtml(key)}">
      <p class="${escapeHtml(options.className || "llm-summary-copy")}">${escapeHtml(finalText)}</p>
      ${isExpandable
        ? `<button
            class="llm-inline-toggle"
            type="button"
            data-llm-toggle="${escapeHtml(key)}"
            aria-expanded="${isExpanded ? "true" : "false"}">
            ${isExpanded ? "Thu gọn" : "Xem thêm"}
          </button>`
        : ""}
    </div>`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RENDER KẾT QUẢ
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderAll(data) {
  lastRes = data;
  resetLlmSectionState();
  compareSelection = [];
  compareResult = null;
  closeCompareModal(true);

  document.getElementById("results-wrap").classList.add("show");

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

  const top10 = data.ranked.slice(0, 10);
  const refer = data.ranked.slice(10, 15);

  renderDecisionDossier(data, top10);
  renderTop10(top10);
  renderCompareToolbar(top10);
  renderRefer(refer);
  renderLlmInsights(data, top10);
  scheduleLlmChartsRender(data, top10);
  renderCharts(weights, top10);
  hydrateStaticMathCopy();
  renderMathInScope(document);
  renderAltMatrix(top10);

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
  const dominantCriterion = [...weights].sort(
    (left, right) => right.weight - left.weight,
  )[0];
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

function getApartmentThumbnail(ch) {
  if (typeof ch?.thumbnail_src !== "string") return null;
  const src = ch.thumbnail_src.trim();
  return src || null;
}

function getApartmentImageSources(ch) {
  if (!Array.isArray(ch?.image_srcs)) return [];

  const unique = [];
  const seen = new Set();

  ch.image_srcs.forEach((value) => {
    if (typeof value !== "string") return;
    const src = value.trim();
    if (!src || seen.has(src)) return;
    seen.add(src);
    unique.push(src);
  });

  return unique;
}

function getApartmentGallery(ch) {
  const gallery = [];
  const seen = new Set();
  const thumbnail = getApartmentThumbnail(ch);

  if (thumbnail) {
    seen.add(thumbnail);
    gallery.push(thumbnail);
  }

  getApartmentImageSources(ch).forEach((src) => {
    if (seen.has(src)) return;
    seen.add(src);
    gallery.push(src);
  });

  return gallery;
}

function renderListingThumb(ch, title, variant = "rank") {
  const src = getApartmentThumbnail(ch);
  const alt = escapeHtml(title || "Căn hộ");
  const className =
    variant === "refer"
      ? "listing-thumb listing-thumb--refer"
      : "listing-thumb listing-thumb--rank";

  return `
    <div class="${className}${src ? "" : " is-empty"}">
      ${
        src
          ? `<img src="${escapeHtml(src)}" alt="Ảnh ${alt}" loading="lazy" onerror="this.parentElement.classList.add('is-empty'); this.remove()">`
          : ""
      }
      <span class="listing-thumb-fallback">Chưa có ảnh</span>
    </div>`;
}

function renderGalleryFrame(src, title, className) {
  return `
    <div class="${className}">
      <img src="${escapeHtml(src)}" alt="Ảnh ${escapeHtml(title || "căn hộ")}" onerror="this.parentElement.classList.add('is-empty'); this.remove()">
      <span class="listing-thumb-fallback">Chưa tải được ảnh</span>
    </div>`;
}

function renderDetailGallery(ch) {
  const gallery = getApartmentGallery(ch);
  modalGalleryImages = gallery;
  activeModalImageIndex = 0;

  if (!gallery.length) {
    return `
      <div class="detail-gallery detail-gallery--empty">
        <div class="detail-gallery-empty">
          <span class="detail-gallery-empty-title">Chưa có ảnh cho tin này</span>
          <span class="detail-gallery-empty-copy">Hệ thống sẽ hiển thị gallery ngay khi crawler lấy được ảnh hoặc có đường dẫn nguồn hợp lệ.</span>
        </div>
      </div>`;
  }

  return `
    <div class="detail-gallery">
      <div class="detail-gallery-hero" id="detail-gallery-hero">
        ${renderGalleryFrame(gallery[0], ch.title, "detail-gallery-hero-media")}
      </div>
      ${
        gallery.length > 1
          ? `<div class="detail-gallery-strip" aria-label="Danh sách ảnh căn hộ">
              ${gallery
                .map(
                  (src, index) => `
                    <button
                      type="button"
                      class="detail-gallery-thumb${index === 0 ? " is-active" : ""}"
                      data-gallery-index="${index}"
                      aria-label="Xem ảnh ${index + 1}"
                      aria-pressed="${index === 0 ? "true" : "false"}"
                    >
                      ${renderGalleryFrame(src, `${ch.title || "Căn hộ"} ${index + 1}`, "detail-gallery-thumb-media")}
                    </button>`,
                )
                .join("")}
            </div>`
          : ""
      }
    </div>`;
}

function setActiveModalImage(index) {
  if (!modalGalleryImages.length) return;

  activeModalImageIndex = Math.max(
    0,
    Math.min(index, modalGalleryImages.length - 1),
  );

  const modalBody = document.getElementById("modal-body");
  const hero = modalBody?.querySelector("#detail-gallery-hero");
  const title = document.getElementById("modal-ttl")?.textContent || "Căn hộ";
  if (hero) {
    hero.innerHTML = renderGalleryFrame(
      modalGalleryImages[activeModalImageIndex],
      title,
      "detail-gallery-hero-media",
    );
  }

  modalBody?.querySelectorAll(".detail-gallery-thumb").forEach((button) => {
    const buttonIndex = Number(button.dataset.galleryIndex);
    const isActive = buttonIndex === activeModalImageIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
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
      const actions = card.querySelector(".rc-actions");
      if (actions) {
        actions.appendChild(action);
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
    if (s.includes("sổ đỏ") || s.includes("sổ hồng")) return `<span class="tag tag-g">Sổ đỏ/Hồng</span>`;
    if (s.includes("giấy tờ")) return `<span class="tag tag-a">Giấy tờ</span>`;
    if (s.includes("hợp đồng")) return `<span class="tag tag-gray">HĐ mua bán</span>`;
    return "";
  }

  const medals = ["🥇", "🥈", "🥉"];
  const numCls = ["n1", "n2", "n3"];
  const cardCls = { 1: "rank1", 2: "rank2", 3: "rank3" };
  const selectedIds = new Set(compareSelection);

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
      const isSelected = selectedIds.has(ch.id);

      return `
        <div class="rank-card ${isTop3 ? "top3 " : ""}${cc} ${isSelected ? "compare-selected" : ""}" onclick="openModal(${r - 1}, this)" tabindex="0" role="button" aria-label="${ariaLabel}" data-canho-id="${ch.id}">
            <div class="rc-num ${nc}">${label}</div>
            ${renderListingThumb(ch, ch.title, "rank")}
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
                <div class="rc-actions">
                    <button class="compare-toggle ${isSelected ? "is-active" : ""}" type="button" aria-pressed="${isSelected}" onclick="event.stopPropagation(); toggleCompareSelection(${ch.id}, this)">
                        <span>${isSelected ? "Đã chọn so sánh" : "Chọn so sánh"}</span>
                        <span class="compare-toggle-count">${isSelected ? compareSelection.indexOf(ch.id) + 1 : "+"}</span>
                    </button>
                </div>
            </div>
        </div>`;
    })
    .join("");

  document.getElementById("top10-grid").innerHTML = html;
  decorateResultCards("top10-grid", top10, "rc-action");
  document.getElementById("rank-title").textContent = `Top 10 phương án phù hợp nhất`;
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
      const fullName = ch.title || "—";
      const shortName = getCompareCompactName(item, 34) || fullName;
      const priceText = ch.gia_ty ? `${ch.gia_ty} tỷ` : "Chưa có giá";
      const priceMeta = ch.gia_per_m2 ? `${ch.gia_per_m2} tr/m²` : "";
      const projectName = getApartmentProjectName(ch);
      const locationText =
        [ch.phuong, projectName].filter(Boolean).join(" · ") || "Vị trí đang cập nhật";
      const featureBits = [
        `${ch.dien_tich || "?"}m²`,
        `${ch.so_phong_ngu || 0}PN`,
        ch.so_phong_wc ? `${ch.so_phong_wc}WC` : "",
      ].filter(Boolean);
      return `
        <div class="refer-card" onclick="openModal(${item.rank - 1}, this)">
            ${renderListingThumb(ch, ch.title, "refer")}
            <div class="refer-body">
              <div class="refer-topline">
                <div class="refer-rank">Hạng #${item.rank}</div>
                <div class="refer-scorebox">
                  <div class="refer-score">${pct}</div>
                  <div class="refer-score-label">điểm</div>
                </div>
              </div>
              <div class="refer-main">
                <div class="refer-name" title="${escapeHtml(fullName)}">${escapeHtml(shortName)}</div>
                <div class="refer-price-row">
                  <div class="refer-price">${escapeHtml(priceText)}</div>
                  ${priceMeta ? `<div class="refer-price-note">${escapeHtml(priceMeta)}</div>` : ""}
                </div>
                <div class="refer-meta">${escapeHtml(locationText)}</div>
              </div>
              <div class="refer-chip-row">
                ${featureBits
                  .map((bit) => `<span class="refer-chip">${escapeHtml(bit)}</span>`)
                  .join("")}
              </div>
            </div>
        </div>`;
    })
    .join("");
  decorateResultCards("refer-grid", refer);
}

// ── Biểu đồ ────────────────────────────────────────────────────────
function renderCompareToolbar(top10 = getTop10ComparePool()) {
  const toolbar = document.getElementById("compare-toolbar");
  const copy = document.getElementById("compare-toolbar-copy");
  const clearBtn = document.getElementById("compare-clear-btn");
  const runBtn = document.getElementById("compare-run-btn");
  const llmEnabled = document.getElementById("llm-enabled")?.checked ?? true;
  if (!toolbar || !copy || !clearBtn || !runBtn) return;

  if (!top10?.length) {
    toolbar.style.display = "none";
    clearBtn.disabled = true;
    runBtn.disabled = true;
    return;
  }

  toolbar.style.display = "";
  clearBtn.disabled = compareSelection.length === 0;
  runBtn.disabled =
    !llmEnabled || compareSelection.length < 2 || compareSelection.length > 4;

  if (!llmEnabled) {
    copy.textContent = "Bật góc nhìn AI để dùng chế độ so sánh này.";
  } else if (compareSelection.length === 0) {
    copy.textContent = "Chọn 2-4 căn trong Top 10 để so sánh bằng AI.";
  } else if (compareSelection.length === 1) {
    copy.textContent = "Đã chọn 1/4 căn. Chọn thêm ít nhất 1 căn nữa để bắt đầu so sánh.";
  } else {
    copy.textContent = `Đã chọn ${compareSelection.length}/4 căn. Có thể mở modal so sánh ngay.`;
  }
}

function getTop10ComparePool() {
  return lastRes?.ranked?.slice(0, 10) || [];
}

function getCompareItems() {
  const selectedIds = new Set(compareSelection);
  return getTop10ComparePool().filter((item) => selectedIds.has(item.canho.id));
}

function toggleCompareSelection(canhoId) {
  const existingIndex = compareSelection.indexOf(canhoId);
  if (existingIndex >= 0) {
    compareSelection.splice(existingIndex, 1);
  } else {
    if (compareSelection.length >= 4) {
      showErr("Bạn chỉ có thể so sánh tối đa 4 căn trong một lần.");
      return;
    }
    compareSelection.push(canhoId);
  }

  compareResult = null;
  renderTop10(getTop10ComparePool());
  renderCompareToolbar();
}

function clearCompareSelection() {
  compareSelection = [];
  compareResult = null;
  renderTop10(getTop10ComparePool());
  renderCompareToolbar();
}

async function runCompareSelection() {
  if (!(document.getElementById("llm-enabled")?.checked ?? true)) {
    showErr("Hãy bật góc nhìn AI trước khi so sánh.");
    return;
  }

  const selectedItems = getCompareItems();
  if (selectedItems.length < 2 || selectedItems.length > 4) {
    showErr("Hãy chọn từ 2 đến 4 căn trong Top 10 để so sánh.");
    return;
  }

  showLoad("Đang so sánh các căn hộ đã chọn...");
  showErr("");
  try {
    const llmModel = getCurrentLlmModel();
    const response = await fetch(API + "/ahp/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: lastRes.session_id,
        canho_ids: selectedItems.map((item) => item.canho.id),
        llm_model: llmModel,
      }),
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ detail: "Lỗi không xác định" }));
      throw new Error(payload?.detail?.msg || payload?.detail || `HTTP ${response.status}`);
    }

    compareResult = await response.json();
    hideLoad();
    openCompareModal(document.getElementById("compare-run-btn"));
  } catch (error) {
    hideLoad();
    showErr("Lỗi: " + error.message);
  }
}

function destroyCompareCharts() {
  if (compareSupportChart) {
    compareSupportChart.destroy();
    compareSupportChart = null;
  }
  if (compareRadarChart) {
    compareRadarChart.destroy();
    compareRadarChart = null;
  }
}

function getCompareInsight(canhoId) {
  return compareResult?.apartments?.find((item) => item.canho_id === canhoId) || null;
}

function getCompareDisplayName(item) {
  return (
    item?.canho?.title?.trim() ||
    getApartmentProjectName(item?.canho) ||
    `Căn #${item?.rank ?? "?"}`
  );
}

function truncateCompareText(text, maxLength = 72) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.length <= maxLength) return value;

  const sliced = value.slice(0, maxLength);
  const cutAt = Math.max(sliced.lastIndexOf(" "), sliced.lastIndexOf(","));
  return `${(cutAt > maxLength * 0.55 ? sliced.slice(0, cutAt) : sliced).trim()}...`;
}

function getCompareShortName(item, maxLength = 58) {
  return truncateCompareText(getCompareDisplayName(item), maxLength);
}

function getCompareCompactName(item, maxLength = 42) {
  const ch = item?.canho || {};
  const projectName = (
    getApartmentProjectName(ch) ||
    ch?.du_an ||
    ""
  )
    .replace(/^chung cư\s*/i, "")
    .replace(/^căn hộ\s*/i, "")
    .trim();

  const bedrooms = ch?.so_phong_ngu ? `${ch.so_phong_ngu}PN` : "";
  const compactLabel = [bedrooms, projectName].filter(Boolean).join(" ");
  if (compactLabel) {
    return truncateCompareText(`Căn ${compactLabel}`, maxLength);
  }

  const cleanedTitle = getCompareDisplayName(item)
    .replace(/^duy nhất,\s*/i, "")
    .replace(/^bán\s*/i, "")
    .replace(/^căn hộ\s*/i, "")
    .replace(/^căn\s*/i, "Căn ")
    .trim();

  return truncateCompareText(cleanedTitle || getCompareDisplayName(item), maxLength);
}

function getCompareLivingHeadline(items, analysis) {
  const llmWinnerEntry = getCompareLlmWinnerEntry(items, analysis);
  const ahpWinner = getCompareAhpWinner(items);
  const target = llmWinnerEntry?.item || ahpWinner;
  if (!target) return "Nhận định cho nhu cầu ở thực";
  return `${getCompareCompactName(target, 34)} phù hợp để ở hơn`;
}

function getCompareLivingBrief(items, analysis) {
  const baseText =
    analysis?.winner_reason ||
    analysis?.summary ||
    analysis?.error ||
    "Tạm thời chưa đủ dữ liệu AI. Hãy ưu tiên nhìn vào pháp lý, không gian sống và tiện ích phục vụ ở thực.";

  return truncateCompareText(baseText, 190);
}

function getComparePriceText(ch) {
  return ch?.gia_ty ? `${ch.gia_ty} tỷ` : "Chưa có giá";
}

function getComparePriceMeta(ch) {
  return ch?.gia_per_m2 ? `${ch.gia_per_m2} tr/m²` : "Chưa có giá/m²";
}

function getCompareAhpWinner(items) {
  return [...items].sort((left, right) => left.rank - right.rank)[0] || null;
}

function getCompareAhpRunnerUp(items) {
  return [...items].sort((left, right) => left.rank - right.rank)[1] || null;
}

function getCompareLlmWinnerEntry(items, analysis) {
  if (analysis?.status !== "success") return null;

  const entries = items
    .map((item) => ({
      item,
      insight:
        analysis?.apartments?.find((entry) => entry.canho_id === item.canho.id) || null,
    }))
    .filter((entry) => entry.insight);

  if (!entries.length) return null;

  return (
    entries.find((entry) => entry.item.canho.id === analysis.winner_id) ||
    [...entries].sort(
      (left, right) =>
        (right.insight?.llm_support_score ?? 0) -
        (left.insight?.llm_support_score ?? 0),
    )[0]
  );
}

function getCompareAgreementState(items, analysis) {
  const ahpWinner = getCompareAhpWinner(items);
  const llmWinnerEntry = getCompareLlmWinnerEntry(items, analysis);

  if (!ahpWinner || analysis?.status !== "success" || !llmWinnerEntry) {
    return {
      tone: "limited",
      label: "AI chưa sẵn sàng để đối chiếu",
      body: "Bạn vẫn có thể dựa vào xếp hạng AHP và thông tin thương mại bên dưới để chốt shortlist trước.",
    };
  }

  if (ahpWinner.canho.id === llmWinnerEntry.item.canho.id) {
    return {
      tone: "aligned",
      label: `AHP + AI cùng nghiêng về ${getCompareDisplayName(ahpWinner)}`,
      body: "Hai góc nhìn đang đồng thuận. Đây là căn nên ưu tiên kiểm tra thực địa trước.",
    };
  }

  return {
    tone: "diverged",
    label: "AHP và AI đang khác góc nhìn",
    body: `AHP nghiêng về ${getCompareDisplayName(ahpWinner)}, trong khi AI đánh giá cao ${getCompareDisplayName(llmWinnerEntry.item)}.`,
  };
}

function getCompareSnapshotHighlights(item, insight) {
  const highlights = [];

  if (insight?.verdict) highlights.push(insight.verdict);
  if (highlights.length < 2 && insight?.strengths?.[0]) {
    highlights.push(insight.strengths[0]);
  }
  if (highlights.length < 2 && insight?.risks?.[0]) {
    highlights.push(`Lưu ý: ${insight.risks[0]}`);
  }
  if (highlights.length < 2 && item?.canho?.phap_ly) {
    highlights.push(`Pháp lý: ${item.canho.phap_ly}`);
  }
  if (highlights.length < 2 && item?.canho?.noi_that) {
    highlights.push(`Nội thất: ${item.canho.noi_that}`);
  }
  if (!highlights.length) {
    highlights.push("Chưa có thêm ghi chú nổi bật cho căn này.");
  }

  return highlights.slice(0, 2);
}

function toggleCompareDetail(canhoId) {
  const body = document.getElementById("compare-modal-body");
  const detail = body?.querySelector(`[data-compare-detail="${canhoId}"]`);
  const button = body?.querySelector(`[data-compare-expand="${canhoId}"]`);
  if (!detail || !button) return;

  const isHidden = detail.hasAttribute("hidden");
  if (isHidden) {
    detail.removeAttribute("hidden");
  } else {
    detail.setAttribute("hidden", "");
  }

  button.setAttribute("aria-expanded", String(isHidden));
  button.classList.toggle("is-open", isHidden);
  const label = button.querySelector("[data-expand-label]");
  if (label) {
    label.textContent = isHidden
      ? "Thu gọn phân tích"
      : "Xem phân tích chi tiết";
  }
  const icon = button.querySelector("[data-expand-icon]");
  if (icon) {
    icon.textContent = isHidden ? "−" : "+";
  }
}

function openCompareModal(triggerEl) {
  const modal = document.getElementById("compare-modal");
  const body = document.getElementById("compare-modal-body");
  const title = document.getElementById("compare-modal-ttl");
  const items = getCompareItems();
  if (!modal || !body || !title || !items.length || !compareResult) return;

  lastCompareTrigger = triggerEl || document.activeElement;
  title.textContent = `So sánh ${items.length} căn hộ`;
  body.innerHTML = buildCompareModalMarkup(items, compareResult);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modal.querySelector(".modal")?.scrollTo({ top: 0, behavior: "auto" });
  renderCompareModalCharts(items, compareResult);
}

function closeCompareModal(skipFocus = false) {
  const modal = document.getElementById("compare-modal");
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  destroyCompareCharts();
  if (!document.getElementById("modal")?.classList.contains("open")) {
    document.body.style.overflow = "";
  }
  if (!skipFocus && lastCompareTrigger && typeof lastCompareTrigger.focus === "function") {
    lastCompareTrigger.focus();
  }
}

function buildCompareModalMarkup(items, analysis) {
  const ahpWinner = getCompareAhpWinner(items);
  const ahpRunnerUp = getCompareAhpRunnerUp(items);
  const llmWinnerEntry = getCompareLlmWinnerEntry(items, analysis);
  const gapPct =
    ahpWinner && ahpRunnerUp
      ? ((Number(ahpWinner.ahp_score) - Number(ahpRunnerUp.ahp_score)) * 100).toFixed(2)
      : "0.00";
  const insights = items.map((item) => ({
    item,
    insight: analysis?.apartments?.find((entry) => entry.canho_id === item.canho.id) || null,
  }));
  const tradeoffs =
    analysis.status === "success" && analysis.tradeoffs?.length
      ? analysis.tradeoffs
      : [
          analysis.status === "success"
            ? "AI chưa trả trade-off cụ thể cho nhóm căn này."
            : "AI tạm thời chưa sẵn sàng. Hãy ưu tiên đối chiếu AHP, giá, vị trí và pháp lý trước.",
        ];
  const compactTradeoffs = tradeoffs
    .slice(0, 3)
    .map((entry) => truncateCompareText(entry, 120));
  const ahpWinnerShort = ahpWinner ? getCompareShortName(ahpWinner, 42) : "Chưa xác định";
  const llmWinnerShort = llmWinnerEntry
    ? getCompareShortName(llmWinnerEntry.item, 42)
    : "AI chưa kết luận";
  const livingHeadline = getCompareLivingHeadline(items, analysis);
  const livingBrief = getCompareLivingBrief(items, analysis);
  const tradeoffLead =
    compactTradeoffs.length > 0
      ? "Đây là những điểm nên cân nhắc kỹ trước khi chốt căn để ở lâu dài."
      : "Hiện chưa có thêm lưu ý nổi bật cho nhu cầu ở thực.";

  const apartmentCards = insights
    .map(({ item, insight }) => {
      const isAhpWinner = ahpWinner?.canho?.id === item.canho.id;
      const isLlmWinner = llmWinnerEntry?.item?.canho?.id === item.canho.id;
      const isAgreedWinner = isAhpWinner && isLlmWinner;
      const detailId = `compare-detail-${item.canho.id}`;
      const location = getApartmentLocation(item.canho) || item.canho.du_an || "Chưa có vị trí";
      const highlights = getCompareSnapshotHighlights(item, insight);
      const badgeText = isAgreedWinner
        ? "AHP + AI đồng thuận"
        : isAhpWinner
          ? "AHP dẫn đầu"
          : isLlmWinner
            ? "AI chọn"
            : "";
      const fullName = getCompareDisplayName(item);
      const shortName = getCompareShortName(item);
      const aiScore = insight ? Math.round(insight.llm_support_score) : "—";
      const ahpScore = (Number(item.ahp_score || 0) * 100).toFixed(1);

      return `
        <article class="compare-apartment-card ${isAgreedWinner ? "is-agreed-winner" : isLlmWinner ? "is-winner" : ""}">
          <div class="compare-apartment-topline">
            <div class="compare-apartment-badges">
              ${badgeText ? `<span class="compare-inline-chip ${isAgreedWinner ? "compare-inline-chip--strong" : isLlmWinner ? "compare-inline-chip--accent" : ""}">${badgeText}</span>` : ""}
            </div>
            <button
              type="button"
              class="compare-expand-toggle"
              data-compare-expand="${item.canho.id}"
              aria-expanded="false"
              aria-controls="${detailId}">
              <span data-expand-label>Xem phân tích chi tiết</span>
              <span class="compare-expand-icon" data-expand-icon aria-hidden="true">+</span>
            </button>
          </div>
          <div class="compare-apartment-head">
            <div>
              <h3 class="compare-apartment-title compare-name-clamp" title="${escapeHtml(fullName)}">${escapeHtml(shortName)}</h3>
              <p class="compare-apartment-sub">${escapeHtml(location)}</p>
            </div>
          </div>
          <div class="compare-winner-strip">
            <div class="compare-winner-metric">
              <span class="compare-winner-label">AHP</span>
              <strong>#${item.rank}</strong>
              <span>${ahpScore}/100</span>
            </div>
            <div class="compare-winner-metric">
              <span class="compare-winner-label">AI</span>
              <strong>${aiScore}</strong>
              <span>${insight ? "điểm hỗ trợ" : "chưa sẵn sàng"}</span>
            </div>
          </div>
          <div class="compare-snapshot-meta">
            <span class="compare-meta-chip">${escapeHtml(getComparePriceText(item.canho))}</span>
            <span class="compare-meta-chip">${escapeHtml(getComparePriceMeta(item.canho))}</span>
            <span class="compare-meta-chip compare-meta-chip--muted">${escapeHtml(location)}</span>
          </div>
          <ul class="compare-snapshot-list">
            ${highlights.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
          </ul>
          <div class="compare-apartment-detail" id="${detailId}" data-compare-detail="${item.canho.id}" hidden>
            ${
              insight
                ? `
                  <div class="compare-detail-grid">
                    <div class="compare-detail-card">
                      <div class="compare-section-title">Điểm cộng để ở</div>
                      <ul class="compare-meta-list">
                        ${(insight.strengths.length ? insight.strengths : ["Chưa có ghi chú nổi bật."])
                          .map((entry) => `<li>${escapeHtml(entry)}</li>`)
                          .join("")}
                      </ul>
                    </div>
                    <div class="compare-detail-card">
                      <div class="compare-section-title">Điểm yếu / rủi ro</div>
                      <ul class="compare-meta-list">
                        ${(insight.risks.length ? insight.risks : ["Chưa có cảnh báo bổ sung."])
                          .map((entry) => `<li>${escapeHtml(entry)}</li>`)
                          .join("")}
                      </ul>
                    </div>
                  </div>
                  <div class="compare-section-title compare-section-title--detail">8 tiêu chí AI</div>
                  <div class="compare-criteria-grid">
                    ${CRIT.map((criterion) => {
                      const score = Math.round(insight.criterion_scores?.[criterion.id] ?? 0);
                      const tone = getCompareCriterionTone(
                        insights.filter((entry) => entry.insight),
                        criterion.id,
                        score,
                      );
                      const toneLabel =
                        tone === "high" ? "Nổi trội" : tone === "low" ? "Yếu hơn" : "Trung tính";

                      return `
                        <div class="compare-criterion-pill ${tone === "high" ? "is-high" : tone === "low" ? "is-low" : ""}">
                          <div class="compare-criterion-label">
                            <span>${escapeHtml(criterion.name)}</span>
                            <span class="compare-criterion-note">${toneLabel}</span>
                          </div>
                          <div class="compare-criterion-score">${score}/100</div>
                        </div>`;
                    }).join("")}
                  </div>
                `
                : `
                  <div class="compare-detail-empty">
                    <div class="compare-section-title">AI chưa sẵn sàng</div>
                    <p class="compare-warning-copy">
                      Hãy tạm ưu tiên pháp lý, không gian sống và tiện ích phục vụ sinh hoạt hằng ngày của căn này trong khi chờ phản hồi từ AI.
                    </p>
                  </div>
                `
            }
          </div>
        </article>`;
    })
    .join("");

  return `
    <section class="compare-living-brief ${analysis.status !== "success" ? "is-warning" : ""}">
      <div class="compare-living-label">Nhận định cho nhu cầu ở thực</div>
      <h2 class="compare-living-title">${escapeHtml(livingHeadline)}</h2>
      <p class="compare-living-copy">${escapeHtml(livingBrief)}</p>
    </section>

    <article class="compare-summary-card compare-summary-card--tradeoff compare-summary-card--priority">
      <div class="compare-summary-title">Điểm cần cân nhắc khi chọn để ở</div>
      <p class="compare-tradeoff-lead">${escapeHtml(tradeoffLead)}</p>
      <ul class="compare-tradeoff-list">
        ${compactTradeoffs.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
      </ul>
    </article>

    <div class="compare-decision-grid compare-decision-grid--after-brief">
      <article class="compare-decision-card compare-decision-card--ahp">
        <div class="compare-summary-title">Kết luận AHP</div>
        <div class="compare-decision-name compare-name-clamp" title="${escapeHtml(getCompareDisplayName(ahpWinner))}">${escapeHtml(ahpWinnerShort)}</div>
        <div class="compare-decision-metrics">
          <span class="compare-decision-metric">Hạng #${ahpWinner?.rank ?? "?"}</span>
          <span class="compare-decision-metric">${((Number(ahpWinner?.ahp_score || 0)) * 100).toFixed(1)}/100</span>
        </div>
        <p class="compare-summary-copy">
          ${
            ahpRunnerUp
              ? `Đang dẫn đầu với chênh lệch ${gapPct}% so với lựa chọn kế tiếp.`
              : "AHP đang chỉ ra một lựa chọn dẫn đầu trong nhóm căn đang xem."
          }
        </p>
      </article>
      <article class="compare-decision-card compare-decision-card--llm ${analysis.status !== "success" ? "is-muted" : ""}">
        <div class="compare-summary-title">Kết luận AI</div>
        <div class="compare-decision-name compare-name-clamp" ${llmWinnerEntry ? `title="${escapeHtml(getCompareDisplayName(llmWinnerEntry.item))}"` : ""}>
          ${
            llmWinnerEntry
              ? escapeHtml(llmWinnerShort)
              : "AI cần thêm dữ liệu để đánh giá rõ hơn"
          }
        </div>
        <div class="compare-decision-metrics">
          <span class="compare-decision-metric">
            ${
              llmWinnerEntry
                ? `Phù hợp để ở ${Math.round(llmWinnerEntry.insight.llm_support_score)}/100`
                : "Cần thêm dữ liệu"
            }
          </span>
        </div>
        <p class="compare-summary-copy">
          ${escapeHtml(
            truncateCompareText(
            analysis.status === "success"
              ? analysis.winner_reason || analysis.summary || "AI chưa có đủ dữ liệu để giải thích rõ hơn ở bước này."
              : analysis.error || "Bạn vẫn có thể dựa vào kết quả AHP để tiếp tục shortlist.",
            150,
            ),
          )}
        </p>
      </article>
    </div>

    <section class="compare-deep-dive">
      <div class="compare-deep-head">
        <div>
          <div class="compare-summary-title">Snapshot từng căn</div>
          <p class="compare-warning-copy">Mỗi card ưu tiên phần quyết định trước, phần chi tiết có thể mở khi cần.</p>
        </div>
      </div>
      <div class="compare-apartment-grid">${apartmentCards}</div>
    </section>

    <section class="compare-deep-dive">
      <div class="compare-deep-head">
        <div>
          <div class="compare-summary-title">Dữ liệu chi tiết</div>
          <p class="compare-warning-copy">
            ${
              analysis.status === "success"
                ? "Xem biểu đồ để kiểm tra nhanh độ chênh giữa các căn sau khi đã đọc kết luận."
                : "AI chưa trả dữ liệu biểu đồ. Hãy dùng phần snapshot phía trên để đọc nhanh theo AHP."
            }
          </p>
        </div>
      </div>
      ${
        analysis.status === "success"
          ? `
            <div class="compare-chart-grid">
              <article class="compare-chart-card">
                <div class="compare-section-title">So sánh lực hỗ trợ của AI</div>
                <canvas id="compare-support-chart" height="220"></canvas>
              </article>
              <article class="compare-chart-card">
                <div class="compare-section-title">Chân dung 8 tiêu chí theo AI</div>
                <p class="compare-chart-hint">Nhấn vào tên căn trong chú thích bên dưới để ẩn hoặc hiện trên biểu đồ.</p>
                <canvas id="compare-radar-chart" height="220"></canvas>
              </article>
            </div>
          `
          : `
            <article class="compare-chart-card compare-chart-card--placeholder">
              <div class="compare-section-title">Biểu đồ chưa khả dụng</div>
              <p class="compare-warning-copy">
                Phản hồi AI chưa hoàn tất nên chưa thể dựng chart. AHP vẫn là trục quyết định chính cho lần so sánh này.
              </p>
            </article>
          `
      }
    </section>`;
}

function getCompareCriterionTone(entries, criterionId, targetScore) {
  const values = entries.map((entry) => Math.round(entry.insight.criterion_scores?.[criterionId] ?? 0));
  if (!values.length) return "neutral";

  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return "neutral";
  if (targetScore === max) return "high";
  if (targetScore === min) return "low";
  return "neutral";
}

function renderCompareModalCharts(items, analysis) {
  destroyCompareCharts();
  if (analysis.status !== "success") return;

  const insights = items
    .map((item) => ({ item, insight: getCompareInsight(item.canho.id) }))
    .filter((entry) => entry.insight);
  if (!insights.length) return;

  const labels = insights.map(({ item }) => getCompareShortName(item, 26));
  const winnerId = analysis.winner_id;
  const supportCanvas = document.getElementById("compare-support-chart");
  const radarCanvas = document.getElementById("compare-radar-chart");
  if (!supportCanvas || !radarCanvas) return;

  compareSupportChart = new Chart(supportCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Điểm hỗ trợ AI",
          data: insights.map(({ insight }) => insight.llm_support_score),
          backgroundColor: insights.map(({ item }) =>
            item.canho.id === winnerId ? "#c8922a" : "#1a3a5c",
          ),
          borderRadius: 8,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (value) => `${value}` },
        },
        x: {
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            font: { size: 11 },
          },
          grid: { display: false },
        },
      },
    },
  });

  const palette = [
    { border: "#1a3a5c", fill: "rgba(26, 58, 92, .12)" },
    { border: "#4f7d57", fill: "rgba(79, 125, 87, .12)" },
    { border: "#c8922a", fill: "rgba(200, 146, 42, .12)" },
    { border: "#b34d32", fill: "rgba(179, 77, 50, .12)" },
  ];

  compareRadarChart = new Chart(radarCanvas.getContext("2d"), {
    type: "radar",
    data: {
      labels: CRIT.map((criterion) => criterion.name),
      datasets: insights.map(({ item, insight }, index) => ({
        label: getCompareShortName(item, 28),
        data: CRIT.map((criterion) => insight.criterion_scores?.[criterion.id] ?? 0),
        borderColor: palette[index % palette.length].border,
        backgroundColor: palette[index % palette.length].fill,
        pointBackgroundColor: palette[index % palette.length].border,
        pointRadius: 3,
        fill: true,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 12,
            padding: 12,
            font: { size: 11 },
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 20 },
        },
      },
    },
  });
}
function getLlmApartmentInsight(item, analysis = lastRes?.llm_analysis) {
  if (!analysis?.apartments?.length || !item?.canho?.id) {
    return null;
  }

  return (
    analysis.apartments.find((entry) => entry.canho_id === item.canho.id) ||
    analysis.apartments.find((entry) => entry.rank === item.rank) ||
    null
  );
}

function getTopRankedItems(data = lastRes, limit = 10) {
  if (!Array.isArray(data?.ranked)) return [];
  return data.ranked.slice(0, limit);
}

function getLlmInsightEntries(top10 = getTopRankedItems(), analysis = lastRes?.llm_analysis) {
  return top10
    .map((item) => ({ item, insight: getLlmApartmentInsight(item, analysis) }))
    .filter((entry) => entry.insight);
}

function renderLlmListItems(items, emptyMessage) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const finalItems = safeItems.length ? safeItems : [emptyMessage];
  return finalItems.map((entry) => `<li>${escapeHtml(cleanAiCopy(entry))}</li>`).join("");
}

function cleanAiCopy(text) {
  const source = String(text || "").trim();
  if (!source) return "";

  return source
    .replace(/\(\s*canho[_\s-]*id\s*:?\s*\d+\s*\)/gi, "")
    .replace(/\bcanho[_\s-]*id\s*:?\s*\d+\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function renderLlmApartmentCard(entry, variant = "compact") {
  if (!entry?.item || !entry?.insight) return "";

  const { item, insight } = entry;
  const title =
    item?.canho?.title ||
    item?.canho?.du_an ||
    `Căn hộ #${insight.rank}`;
  const metaBits = [
    item?.canho?.gia_ty ? `${item.canho.gia_ty} tỷ` : "",
    item?.canho?.dien_tich ? `${item.canho.dien_tich} m²` : "",
    item?.canho?.so_phong_ngu ? `${item.canho.so_phong_ngu}PN` : "",
    getApartmentProjectName(item?.canho) || item?.canho?.phuong || "",
  ].filter(Boolean);

  return `
    <article class="llm-apartment-card ${variant === "spotlight" ? "is-spotlight" : "is-compact"}">
      <div class="llm-apartment-head">
        <span class="llm-rank-chip">#${insight.rank}</span>
        <div class="llm-support-score">
          <strong>${Math.round(insight.llm_support_score)}</strong>
          <span>điểm hỗ trợ</span>
        </div>
      </div>
      <div class="llm-card-title">${escapeHtml(title)}</div>
      ${metaBits.length ? `<div class="llm-apartment-facts">${metaBits.map((bit) => `<span class="llm-fact-chip">${escapeHtml(bit)}</span>`).join("")}</div>` : ""}
      ${renderExpandableLlmCopy(cleanAiCopy(insight.verdict), {
        className: "llm-summary-note",
        variant: variant === "spotlight" ? "spotlight" : "compact",
        limit: variant === "spotlight" ? 260 : 180,
        key: `apartment-${insight.canho_id || insight.rank}-${variant}`,
        fallback: "AI chưa trả kết luận ngắn cho căn này.",
      })}
      <div class="llm-apartment-meta">
        <div>
          <div class="llm-section-title">Điểm mạnh</div>
          <ul class="llm-list">
            ${renderLlmListItems(insight.strengths, "Chưa có ghi chú nổi bật.")}
          </ul>
        </div>
        <div>
          <div class="llm-section-title">Rủi ro / cần kiểm tra</div>
          <ul class="llm-list">
            ${renderLlmListItems(insight.risks, "Không có cảnh báo bổ sung từ AI.")}
          </ul>
        </div>
      </div>
    </article>`;
}

function renderLlmEmptyState(title, copy) {
  return `
    <article class="llm-placeholder-card">
      <div class="llm-card-title">${escapeHtml(title)}</div>
      <p class="llm-summary-copy">${escapeHtml(copy)}</p>
    </article>`;
}

function refreshLlmInsightsView() {
  if (!lastRes?.llm_analysis) return;

  const top10 = getTopRankedItems(lastRes);
  cancelScheduledLlmCharts();
  destroyLlmCharts();
  renderLlmInsights(lastRes, top10);

  if (!llmChartsExpanded) return;
  scheduleLlmChartsRender(lastRes, top10);
}

function toggleLlmInsightsExpanded() {
  if (!lastRes?.llm_analysis) return;
  llmInsightsExpanded = !llmInsightsExpanded;
  refreshLlmInsightsView();
}

function renderLlmInsights(data, top10) {
  const section = document.getElementById("llm-insight-section");
  const body = document.getElementById("llm-insight-body");
  if (!section || !body) return;

  const analysis = data?.llm_analysis;
  if (!analysis) {
    section.style.display = "none";
    body.innerHTML = "";
    return;
  }

  section.style.display = "";

  if (analysis.status !== "success") {
    body.innerHTML = `
      <div class="llm-status-card is-warning">
        <div class="llm-status-row">
          <span class="llm-badge llm-badge--warn">${analysis.status === "skipped" ? "AI tạm bỏ qua" : "AI chưa sẵn sàng"}</span>
        </div>
        <p class="llm-error-copy">${escapeHtml(
          cleanAiCopy(analysis.error || "Không có dữ liệu phân tích từ AI cho phiên này."),
        )}</p>
      </div>`;
    return;
  }

  if (!llmChartsManual || llmChartsExpanded === null) {
    llmChartsExpanded = !prefersCompactLlmLayout();
  }

  const insightEntries = getLlmInsightEntries(top10, analysis);
  const spotlightEntry = insightEntries[0] || null;
  const compactEntries = insightEntries.slice(1, 3);
  const extraEntries = insightEntries.slice(3);
  const hasExtraEntries = extraEntries.length > 0;
  const tradeoffs = Array.isArray(analysis.tradeoffs) ? analysis.tradeoffs.map((entry) => cleanAiCopy(entry)) : [];
  const extraLabel = llmInsightsExpanded ? "Thu gọn góc nhìn AI" : `Xem thêm góc nhìn AI (${extraEntries.length})`;

  body.innerHTML = `
    <div class="llm-status-card is-success">
      <div class="llm-status-row">
        <span class="llm-badge">AI hỗ trợ đang hoạt động</span>
      </div>
      <div class="llm-summary-grid">
        <article class="llm-summary-card">
          <div class="llm-summary-title">Tóm tắt chung</div>
          ${renderExpandableLlmCopy(cleanAiCopy(analysis.summary), {
            key: "summary",
            limit: 320,
            fallback: "AI chưa trả tóm tắt tổng quan.",
          })}
        </article>
        <article class="llm-summary-card">
          <div class="llm-summary-title">Vì sao căn đứng đầu đang dẫn trước</div>
          ${renderExpandableLlmCopy(cleanAiCopy(analysis.winner_reason), {
            key: "winner-reason",
            limit: 320,
            fallback: "AI chưa trả lời giải thích cụ thể.",
          })}
        </article>
      </div>
      <article class="llm-tradeoff-card">
        <div class="llm-card-title">Trade-off cần lưu ý</div>
        <ul class="llm-tradeoff-list">
          ${(tradeoffs.length
            ? tradeoffs
            : ["Phân tích AI chưa trả trade-off cụ thể cho phiên này."])
            .map((entry) => `<li>${escapeHtml(entry)}</li>`)
            .join("")}
        </ul>
      </article>
      <span class="llm-badge llm-badge--support">Đánh giá hỗ trợ, không thay thế AHP</span>
    </div>
    ${insightEntries.length
      ? `
        <div class="llm-chart-shell ${llmChartsExpanded ? "is-open" : "is-collapsed"}">
          <div class="llm-chart-shell-head">
            <div class="llm-card-title">Biểu đồ hỗ trợ từ AI</div>
            <button
              class="llm-chart-toggle"
              type="button"
              aria-controls="llm-dashboard-charts"
              data-llm-charts-toggle
              aria-expanded="${llmChartsExpanded ? "true" : "false"}">
              ${llmChartsExpanded ? "Ẩn biểu đồ AI" : "Hiện biểu đồ AI"}
            </button>
          </div>
          <div class="llm-dashboard-charts" id="llm-dashboard-charts" ${llmChartsExpanded ? "" : "hidden"}>
            <div class="chart-box llm-chart-box">
              <div class="chart-lbl">Điểm hỗ trợ từ AI cho nhóm căn đang dẫn đầu</div>
              <div class="llm-chart-stage">
                <canvas id="chart-llm-top10"></canvas>
              </div>
            </div>
            <div class="chart-box llm-chart-box">
              <div class="chart-lbl">Radar 8 tiêu chí của căn dẫn đầu theo AI</div>
              <div class="llm-chart-stage llm-chart-stage--radar">
                <canvas id="chart-llm-radar"></canvas>
              </div>
            </div>
          </div>
        </div>
        <div class="llm-spotlight-row">
          <div class="llm-spotlight-copy">
            <div class="llm-section-kicker">Spotlight căn đang dẫn đầu</div>
            <div class="llm-spotlight-title">Căn đứng đầu đang được AI ủng hộ vì sao?</div>
            <p class="llm-summary-copy">Tập trung vào căn #1 trước để hiểu nhanh lý do nó đang dẫn trước, rồi nhìn hai căn bám đuổi ngay bên dưới để so sánh độ chênh.</p>
          </div>
          ${spotlightEntry ? renderLlmApartmentCard(spotlightEntry, "spotlight") : renderLlmEmptyState("Chưa có spotlight", "AI chưa trả insight theo từng căn hộ cho phiên này.")}
        </div>
        <div class="llm-compact-grid">
          ${compactEntries.length
            ? compactEntries.map((entry) => renderLlmApartmentCard(entry, "compact")).join("")
            : renderLlmEmptyState("Chưa có căn bám đuổi", "Hiện chưa có đủ insight để hiển thị thêm căn #2 và #3.")}
        </div>
        ${hasExtraEntries
          ? `
            <div class="llm-more-shell ${llmInsightsExpanded ? "is-open" : ""}">
              <button
                class="llm-more-toggle"
                type="button"
                data-llm-more-toggle
                aria-expanded="${llmInsightsExpanded ? "true" : "false"}"
                aria-controls="llm-more-grid">
                ${escapeHtml(extraLabel)}
              </button>
              <div class="llm-more-grid" id="llm-more-grid" ${llmInsightsExpanded ? "" : "hidden"}>
                ${extraEntries.map((entry) => renderLlmApartmentCard(entry, "compact")).join("")}
              </div>
            </div>`
          : ""}
      `
      : renderLlmEmptyState("AI chưa có insight theo từng căn", "Phiên này có tóm tắt chung nhưng chưa đủ dữ liệu để tạo góc nhìn chi tiết theo từng căn hộ.")}
    `;

  syncLlmChartShell();
}

function renderLlmCharts(data, top10, options = {}) {
  const analysis = data?.llm_analysis;
  if (!llmChartsExpanded) return;

  if (analysis?.status !== "success" || !analysis.apartments?.length) {
    destroyLlmCharts();
    return;
  }

  const topChartCanvas = document.getElementById("chart-llm-top10");
  const radarChartCanvas = document.getElementById("chart-llm-radar");
  if (!topChartCanvas || !radarChartCanvas) {
    return;
  }

  const insightEntries = getLlmInsightEntries(top10, analysis);
  if (!insightEntries.length) {
    destroyLlmCharts();
    return;
  }

  const signature = options.signature || getLlmChartSignature(top10, analysis);
  if (chLlmTop10 && chLlmRadar && llmChartSignature === signature) {
    return;
  }

  destroyLlmCharts();

  const leadInsight = insightEntries[0].insight;
  const compactLabels = insightEntries.map(({ item, insight }, index) =>
    getCompareCompactName(item, 26) || `#${insight?.rank ?? index + 1}`,
  );

  chLlmTop10 = new Chart(topChartCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: compactLabels,
      datasets: [
        {
          label: "Điểm hỗ trợ AI",
          data: insightEntries.map(({ insight }) => insight.llm_support_score),
          backgroundColor: insightEntries.map((_, index) =>
            index === 0 ? "#c8922a" : index < 3 ? "#1a3a5c" : "#4f7d57",
          ),
          borderRadius: 5,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersCompactLlmLayout() ? false : { duration: 220 },
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}`, color: "#718096" },
          grid: { color: "#f0ede8" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#718096", maxRotation: 0, minRotation: 0 },
        },
      },
    },
  });

  chLlmRadar = new Chart(radarChartCanvas.getContext("2d"), {
    type: "radar",
    data: {
      labels: CRIT.map((criterion) => criterion.name),
      datasets: [
        {
          label: `AI · #${leadInsight?.rank ?? 1}`,
          data: CRIT.map((criterion) => leadInsight?.criterion_scores?.[criterion.id] ?? 0),
          fill: true,
          backgroundColor: "rgba(200, 146, 42, 0.18)",
          borderColor: "#c8922a",
          pointBackgroundColor: "#1a3a5c",
          pointBorderColor: "#fff",
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersCompactLlmLayout() ? false : { duration: 220 },
      plugins: {
        legend: {
          labels: { color: "#4a5568" },
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            showLabelBackdrop: false,
            color: "#718096",
            backdropColor: "transparent",
          },
          grid: { color: "rgba(15, 39, 68, .1)" },
          angleLines: { color: "rgba(15, 39, 68, .08)" },
          pointLabels: { color: "#4a5568", font: { size: 11 } },
        },
      },
    },
  });

  llmChartSignature = signature;
}

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

  // Chart 1: Trá»ng sá»‘ tiÃªu chÃ­
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

  // Chart 2: Äiá»ƒm Top 10 (náº±m ngang, dá»… Ä‘á»c)
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MA TRáº¬N SO SÃNH Cáº¶P GIá»®A CÃC PHÆ¯Æ NG ÃN
// Theo lÃ½ thuyáº¿t AHP (tÃ i liá»‡u Saaty): sau khi cÃ³ trá»ng sá»‘ tiÃªu chÃ­,
// ta tính ma trận so sánh cặp phương án cho từng tiêu chí rồi tổng hợp.
// Ở đây dùng điểm AHP tổng hợp: a[i][j] = score[i] / score[j]
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    // RÃºt gá»n tÃªn: láº¥y tÃªn dá»± Ã¡n hoáº·c 25 kÃ½ tá»± Ä‘áº§u
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

  // TÃ­nh trá»ng sá»‘ phÆ°Æ¡ng Ã¡n (cá»™t priority vector)
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODAL CHI TIẾT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
  const llmInsight = getLlmApartmentInsight(item);
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
          llmInsight
                        ? `<div class="detail-section-label">${modalLabel("sparkles", "Góc nhìn AI")}</div>
        <div class="llm-apartment-card">
            <div class="llm-apartment-head">
                <span class="llm-rank-chip">#${llmInsight.rank}</span>
                <div class="llm-support-score">
                    <strong>${Math.round(llmInsight.llm_support_score)}</strong>
                    <span>điểm hỗ trợ</span>
                </div>
            </div>
            <p class="llm-summary-note">${escapeHtml(llmInsight.verdict)}</p>
            <div class="llm-apartment-meta">
                <div>
                    <div class="llm-section-title">Điểm mạnh</div>
                    <ul class="llm-list">
                        ${(llmInsight.strengths.length ? llmInsight.strengths : ["Chưa có ghi chú nổi bật."])
                          .map((entry) => `<li>${escapeHtml(entry)}</li>`)
                          .join("")}
                    </ul>
                </div>
                <div>
                    <div class="llm-section-title">Rủi ro / cần kiểm tra</div>
                    <ul class="llm-list">
                                ${(llmInsight.risks.length ? llmInsight.risks : ["Không có cảnh báo bổ sung từ AI."])
                          .map((entry) => `<li>${escapeHtml(entry)}</li>`)
                          .join("")}
                    </ul>
                </div>
                <div>
                    <div class="llm-section-title">Điểm 8 tiêu chí</div>
                    <ul class="llm-list">
                        ${CRIT.map(
                          (criterion) =>
                            `<li>${escapeHtml(criterion.name)}: ${Math.round(llmInsight.criterion_scores?.[criterion.id] ?? 0)}/100</li>`,
                        ).join("")}
                    </ul>
                </div>
            </div>
        </div>`
            : ""
        }
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
  modalBody.querySelector(".detail-gallery")?.remove();
  summary.insertAdjacentHTML("afterend", renderDetailGallery(ch));
  setApartmentChatContext(item);

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderApartmentChatShell();
  closeButton?.focus();
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  modalGalleryImages = [];
  activeModalImageIndex = 0;
  resetApartmentChatState();
  if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
    lastFocusedTrigger.focus();
  }
}

function getApartmentChatDefaultPrompts(item) {
  const shortName = getCompareCompactName(item, 28) || "Căn này";
  return [
    `${shortName} phù hợp để ở ở điểm nào?`,
    "Đi xem thực tế nên kiểm tra gì trước?",
    "Điểm cần cân nhắc của căn này là gì?",
  ];
}

function getApartmentChatAvailability() {
  return {
    backendEnabled: Boolean(apiInfoCache?.llm_enabled),
    userEnabled: document.getElementById("llm-enabled")?.checked ?? true,
  };
}

function getActiveApartmentChatKey() {
  if (!activeApartmentChatContext) return "";
  return `${activeApartmentChatContext.sessionId}:${activeApartmentChatContext.canhoId}`;
}

function setApartmentChatContext(item) {
  activeApartmentChatContext = {
    item,
    sessionId: lastRes?.session_id || null,
    canhoId: item?.canho?.id || null,
    shortName: getCompareCompactName(item, 34) || item?.canho?.title || "Căn hộ đang xem",
    fullName: item?.canho?.title || "Căn hộ đang xem",
  };
  apartmentChatHistory = [];
  apartmentChatOpen = false;
  apartmentChatLoading = false;
  apartmentChatSuggestions = getApartmentChatDefaultPrompts(item);
  renderApartmentChatShell();
}

function resetApartmentChatState() {
  activeApartmentChatContext = null;
  apartmentChatHistory = [];
  apartmentChatOpen = false;
  apartmentChatLoading = false;
  apartmentChatSuggestions = [];
  renderApartmentChatShell();
}

function toggleApartmentChat(forceOpen) {
  if (!activeApartmentChatContext) return;
  apartmentChatOpen =
    typeof forceOpen === "boolean" ? forceOpen : !apartmentChatOpen;
  renderApartmentChatShell();
  if (apartmentChatOpen) {
    document.getElementById("detail-chatbot-input")?.focus();
  }
}

function renderApartmentChatMessage(message) {
  const roleClass =
    message.role === "user"
      ? "is-user"
      : message.tone === "error"
        ? "is-error"
        : message.tone === "refusal"
          ? "is-refusal"
          : "is-assistant";
  return `
    <article class="detail-chatbot-message ${roleClass}">
      <div class="detail-chatbot-message-role">${message.role === "user" ? "Bạn" : "Trợ lý căn hộ"}</div>
      <div class="detail-chatbot-message-copy">${escapeHtml(message.content || "").replace(/\n/g, "<br>")}</div>
    </article>`;
}

function renderApartmentChatShell() {
  const modal = document.getElementById("modal");
  const shell = document.getElementById("detail-chatbot-shell");
  const launcher = document.getElementById("detail-chatbot-launcher");
  const panel = document.getElementById("detail-chatbot-panel");
  const title = document.getElementById("detail-chatbot-title");
  const prompts = document.getElementById("detail-chatbot-prompts");
  const status = document.getElementById("detail-chatbot-status");
  const messages = document.getElementById("detail-chatbot-messages");
  const input = document.getElementById("detail-chatbot-input");
  const submit = document.getElementById("detail-chatbot-submit");
  const intro = document.getElementById("detail-chatbot-intro");
  if (!modal || !shell || !launcher || !panel || !title || !prompts || !status || !messages || !input || !submit || !intro) {
    return;
  }

  const modalOpen = modal.classList.contains("open");
  if (!modalOpen || !activeApartmentChatContext) {
    shell.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");
    panel.classList.remove("is-open");
    return;
  }

  const { backendEnabled, userEnabled } = getApartmentChatAvailability();
  const disabled = !backendEnabled || !userEnabled;
  shell.hidden = false;
  title.textContent = activeApartmentChatContext.shortName;
  intro.textContent =
    "Mình chỉ giải đáp các câu hỏi liên quan trực tiếp đến căn hộ này, nhu cầu ở thực và những điểm nên kiểm tra khi đi xem nhà.";

  launcher.setAttribute("aria-expanded", apartmentChatOpen ? "true" : "false");
  launcher.classList.toggle("is-active", apartmentChatOpen);
  launcher.classList.toggle("has-history", apartmentChatHistory.length > 0);
  panel.classList.toggle("is-open", apartmentChatOpen);
  panel.setAttribute("aria-hidden", apartmentChatOpen ? "false" : "true");

  prompts.innerHTML = apartmentChatSuggestions
    .slice(0, 3)
    .map(
      (prompt) => `
        <button class="detail-chatbot-prompt" type="button" data-chat-prompt="${escapeHtml(prompt)}">
          ${escapeHtml(prompt)}
        </button>`,
    )
    .join("");

  if (!backendEnabled) {
    status.innerHTML =
      '<div class="detail-chatbot-note is-warning">Trợ lý căn hộ đang tạm unavailable vì backend chưa bật OpenRouter.</div>';
  } else if (!userEnabled) {
    status.innerHTML =
      '<div class="detail-chatbot-note">Bật góc nhìn AI ở phần cấu hình để sử dụng trợ lý căn hộ.</div>';
  } else if (apartmentChatLoading) {
    status.innerHTML =
      '<div class="detail-chatbot-note is-loading">Đang soạn câu trả lời dựa trên dữ liệu căn hộ hiện có...</div>';
  } else {
    status.innerHTML = "";
  }

  messages.innerHTML = apartmentChatHistory.length
    ? apartmentChatHistory.map(renderApartmentChatMessage).join("")
    : '<article class="detail-chatbot-message is-assistant is-welcome"><div class="detail-chatbot-message-role">Trợ lý căn hộ</div><div class="detail-chatbot-message-copy">Mình có thể giúp bạn đọc nhanh điểm phù hợp để ở, những điều cần kiểm tra thêm và các lưu ý thực tế của căn này.</div></article>';

  input.disabled = disabled || apartmentChatLoading;
  submit.disabled = disabled || apartmentChatLoading;
  input.setAttribute("aria-disabled", String(disabled || apartmentChatLoading));
  messages.scrollTop = messages.scrollHeight;
}

async function submitApartmentChatQuestion(prefilledQuestion) {
  if (!activeApartmentChatContext || apartmentChatLoading) return;

  const input = document.getElementById("detail-chatbot-input");
  const text = String(prefilledQuestion ?? input?.value ?? "").trim();
  if (!text) return;

  const { backendEnabled, userEnabled } = getApartmentChatAvailability();
  if (!backendEnabled || !userEnabled) {
    apartmentChatOpen = true;
    renderApartmentChatShell();
    return;
  }

  const requestHistory = apartmentChatHistory
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .slice(-6)
    .map(({ role, content }) => ({ role, content }));
  const contextKey = getActiveApartmentChatKey();

  apartmentChatHistory = [
    ...apartmentChatHistory,
    { role: "user", content: text },
  ];
  apartmentChatLoading = true;
  apartmentChatOpen = true;
  if (input) input.value = "";
  renderApartmentChatShell();

  try {
    const llmModel = getCurrentLlmModel();
    const response = await fetch(API + "/ahp/chat-apartment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: activeApartmentChatContext.sessionId,
        canho_id: activeApartmentChatContext.canhoId,
        question: text,
        llm_model: llmModel,
        history: requestHistory,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (getActiveApartmentChatKey() !== contextKey) return;

    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
    }

    if (Array.isArray(payload?.suggested_questions) && payload.suggested_questions.length) {
      apartmentChatSuggestions = payload.suggested_questions.slice(0, 3);
    }

    if (payload.status === "success") {
      apartmentChatHistory = [
        ...apartmentChatHistory,
        {
          role: "assistant",
          content:
            payload.answer ||
            "Mình chưa có đủ dữ liệu trong hệ thống để trả lời rõ hơn về căn hộ này.",
        },
      ];
    } else if (payload.status === "refused") {
      apartmentChatHistory = [
        ...apartmentChatHistory,
        {
          role: "assistant",
          content:
            payload.refusal_reason ||
            "Mình chỉ hỗ trợ các câu hỏi liên quan trực tiếp đến căn hộ này.",
          tone: "refusal",
        },
      ];
    } else {
      apartmentChatHistory = [
        ...apartmentChatHistory,
        {
          role: "assistant",
          content:
            payload.error ||
            "Hiện trợ lý căn hộ chưa thể trả lời. Bạn có thể thử lại sau ít phút.",
          tone: "error",
        },
      ];
    }
  } catch (error) {
    if (getActiveApartmentChatKey() !== contextKey) return;
    apartmentChatHistory = [
      ...apartmentChatHistory,
      {
        role: "assistant",
        content:
          error?.message ||
          "Hiện trợ lý căn hộ chưa thể trả lời. Bạn có thể thử lại sau ít phút.",
        tone: "error",
      },
    ];
  } finally {
    if (getActiveApartmentChatKey() !== contextKey) return;
    apartmentChatLoading = false;
    renderApartmentChatShell();
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODE + PRESET + RESET
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// Ãp preset (má»™t bá»™ ma tráº­n AHP cÃ³ sáºµn) lÃªn ma tráº­n hiá»‡n táº¡i.
// HÃ m nÃ y Ä‘Æ°á»£c gá»i khi nháº¥n nÃºt â€œCÃ¢n báº±ng / Æ¯u tiÃªn giÃ¡ / â€¦â€.
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
  document.querySelectorAll(".modal-x").forEach((button) => {
    button.setAttribute("aria-label", "Đóng modal");
  });
  const resultHint = document.querySelector("#rank-title")?.nextElementSibling;
  if (resultHint && resultHint.classList.contains("card-sub")) {
    resultHint.textContent = "Click hoặc nhấn Enter trên từng căn hộ để xem chi tiết và điểm thành phần";
  }

  document.getElementById("llm-enabled")?.addEventListener("change", syncLlmControls);
  document.getElementById("llm-insight-body")?.addEventListener("click", (e) => {
    const copyToggle = e.target.closest("[data-llm-toggle]");
    if (copyToggle) {
      toggleLlmCopy(copyToggle.getAttribute("data-llm-toggle"));
      return;
    }

    const chartToggle = e.target.closest("[data-llm-charts-toggle]");
    if (chartToggle) {
      toggleLlmChartsExpanded();
      return;
    }

    const moreToggle = e.target.closest("[data-llm-more-toggle]");
    if (moreToggle) {
      toggleLlmInsightsExpanded();
    }
  });
  document.getElementById("compare-clear-btn")?.addEventListener("click", clearCompareSelection);
  document.getElementById("compare-run-btn")?.addEventListener("click", runCompareSelection);
  window.addEventListener("resize", handleLlmViewportChange);

  document.getElementById("modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById("compare-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCompareModal();
  });
  document.getElementById("compare-modal-body")?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-compare-expand]");
    if (!button) return;
    toggleCompareDetail(button.getAttribute("data-compare-expand"));
  });
  document.getElementById("modal-body")?.addEventListener("click", (e) => {
    const button = e.target.closest(".detail-gallery-thumb");
    if (!button) return;
    setActiveModalImage(Number(button.dataset.galleryIndex));
  });
  document.getElementById("detail-chatbot-launcher")?.addEventListener("click", () => {
    toggleApartmentChat();
  });
  document.getElementById("detail-chatbot-close")?.addEventListener("click", () => {
    toggleApartmentChat(false);
  });
  document.getElementById("detail-chatbot-prompts")?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-chat-prompt]");
    if (!button) return;
    submitApartmentChatQuestion(button.getAttribute("data-chat-prompt"));
  });
  document.getElementById("detail-chatbot-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitApartmentChatQuestion();
  });
  document.getElementById("detail-chatbot-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitApartmentChatQuestion();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.getElementById("compare-modal")?.classList.contains("open")) {
      closeCompareModal();
      return;
    }
    if (apartmentChatOpen) {
      toggleApartmentChat(false);
      return;
    }
    if (document.getElementById("modal")?.classList.contains("open")) {
      closeModal();
    }
  });
  init();
});

