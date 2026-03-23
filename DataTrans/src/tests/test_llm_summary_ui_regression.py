from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
PAGE_HTML = ROOT / "Page" / "ahp.html"
PAGE_JS = ROOT / "Page" / "ahp.js"
PAGE_CSS = ROOT / "Page" / "style-ahp.css"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def test_llm_summary_markup_and_render_hooks_are_present():
    html = read_text(PAGE_HTML)
    script = read_text(PAGE_JS)

    assert 'id="llm-insight-section"' in html
    assert 'id="llm-insight-body"' in html
    assert "Góc nhìn AI" in html
    assert "Nhận xét hỗ trợ từ AI" in html
    assert 'id="llm-model"' not in html
    assert "Model OpenRouter" not in html
    assert 'class="assistant-side"' in html
    assert 'assistant-toggle assistant-toggle-card' in html

    assert "function renderLlmInsights" in script
    assert "function renderLlmCharts" in script
    assert "function renderExpandableLlmCopy" in script
    assert "function cleanAiCopy" in script
    assert "function getCurrentLlmModel" in script
    assert "function refreshLlmInsightsView" in script
    assert "function handleLlmViewportChange" in script
    assert "function toggleLlmChartsExpanded" in script
    assert "function toggleLlmInsightsExpanded" in script
    assert "refreshLlmInsightsView();" in script
    assert "requestAnimationFrame(() => {" in script
    assert 'data-llm-charts-toggle' in script
    assert 'data-llm-more-toggle' in script
    assert 'class="llm-chart-stage"' in script
    assert 'class="llm-chart-stage llm-chart-stage--radar"' in script
    assert 'Ẩn biểu đồ AI' in script
    assert 'Hiện biểu đồ AI' in script
    assert 'shell.style.display = llmChartsExpanded ? "" : "none";' in script
    assert 'window.addEventListener("resize", handleLlmViewportChange);' in script
    assert "if (chLlmTop10 && chLlmRadar && llmChartSignature === signature)" in script


def test_llm_summary_styles_guard_against_overflow_and_mobile_breakage():
    css = read_text(PAGE_CSS)

    assert ".assistant-side {" in css
    assert ".assistant-toggle-card {" in css
    assert ".llm-summary-grid" in css
    assert "grid-template-columns: minmax(0, 1.3fr) minmax(0, .9fr);" in css
    assert ".llm-summary-grid > *," in css
    assert ".llm-copy-block.is-clamped .llm-summary-copy," in css
    assert ".llm-copy-block--summary.is-clamped .llm-summary-copy" in css
    assert ".llm-copy-block--spotlight.is-clamped .llm-summary-note" in css
    assert ".llm-chart-shell" in css
    assert ".llm-chart-toggle" in css
    assert ".llm-chart-stage" in css
    assert ".llm-chart-stage--radar" in css
    assert ".llm-dashboard-charts[hidden]," in css
    assert ".llm-more-grid[hidden]," in css
    assert "overflow-wrap: anywhere;" in css
    assert ".llm-chart-box {" in css
    assert ".llm-chart-box canvas {" in css
    assert ".llm-chart-shell-head {" in css
    assert ".detail-chatbot-panel {" in css
    assert "max-height: min(calc(100vh - 72px), 680px);" in css
    assert "overflow: hidden;" in css
    assert ".detail-chatbot-prompts {" in css
    assert "max-height: 104px;" in css
    assert ".detail-chatbot-messages {" in css
    assert "min-height: 0;" in css
    assert ".detail-chatbot-form {" in css
    assert "flex: 0 0 auto;" in css
    assert ".detail-chatbot-form textarea {" in css
    assert "max-height: min(22vh, 180px);" in css
    assert "@media (max-width: 640px)" in css
