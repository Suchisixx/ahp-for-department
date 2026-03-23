// ═══════════════════════════════════════════════════════════════
// ahp.js — Logic phân tích AHP cho ApartmentBroker DSS
// Kết nối backend FastAPI: http://localhost:8000
// ═══════════════════════════════════════════════════════════════

const API = 'http://localhost:8000';

// ── Tiêu chí AHP ────────────────────────────────────────────────
const CRIT = [
    { id: 'C1', name: 'Tài chính', color: '#2563eb' },
    { id: 'C2', name: 'Nội thất', color: '#16a34a' },
    { id: 'C3', name: 'Chủ đầu tư', color: '#9333ea' },
    { id: 'C4', name: 'Pháp lý', color: '#c8922a' },
    { id: 'C5', name: 'Hạ tầng XH', color: '#0891b2' },
    { id: 'C6', name: 'Tiện ích NK', color: '#dc2626' },
    { id: 'C7', name: 'Ngoại thất', color: '#7c3aed' },
    { id: 'C8', name: 'Phong thủy', color: '#d97706' },
];
const N = 8;
const RI = { 1: 0, 2: 0, 3: .58, 4: .9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

// ── Expert weights (CR = 1.1%) ───────────────────────────────────
const EW = [0.2295, 0.2295, 0.1350, 0.0826, 0.0751, 0.0751, 0.1292, 0.0439];
const EM = [
    [1, 1, 2, 3, 3, 3, 2, 5],
    [1, 1, 2, 3, 3, 3, 2, 5],
    [.5, .5, 1, 2, 2, 2, 1, 4],
    [1 / 3, 1 / 3, .5, 1, 1, 1, .5, 3],
    [1 / 3, 1 / 3, .5, 1, 1, 1, .5, 3],
    [1 / 3, 1 / 3, .5, 1, 1, 1, .5, 3],
    [.5, .5, 1, 2, 2, 2, 1, 3],
    [.2, .2, .25, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1],
];

// ── Preset matrices ──────────────────────────────────────────────
const PS = {
    balanced: Array.from({ length: 8 }, () => Array(8).fill(1)),
    price: [
        [1, 3, 5, 3, 3, 3, 2, 5], [1 / 3, 1, 2, 1, 1, 1, 1, 2],
        [1 / 5, .5, 1, 1, 1, 1, 1, 1], [1 / 3, 1, 1, 1, 1, 1, 1, 2],
        [1 / 3, 1, 1, 1, 1, 1, 1, 2], [1 / 3, 1, 1, 1, 1, 1, 1, 2],
        [.5, 1, 1, 1, 1, 1, 1, 2], [.2, .5, 1, .5, .5, .5, .5, 1],
    ],
    quality: [
        [1, .5, 2, 2, 2, 2, 1, 3], [2, 1, 3, 3, 3, 3, 2, 5],
        [.5, 1 / 3, 1, 1, 1, 1, .5, 2], [.5, 1 / 3, 1, 1, 1, 1, .5, 2],
        [.5, 1 / 3, 1, 1, 1, 1, .5, 2], [.5, 1 / 3, 1, 1, 1, 1, .5, 2],
        [1, .5, 2, 2, 2, 2, 1, 3], [1 / 3, .2, .5, .5, .5, .5, 1 / 3, 1],
    ],
    legal: [
        [1, 1, 2, 1 / 3, 2, 2, 2, 3], [1, 1, 2, 1 / 3, 2, 2, 2, 3],
        [.5, .5, 1, .2, 1, 1, 1, 2], [3, 3, 5, 1, 5, 5, 4, 7],
        [.5, .5, 1, .2, 1, 1, 1, 2], [.5, .5, 1, .2, 1, 1, 1, 2],
        [.5, .5, 1, .25, 1, 1, 1, 2], [1 / 3, 1 / 3, .5, 1 / 7, .5, .5, .5, 1],
    ],
    location: [
        [1, 1, 1, 1, 2, 2, 1, 3], [1, 1, 1, 1, 2, 2, 1, 3],
        [1, 1, 1, 1, 2, 2, 1, 3], [1, 1, 1, 1, 2, 2, 1, 3],
        [.5, .5, .5, .5, 1, 1, .5, 2], [.5, .5, .5, .5, 1, 1, .5, 2],
        [1, 1, 1, 1, 2, 2, 1, 3], [1 / 3, 1 / 3, 1 / 3, 1 / 3, .5, .5, 1 / 3, 1],
    ],
};

// ── State ────────────────────────────────────────────────────────
let curMode = 'expert';
let curMat = Array.from({ length: N }, () => Array(N).fill(1));
let lastRes = null;
let chW = null;
let chTop10 = null;

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
    applyPreset('price');

    // Nếu URL là ahp.html?mode=custom thì kích chế độ custom, còn không thì expert.
    const m = new URLSearchParams(location.search).get('mode');
    setMode(m === 'custom' ? 'custom' : 'expert');

    // Gọi backend để kiểm tra kết nối (và hiển thị trạng thái trên trang)
    await pingAPI();
}

// ── Kiểm tra kết nối backend ─────────────────────────────────────
// Hàm này gọi endpoint /health để kiểm tra FastAPI có đang chạy không.
async function pingAPI() {
    const dot = document.getElementById('api-dot');
    const lbl = document.getElementById('api-lbl');
    const banner = document.getElementById('api-banner');

    // setTimeout → abort sau 5s nếu backend không trả lời.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
        // Gọi endpoint /health (backend cần chạy và CORS phải được cho phép)
        const r = await fetch(API + '/health', { signal: controller.signal });
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);

        // Nếu thành công, hiển thị trạng thái xanh
        dot.className = 'api-dot ok';
        lbl.textContent = 'Backend OK ✓';
        banner.className = 'api-banner ok';
        document.getElementById('retry-bar').style.display = 'none';
        banner.innerHTML = '✓ Kết nối thành công';

    } catch (err) {
        // Nếu thất bại (network, CORS, timeout...), hiển thị lỗi lên UI + console
        clearTimeout(timer);
        console.error('pingAPI failed:', err);
        dot.className = 'api-dot err';
        lbl.textContent = 'Backend chưa chạy';
        banner.className = 'api-banner err';
        document.getElementById('retry-bar').style.display = '';
        banner.innerHTML = '✗ Không kết nối được <code>localhost:8000</code>.'
            + '<br><small style="color:var(--text3)">Lỗi: ' + (err?.message || err) + '</small>'
            + '<br>Hãy chạy: <code style="background:rgba(192,57,43,.1);padding:2px 8px;border-radius:4px">'
            + 'cd src &nbsp; python -m uvicorn main:app --reload --port 8000</code>';

        // NOTE: Tại đây chúng ta không tắt nút bấm, vì đôi khi backend đã chạy nhưng CORS chặn.
    }
}

// Hàm retry: bấm để kiểm tra lại kết nối
async function retryPing() {
    const banner = document.getElementById('api-banner');
    banner.className = 'api-banner checking';
    banner.innerHTML = 'Đang kiểm tra lại kết nối <code>localhost:8000</code>...';
    await pingAPI();
}

// BUILD UI

function buildEW() {
    document.getElementById('ew-grid').innerHTML = CRIT.map((c, i) => `
        <div class="ew-item">
            <div class="ew-id">${c.id}</div>
            <div class="ew-name">${c.name}</div>
            <div class="ew-bg"><div class="ew-fill" style="width:${Math.round(EW[i] * 100)}%;background:${c.color}"></div></div>
            <div class="ew-pct">${(EW[i] * 100).toFixed(1)}%</div>
        </div>`).join('');
}

function buildMat() {
    let h = `<thead><tr><th class="rh">Tiêu chí</th>${CRIT.map(c => `<th>${c.id}</th>`).join('')}</tr></thead><tbody>`;
    for (let i = 0; i < N; i++) {
        h += `<tr><th class="rh">${CRIT[i].id} · ${CRIT[i].name}</th>`;
        for (let j = 0; j < N; j++) {
            if (i === j)
                h += `<td class="diag"><input value="1" readonly></td>`;
            else if (j < i)
                h += `<td class="recip"><input id="r_${j}_${i}" readonly tabindex="-1"></td>`;
            else
                h += `<td><input id="m_${i}_${j}" type="number" min="0.11" max="9" step="1" value="1"
                          oninput="onCell(${i},${j},this.value)" onclick="this.select()"></td>`;
        }
        h += '</tr>';
    }
    document.getElementById('mat-tbl').innerHTML = h + '</tbody>';
}

// MA TRẬN + CR (preview phía client, tính chính xác ở backend)

function onCell(i, j, v) {
    let x = parseFloat(v);
    if (isNaN(x) || x <= 0) return;
    if (x > 9) x = 9;
    curMat[i][j] = x;
    curMat[j][i] = 1 / x;
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
                curMat[i][j] = v;
                curMat[j][i] = 1 / v;
            }
        }
}

function calcCR(mat) {
    const A = mat.map(r => [...r]);
    const n = N;
    const cs = Array(n).fill(0);
    for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) cs[j] += A[i][j];
    const nm = A.map(row => row.map((v, j) => v / cs[j]));
    const w = nm.map(row => row.reduce((s, v) => s + v, 0) / n);
    const Aw = A.map(row => row.reduce((s, v, j) => s + v * w[j], 0));
    const cv = Aw.map((v, i) => v / w[i]);
    const lmax = cv.reduce((s, v) => s + v, 0) / n;
    const ci = (lmax - n) / (n - 1);
    const ri = RI[n] || 1.49;
    const cr = ri > 0 ? ci / ri : 0;
    return { w, lmax, ci, cr, ok: cr < 0.1 };
}

function previewCR() { syncDOM(); showCR(calcCR(curMat)); }
function checkCR() { syncDOM(); showCR(calcCR(curMat)); }

function showCR({ w, lmax, ci, cr, ok }) {
    const box = document.getElementById('cr-box');
    const num = document.getElementById('cr-num');
    const msg = document.getElementById('cr-msg');
    const pct = (cr * 100).toFixed(2);

    num.textContent = pct + '%';
    ['ok', 'bad', 'warn'].forEach(c => { box.classList.remove(c); num.classList.remove(c); });
    const cls = cr < 0.1 ? 'ok' : cr < 0.15 ? 'warn' : 'bad';
    box.classList.add(cls);
    num.classList.add(cls);
    msg.textContent = cr < 0.1 ? '✓ Nhất quán — sẵn sàng xếp hạng'
        : cr < 0.15 ? '⚠ Gần ngưỡng — nên xem lại'
            : '✗ Chưa nhất quán — cần điều chỉnh';

    document.getElementById('btn-custom').disabled = !ok;
    document.getElementById('wchips').innerHTML = w.map((wi, i) =>
        `<div class="wc"><span class="wc-id">${CRIT[i].id}</span><span class="wc-val">${(wi * 100).toFixed(1)}%</span></div>`
    ).join('');
    document.getElementById('lmax-line').textContent = `λmax = ${lmax.toFixed(4)} · CI = ${ci.toFixed(4)}`;
}

// ════════════════════════════════════════════════════════════════
// GỌI BACKEND
// ════════════════════════════════════════════════════════════════
async function callAPI(matrix, tenPhien) {
    showLoad(`Đang gửi ma trận lên ${API}/ahp/score...`);
    showErr('');
    try {
        const res = await fetch(API + '/ahp/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ten_phien: tenPhien, matrix }),
        });
        if (!res.ok) {
            const e = await res.json().catch(() => ({ detail: 'Lỗi không xác định' }));
            throw new Error(e?.detail?.msg || e?.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();
        // Response: { session_id, ten_phien, cr, ci, lambda_max, cr_ok,
        //             weights:[{id,name,weight,pct}], total_canho,
        //             ranked:[{rank, ahp_score, score_detail:{C1..C8}, canho:{...}}] }
        hideLoad();
        return data;
    } catch (e) {
        hideLoad();
        showErr('Lỗi: ' + e.message);
        return null;
    }
}

async function runExpert() {
    const d = await callAPI(EM, 'Chuyên gia');
    if (d) renderAll(d);
}

async function runCustom() {
    syncDOM();
    const { cr, ok } = calcCR(curMat);
    if (!ok) {
        showErr(`CR = ${(cr * 100).toFixed(2)}% > 10% — Chưa nhất quán. Hãy điều chỉnh lại.`);
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

    document.getElementById('results-wrap').classList.add('show');

    // Session badge
    document.getElementById('session-info').innerHTML =
        `<div class="session-badge">
            Session <b>#${data.session_id}</b> &nbsp;·&nbsp;
            CR = <b>${(data.cr * 100).toFixed(2)}%</b> &nbsp;·&nbsp;
            <b>${data.total_canho}</b> căn hộ phân tích &nbsp;·&nbsp;
            Chế độ: <b>${data.ten_phien}</b>
        </div>`;

    const weights = data.weights.map(w => w.weight);
    const top10 = data.ranked.slice(0, 10);   // ← CHỈ LẤY TOP 10
    const refer = data.ranked.slice(10, 15);  // ← 5 CĂN THAM KHẢO (hạng 11-15)

    renderTop10(top10);
    renderRefer(refer);
    renderCharts(weights, top10);
    renderAltMatrix(top10);   // Ma trận so sánh cặp giữa các phương án

    document.getElementById('results-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Top 10 dạng card 2 cột ────────────────────────────────────────
function renderTop10(top10) {
    function tNT(v) {
        const m = { 'Cao cấp': 'g', 'Cao Cấp': 'g', 'Đầy đủ': 'b', 'Đầy Đủ': 'b', 'Cơ bản': 'a', 'Cơ Bản': 'a', 'Không có': 'r' };
        return v ? `<span class="tag tag-${m[v] || 'gray'}">${v}</span>` : '';
    }
    function tPL(v) {
        const s = (v || '').toLowerCase();
        if (s.includes('sổ đỏ') || s.includes('sổ hồng')) return `<span class="tag tag-g">Sổ đỏ/Hồng</span>`;
        if (s.includes('giấy tờ')) return `<span class="tag tag-a">Giấy tờ</span>`;
        if (s.includes('hợp đồng')) return `<span class="tag tag-gray">HĐ mua bán</span>`;
        return '';
    }

    const medals = ['🥇', '🥈', '🥉'];
    const numCls = ['n1', 'n2', 'n3'];
    const cardCls = { 1: 'rank1', 2: 'rank2', 3: 'rank3' };

    const html = top10.map(item => {
        const ch = item.canho;
        const r = item.rank;
        const isTop3 = r <= 3;
        const nc = numCls[r - 1] || 'nn';
        const cc = cardCls[r] || '';
        const label = medals[r - 1] || r;
        const pct = Math.round(item.ahp_score * 100);

        return `
        <div class="rank-card ${isTop3 ? 'top3 ' : ''}${cc}" onclick="openModal(${r - 1})">
            <div class="rc-num ${nc}">${label}</div>
            <div class="rc-body">
                <div class="rc-title">${ch.title || '—'}</div>
                <div class="rc-meta">
                    ${ch.phuong || ''}
                    ${ch.du_an && !ch.du_an.toLowerCase().includes('không thuộc') ? ' · ' + ch.du_an : ''}
                </div>
                <div class="rc-tags">
                    ${tNT(ch.noi_that)}
                    ${tPL(ch.phap_ly)}
                    ${ch.so_phong_ngu ? `<span class="tag tag-gray">${ch.so_phong_ngu}PN</span>` : ''}
                    ${ch.dien_tich ? `<span class="tag tag-gray">${ch.dien_tich}m²</span>` : ''}
                </div>
                <div class="rc-bottom">
                    <div class="rc-price">${ch.gia_ty ? ch.gia_ty + ' tỷ' : '—'}<span style="font-size:10px;color:var(--text3);font-weight:400"> ${ch.gia_per_m2 ? '· ' + ch.gia_per_m2 + ' tr/m²' : ''}</span></div>
                    <div class="rc-score-wrap">
                        <div class="rc-score">${pct}</div>
                        <div class="rc-score-bar"><div class="rc-score-fill" style="width:${pct}%"></div></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('top10-grid').innerHTML = html;
    document.getElementById('rank-title').textContent = `Top 10 phương án phù hợp nhất`;
}

// ── 5 căn hộ tham khảo (hạng 11-15) ──────────────────────────────
function renderRefer(refer) {
    if (!refer || !refer.length) {
        document.getElementById('refer-section').style.display = 'none';
        return;
    }
    document.getElementById('refer-section').style.display = '';

    document.getElementById('refer-grid').innerHTML = refer.map(item => {
        const ch = item.canho;
        const pct = Math.round(item.ahp_score * 100);
        return `
        <div class="refer-card" onclick="openModal(${item.rank - 1})">
            <div class="refer-rank">#${item.rank}</div>
            <div class="refer-score">${pct}</div>
            <div class="refer-name">${ch.title || '—'}</div>
            <div class="refer-price">${ch.gia_ty ? ch.gia_ty + ' tỷ' : '—'}</div>
            <div class="refer-meta">${ch.dien_tich || '?'}m² · ${ch.so_phong_ngu || 0}PN · ${ch.phuong || ''}</div>
        </div>`;
    }).join('');
}

// ── Biểu đồ ────────────────────────────────────────────────────────
function renderCharts(weights, top10) {
    if (chW) { chW.destroy(); chW = null; }
    if (chTop10) { chTop10.destroy(); chTop10 = null; }

    // Chart 1: Trọng số tiêu chí
    chW = new Chart(document.getElementById('chart-w').getContext('2d'), {
        type: 'bar',
        data: {
            labels: CRIT.map(c => c.id),
            datasets: [{ data: weights.map(w => +(w * 100).toFixed(1)), backgroundColor: CRIT.map(c => c.color), borderRadius: 5, borderWidth: 0 }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)}%` } },
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#718096' } },
                y: { ticks: { callback: v => v + '%', font: { size: 10 }, color: '#718096' }, grid: { color: '#f0ede8' } },
            },
        },
    });

    // Chart 2: Điểm Top 10 (nằm ngang, dễ đọc)
    chTop10 = new Chart(document.getElementById('chart-top10').getContext('2d'), {
        type: 'bar',
        data: {
            labels: top10.map(x => `#${x.rank}`),
            datasets: [{
                label: 'Điểm AHP',
                data: top10.map(x => +(x.ahp_score * 100).toFixed(1)),
                backgroundColor: top10.map((_, i) => i < 3 ? '#c8922a' : i < 5 ? '#1a3a5c' : '#5b7fa6'),
                borderRadius: 4,
                borderWidth: 0,
            }],
        },
        options: {
            indexAxis: 'y',   // nằm ngang
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `Điểm: ${ctx.parsed.x.toFixed(1)}/100` } },
            },
            scales: {
                x: { min: 0, max: 100, ticks: { font: { size: 10 }, color: '#718096' }, grid: { color: '#f0ede8' } },
                y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#718096' } },
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
    const section = document.getElementById('alt-matrix-section');
    const wrap = document.getElementById('alt-matrix-wrap');
    if (!top10 || top10.length < 2) { section.style.display = 'none'; return; }
    section.style.display = '';

    const n = top10.length;
    const scores = top10.map(item => item.ahp_score);  // điểm tổng hợp từ backend
    const names = top10.map(item => {
        const t = item.canho.title || '';
        // Rút gọn tên: lấy tên dự án hoặc 25 ký tự đầu
        const du_an = item.canho.du_an;
        if (du_an && !du_an.toLowerCase().includes('không thuộc')) {
            return `#${item.rank} ${du_an.substring(0, 20)}`;
        }
        return `#${item.rank} ${t.substring(0, 22)}${t.length > 22 ? '…' : ''}`;
    });

    // Tính ma trận a[i][j] = score[i] / score[j]
    const mat = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => scores[i] / scores[j])
    );

    // Tính trọng số phương án (cột priority vector)
    // Chuẩn hóa: tổng cột → chia → trung bình hàng (giống bước 2 AHP)
    const colSum = Array(n).fill(0);
    for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) colSum[j] += mat[i][j];
    const norm = mat.map(row => row.map((v, j) => v / colSum[j]));
    const weights_pa = norm.map(row => row.reduce((s, v) => s + v, 0) / n);

    // Tính CR của ma trận phương án
    const Aw = mat.map(row => row.reduce((s, v, j) => s + v * weights_pa[j], 0));
    const cv = Aw.map((v, i) => v / weights_pa[i]);
    const lmax_pa = cv.reduce((s, v) => s + v, 0) / n;
    const RI_PA = { 1: 0, 2: 0, 3: .58, 4: .9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };
    const ci_pa = (lmax_pa - n) / (n - 1);
    const cr_pa = ci_pa / (RI_PA[n] || 1.49);

    // Xếp hạng theo weights_pa
    const rankOrder = weights_pa.map((w, i) => ({ idx: i, w }))
        .sort((a, b) => b.w - a.w)
        .map((o, r) => ({ ...o, rank: r + 1 }));
    const rankMap = {};
    rankOrder.forEach(o => { rankMap[o.idx] = o.rank; });

    // Render bảng HTML
    let h = `<table class="alt-tbl"><thead><tr>
        <th class="row-h">Phương án</th>
        ${names.map(nm => `<th title="${nm}">${nm.substring(0, 16)}…</th>`).join('')}
        <th class="weight-h">Trọng số PA</th>
        <th class="rank-h">Hạng</th>
    </tr></thead><tbody>`;

    for (let i = 0; i < n; i++) {
        h += `<tr><th class="row-h">${names[i]}</th>`;
        for (let j = 0; j < n; j++) {
            const v = mat[i][j];
            if (i === j) {
                h += `<td class="diag-cell">1.000</td>`;
            } else {
                const cls = v > 1 ? 'above1' : 'below1';
                h += `<td class="${cls}">${v.toFixed(3)}</td>`;
            }
        }
        const rk = rankMap[i];
        const rkCls = rk === 1 ? 'r1' : rk === 2 ? 'r2' : rk === 3 ? 'r3' : '';
        h += `<td class="weight-pa">${weights_pa[i].toFixed(4)}</td>`;
        h += `<td class="rank-pa ${rkCls}">${rk === 1 ? '🥇' : rk === 2 ? '🥈' : rk === 3 ? '🥉' : '#' + rk}</td>`;
        h += '</tr>';
    }

    // Thêm hàng λmax và CR ở cuối
    h += `<tr style="background:var(--bg3)">
        <th class="row-h" style="color:var(--text3);font-size:10px">λmax = ${lmax_pa.toFixed(4)} · CR = ${(cr_pa * 100).toFixed(2)}%</th>
        ${Array(n).fill('<td style="background:var(--bg3)"></td>').join('')}
        <td colspan="2" style="background:var(--bg3);font-size:11px;color:var(--text3);text-align:left;padding:6px 10px">
            ${cr_pa < 0.1 ? '✅ Ma trận nhất quán (CR < 10%)' : '⚠ CR > 10% — do điểm liên tục, chấp nhận được'}
        </td>
    </tr>`;

    h += '</tbody></table>';
    wrap.innerHTML = h;
}

function toggleAltMatrix() {
    const body = document.getElementById('alt-matrix-body');
    const btn = document.querySelector('#alt-matrix-section .btn');
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    btn.textContent = hidden ? 'Thu gọn ▲' : 'Mở rộng ▼';
}

// ════════════════════════════════════════════════════════════════
// MODAL CHI TIẾT
// ════════════════════════════════════════════════════════════════
function openModal(idx) {
    if (!lastRes) return;
    const item = lastRes.ranked[idx];
    const ch = item.canho;
    const det = item.score_detail || {};
    const wMap = {};
    lastRes.weights.forEach(w => { wMap[w.id] = w; });

    const tgs = s => s
        ? s.split('|').map(t => `<span class="tag tag-b">${t.trim()}</span>`).join(' ')
        : '<span class="tag tag-gray">—</span>';
    const medals = { 0: '🥇', 1: '🥈', 2: '🥉' };

    document.getElementById('modal-ttl').textContent = ch.title || 'Căn hộ';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:inline-flex;align-items:center;gap:10px;background:var(--bg3);border-radius:var(--r);padding:8px 14px;margin-bottom:16px">
            <span style="font-size:22px">${medals[item.rank - 1] || '#'}</span>
            <span style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--navy)">#${item.rank}</span>
            <span style="font-size:13px;color:var(--text2)">Điểm: <b style="color:var(--navy)">${(item.ahp_score * 100).toFixed(1)}/100</b></span>
            <span style="font-size:11px;color:var(--text3)">Session #${lastRes.session_id}</span>
        </div>
        <div class="ig">
            <div class="ig-item"><div class="ig-lbl">Giá bán</div>
                <div class="ig-val" style="color:var(--green);font-family:'Playfair Display',serif;font-size:18px;font-weight:700">
                    ${ch.gia_ty || '—'} tỷ <span style="font-size:12px;color:var(--text3)">(${ch.gia_per_m2 || '?'} tr/m²)</span>
                </div>
            </div>
            <div class="ig-item"><div class="ig-lbl">Diện tích & phòng</div><div class="ig-val">${ch.dien_tich || '?'}m² · ${ch.so_phong_ngu || 0}PN/${ch.so_phong_wc || 0}WC</div></div>
            <div class="ig-item"><div class="ig-lbl">Nội thất</div><div class="ig-val">${ch.noi_that || '—'}</div></div>
            <div class="ig-item"><div class="ig-lbl">Pháp lý</div><div class="ig-val">${ch.phap_ly || '—'}</div></div>
            <div class="ig-item"><div class="ig-lbl">Dự án</div><div class="ig-val">${ch.du_an || '—'}</div></div>
            <div class="ig-item"><div class="ig-lbl">Phường</div><div class="ig-val">${ch.phuong || '—'}</div></div>
            <div class="ig-item"><div class="ig-lbl">Hướng nhà/Ban công</div><div class="ig-val">${ch.huong_nha || '—'} / ${ch.huong_ban_cong || '—'}</div></div>
            <div class="ig-item"><div class="ig-lbl">Ngày đăng</div><div class="ig-val">${ch.ngay_dang ? new Date(ch.ngay_dang).toLocaleDateString('vi-VN') : '—'}</div></div>
            <div class="ig-item full"><div class="ig-lbl">Hạ tầng xã hội</div><div class="ig-val">${tgs(ch.tien_ich_ha_tang)}</div></div>
            <div class="ig-item full"><div class="ig-lbl">Tiện ích nội khu</div><div class="ig-val">${tgs(ch.tien_ich_noi_khu)}</div></div>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
            Điểm thành phần AHP (tính bởi backend)
        </div>
        <div class="bd-grid">
            ${CRIT.map(c => {
        const s = det[c.id];
        const w = wMap[c.id];
        const barW = s != null ? Math.round(s * 100) : 0;
        return `<div class="bd-item">
                    <div class="bd-cid">${c.id}</div>
                    <div class="bd-s" style="color:${c.color}">${s != null ? (s * 100).toFixed(0) : '?'}</div>
                    <div class="bd-name">${c.name}</div>
                    <div class="bd-w">w = ${w ? w.pct.toFixed(1) + '%' : '?'}</div>
                </div>`;
    }).join('')}
        </div>
        ${ch.url ? `<div style="margin-top:18px">
            <a href="${ch.url}" target="_blank" style="color:var(--navy);font-size:13px;font-weight:500;text-decoration:none">
                🔗 Xem tin gốc trên thuviennhadat.vn →
            </a>
        </div>` : ''}`;

    document.getElementById('modal').classList.add('open');
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
}

// ════════════════════════════════════════════════════════════════
// MODE + PRESET + RESET
// ════════════════════════════════════════════════════════════════
function setMode(m) {
    curMode = m;
    document.getElementById('tab-expert').classList.toggle('active', m === 'expert');
    document.getElementById('tab-custom').classList.toggle('active', m === 'custom');
    document.getElementById('panel-expert').style.display = m === 'expert' ? '' : 'none';
    document.getElementById('panel-custom').style.display = m === 'custom' ? '' : 'none';
    document.getElementById('mode-hint').textContent = m === 'expert'
        ? 'Bộ trọng số đã tính sẵn — CR = 1.1% ✓'
        : 'Nhập ma trận → backend tính AHP + trả kết quả từ DB';
}

// Áp preset (một bộ ma trận AHP có sẵn) lên ma trận hiện tại.
// Hàm này được gọi khi nhấn nút “Cân bằng / Ưu tiên giá / …”.
function applyPreset(name) {
    // Xóa trạng thái active của tất cả nút preset
    document.querySelectorAll('.pbtn').forEach(b => b.classList.remove('active'));

    // Bật trạng thái active cho nút tương ứng với preset name
    const btn = document.querySelector(`.pbtn[data-preset="${name}"]`);
    if (btn && btn.classList) {
        btn.classList.add('active');
    } else if (btn) {
        console.warn('applyPreset: found element without classList', btn);
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
                e.value = pre[i][j] === 1
                    ? '1'
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
    for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) curMat[i][j] = 1;
    for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
            const e = document.getElementById(`m_${i}_${j}`);
            if (e) e.value = 1;
            const r = document.getElementById(`r_${i}_${j}`);
            if (r) r.value = '1.000';
        }
    previewCR();
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function showLoad(msg) {
    document.getElementById('loading-txt').textContent = msg;
    document.getElementById('loading').classList.add('show');
}
function hideLoad() {
    document.getElementById('loading').classList.remove('show');
}
function showErr(msg) {
    const e = document.getElementById('err-box');
    e.textContent = msg;
    e.classList.toggle('show', !!msg);
}

// Modal click-outside
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    init();
});