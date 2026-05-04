# PromptMetrics Website — Screenshot Placement Guide

## Overview

This document maps the 9 captured dashboard screenshots to specific locations on the promptmetrics.dev website. Use this as the brief for your frontend developers.

**Note on duplicates:** `dashboard-overview.png` and `homepage-overview.png` are identical (same MD5 hash: `fe92f7155076e523ec94285685fd5964`). Keep one, delete the other.

---

## Homepage (https://www.promptmetrics.dev/)

### Section 1: "See it live" / "Three surfaces. One process."

**Priority: REQUIRED.** These are the only existing screenshot placeholder slots on the homepage.

Each card is a `374px × 210px` container with an SVG placeholder. Replace the SVG with the corresponding PNG screenshot.

#### Card 1 — Trace Tree Viewer
| Current | Replacement |
|---|---|
| Label: "Trace tree viewer" / "placeholder" | Label: "Agent trace detail" |
| Visual: SVG rectangles | Visual: `trace-tree-viewer.png` |
| Caption: Remove "placeholder" sub-label. Add: "Trace detail page — inspect span waterfalls, status, and metadata for every agent step." |

**Image file:** `ui/docs/screenshots/trace-tree-viewer.png`  
**Alt text:** "Hierarchical trace detail showing nested spans with status icons and duration metadata."  
**Aspect ratio:** ~16:9  
**Suggested container:** `rounded-xl border border-white/[0.08] bg-[#0d0d0d] overflow-hidden`

#### Card 2 — Eval Chart
| Current | Replacement |
|---|---|
| Label: "Eval chart" / "placeholder" | Label: "Evaluation trends" |
| Visual: SVG rectangles | Visual: `eval-chart.png` |
| Caption: Remove "placeholder" sub-label. Add: "Evaluations page — track prompt quality scores, pass/fail thresholds, and result counts over any time window." |

**Image file:** `ui/docs/screenshots/eval-chart.png`  
**Alt text:** "Evaluation score trend chart showing average score over time with min-max confidence band."  
**Aspect ratio:** ~16:9

#### Card 3 — Workspace Selector
| Current | Replacement |
|---|---|
| Label: "Workspace selector" / "placeholder" | Label: "Live metrics" or "Dashboard overview" |
| Visual: SVG rectangles + hardcoded workspace list | Visual: `dashboard-overview.png` |
| Caption: Remove "placeholder" sub-label and hardcoded workspace names. Add: "Overview page — monitor cost, latency, token usage, and system health at a glance." |

**Image file:** `ui/docs/screenshots/dashboard-overview.png`  
**Alt text:** "Dashboard overview showing summary cards, cost and latency chart, and recent runs table."  
**Aspect ratio:** ~16:9

#### Copy changes for this section

1. **Remove these lines:**
   ```
   // screenshots from the actual self-hosted UI
   // boot it locally to follow along
   ```

2. **Replace with:**
   ```
   The dashboard ships with every self-hosted instance. No separate signup, no data egress — just open your local UI and inspect traces, evaluations, and operations in one place.
   ```

3. **Update card titles:**
   - "Trace tree viewer" → "Agent trace detail" or "Trace tree"
   - "Eval chart" → "Evaluation trends" or "Score trends"
   - "Workspace selector" → "Live metrics" or "Dashboard overview"

---

### Section 2: "Four primitives"

**Priority: OPTIONAL.** This section currently uses small 16×16 icons (not screenshot placeholders). Enhancing it with real screenshots is a nice-to-have.

The section has 4 cards: "Prompt registry", "Metadata log", "Traces & spans", "Evaluations".

Each card is text-only with a small icon. You could add a small screenshot below each card's description, or replace the icon with a thumbnail.

| Card | Suggested image | Placement |
|---|---|---|
| "Prompt registry" | `traces.png` (shows the prompt list context) | Below card text, ~300px wide |
| "Metadata log" | `logs.png` | Below card text, ~300px wide |
| "Traces & spans" | `trace-detail.png` | Below card text, ~300px wide |
| "Evaluations" | `evaluations.png` | Below card text, ~300px wide |

---

### Section 3: "New in v0.10 · Traces, spans & runs"

**Priority: OPTIONAL.** This section currently has no images.

Add `trace-tree-viewer.png` or `traces.png` as a full-width screenshot below the description text to illustrate the trace viewer feature.

**Suggested placement:** Below the paragraph "Emit spans from your code...", add a centered image with a subtle border shadow.

---

## Subpages

### /docs

Use the remaining screenshots to illustrate the documentation:

| Page section | Suggested image |
|---|---|
| Getting Started / Dashboard overview | `dashboard-overview.png` |
| Logs documentation | `logs.png` |
| Traces documentation | `traces.png` |
| Trace detail documentation | `trace-detail.png` |
| Evaluations documentation | `evaluations.png` |

### /use-cases

Use screenshots to illustrate specific use cases:

| Use case | Suggested image |
|---|---|
| Debugging agent loops | `trace-tree-viewer.png` |
| Monitoring prompt quality | `eval-chart.png` |
| Observability dashboard | `dashboard-overview.png` |
| Cost tracking | `logs.png` |

### /compare

Use `dashboard-overview.png` as a hero image showing the full PromptMetrics dashboard alongside comparison text.

---

## File Inventory

| # | Filename | Size | Status | Primary placement | Backup placement |
|---|---|---|---|---|---|
| 1 | `dashboard-overview.png` | 79K | **NEW** | Homepage Card 3 | /docs, /use-cases |
| 2 | `eval-chart.png` | 79K | **NEW** | Homepage Card 2 | /use-cases, /docs |
| 3 | `evaluations.png` | 70K | Existing | /docs, /use-cases | Homepage "Four primitives" |
| 4 | `homepage-overview.png` | 79K | **DUPLICATE** | Delete or rename to `dashboard-overview-v2.png` | — |
| 5 | `logs.png` | 178K | Existing | /docs | Homepage "Four primitives" |
| 6 | `overview.png` | 376K | Existing | /docs hero | /compare |
| 7 | `trace-detail.png` | 65K | Existing | /docs | Homepage "Four primitives" |
| 8 | `trace-tree-viewer.png` | 65K | **NEW** | Homepage Card 1 | /use-cases, /docs |
| 9 | `traces.png` | 214K | Existing | /docs | Homepage "Four primitives" |

---

## Technical Requirements

### Image specs
- **Format:** PNG with transparency disabled
- **Color space:** sRGB
- **Resolution:** All screenshots captured at 1440×900 viewport, then cropped to content area
- **Aspect ratios:**
  - Homepage cards: ~16:9 (374×210 container)
  - Documentation: flexible, max-width 800px

### CSS container for homepage cards
```css
.screenshot-card {
  border-radius: 0.75rem; /* rounded-xl */
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #0d0d0d;
  overflow: hidden;
}
.screenshot-card img {
  width: 100%;
  height: auto;
  display: block;
}
```

### Accessibility
- Every image must have `alt` text (provided above).
- Screenshots inside interactive cards should not be focusable.
- Provide a text fallback caption below each image.

---

## Action Items for Developers

1. [ ] **Homepage Card 1:** Replace SVG placeholder with `trace-tree-viewer.png`, update label to "Agent trace detail"
2. [ ] **Homepage Card 2:** Replace SVG placeholder with `eval-chart.png`, update label to "Evaluation trends"
3. [ ] **Homepage Card 3:** Replace SVG placeholder with `dashboard-overview.png`, update label to "Live metrics"
4. [ ] **Homepage copy:** Remove `//` comment lines, replace with new paragraph
5. [ ] **Homepage Card 3:** Remove hardcoded workspace list (`default`, `eu-prod`, `staging`, `red-team`)
6. [ ] **Optional:** Add screenshots to "Four primitives" cards
7. [ ] **Optional:** Add a screenshot to "New in v0.10" section
8. [ ] **Cleanup:** Delete duplicate `homepage-overview.png` (or keep as backup)
9. [ ] **Subpages:** Add relevant screenshots to /docs and /use-cases
10. [ ] **Performance:** Run all PNGs through an optimizer (e.g., `oxipng` or `ImageOptim`) before deploying

---

*Generated 2026-05-02. Screenshots captured from PromptMetrics v1.2.1 dashboard running with seeded demo data.*
