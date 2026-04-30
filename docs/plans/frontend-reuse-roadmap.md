# Product Roadmap — PromptMetrics Dashboard Enhancement
**Team**: PromptMetrics Frontend + Platform
**Quarter**: Q2–Q3 2026
**North Star Metric**: % of monthly active users who interact with an interactive tool (Playground, A/B Test, or Evaluation) within 30 days of signup
**Current**: 0% (no interactive tools shipped)
**Target by EOY 2026**: 40%

---

## Supporting Metrics Dashboard

| Metric | Current | Target | Trend |
|--------|---------|--------|-------|
| Dashboard bundle size (gzipped) | ~180 KB | < 500 KB | → |
| Time to interactive (TTI) | ~1.2s | < 2.0s | → |
| Feature activation (Playground) | N/A | 20% by Q3 | ↑ |
| A/B test creation rate | N/A | 10% by Q4 | ↑ |
| Evaluation run rate | N/A | 15% by Q4 | ↑ |
| Customer-reported blocking UX issues | 0 | < 3/quarter | → |

---

## 🟢 Now — Active This Quarter (Q2 2026)
Committed work. Engineering and design fully aligned.

| Initiative | User Problem | Success Metric | Owner | Status | ETA |
|------------|-------------|----------------|-------|--------|-----|
| **Prompt Playground MVP** | Users cannot iterate on prompts without deploying code | 20% of MAU use Playground within 30 days of launch | Frontend Lead | In Design | Week of 2026-05-12 |
| **Component Library Reuse Sprint** | Rebuild time for common patterns is too high | 60% of new UI built from reused/adapted components | Frontend Lead | Scoping | Week of 2026-05-05 |
| **Playground Backend Proxy** | Need a secure way to run prompts against LLM providers from the UI | `/v1/playground/run` endpoint functional with 5 providers | Eng Lead | Not Started | Week of 2026-05-12 |
| **Stack Alignment** | Old frontend uses Redux/Yup/ApexCharts; new dashboard uses React Query/Zod/Recharts | Decision docs written; Zustand + Zod adopted | Frontend Lead | In Discussion | 2026-05-02 |

### Now — Detailed Breakdown

#### Initiative 1.1: Prompt Playground MVP
**Scope**: Port the old frontend's `PlaygroundLayout`, `EditorTab`, `ModelSelector`, `StreamingOutputPanel`, and `VariableSetsPanel` into the new Next.js dashboard.
**Key reused components**:
- `components/Playground/PlaygroundLayout.tsx` — split-pane layout (adapt to Resizable from shadcn)
- `components/Playground/tabs/EditorTab.tsx` — Monaco-based prompt editor
- `components/Playground/ModelSelector.tsx` — provider/model dropdown
- `components/Playground/StreamingOutputPanel.tsx` — streaming response display
- `components/Playground/VariableSetsPanel.tsx` — variable preset management
- `components/Playground/modals/ModelConfigDrawer.tsx` — temperature, max_tokens, etc.
- `components/Playground/modals/VariableSetModal.tsx` — create/edit variable sets
- `components/Playground/helpers/ParameterSchemaBuilder.tsx` — JSON schema editor

**Backend needs**:
- `POST /v1/playground/run` — proxy to OpenAI/Anthropic/etc. with workspace-scoped API keys.
- `GET /v1/playground/models` — list available models per workspace.

**Why P0**: This is the highest-value, most differentiating feature missing from the dashboard. Competitive analysis (LangSmith, PromptLayer) shows that playground usage correlates strongly with retention.

#### Initiative 1.2: Component Library Reuse Sprint
**Scope**: Audit `pm-app-frontend/src/components/Common/` and `src/components/Playground/helpers/` for pure UI components that can be dropped into the new dashboard with minimal changes.
**Deliverables**:
- Reusable modal patterns mapped to shadcn Dialog
- Date range picker mapped to shadcn Popover + Calendar
- Skeleton loader patterns mapped to shadcn Skeleton
- Form input wrappers mapped to shadcn Input + Label
- Toast/notification system consolidated to Sonner

---

## 🟡 Next — Next 1–2 Quarters (Q3 2026)
Directionally committed. Requires scoping before dev starts.

| Initiative | Hypothesis | Expected Outcome | Confidence | Blocker |
|------------|------------|-----------------|------------|---------|
| **A/B Testing Module** | If users can A/B test prompt versions, win-rate-driven decisions will replace gut feel | 10% of prompts have an active or completed A/B test | High | Needs backend `/v1/ab-tests/*` endpoints |
| **Evaluation Manager v1** | If users can define eval criteria and run them against datasets, prompt quality will improve measurably | 15% of prompts have at least one evaluation run | High | Needs dataset storage + eval runner backend |
| **Compliance & Risk Dashboard** | If security teams can see compliance scores, enterprise adoption velocity will increase | 3 enterprise pilots reference compliance dashboard in procurement | Medium | Needs compliance scoring backend (may be rule-based v1) |
| **Prompt Version Comparison (Diff)** | If users can diff prompt versions side-by-side, version approval workflows will speed up | 25% of version bumps use the diff view | High | Needs `react-diff-view` dependency; minimal backend work |
| **Enhanced Analytics** | If we surface per-prompt cost/latency/token breakdowns, users will optimize spend faster | Avg cost per 1K requests drops 10% for active users | Medium | Needs `/v1/metrics/prompts` backend (already exists) |

### Next — Detailed Breakdown

#### Initiative 2.1: A/B Testing Module
**Reused components**:
- `modules/ab-testing/pages/ABTestingPage.tsx`
- `modules/ab-testing/components/CreateABTestModal.tsx`
- `modules/ab-testing/components/ABTestResultModal.tsx`
- `components/Playground/tabs/ABTestingTab.tsx`

**Backend needs**:
- `POST /v1/ab-tests` — create test
- `GET /v1/ab-tests` — list tests
- `GET /v1/ab-tests/:id` — results with statistical significance
- `POST /v1/ab-tests/:id/promote` — promote winner

#### Initiative 2.2: Evaluation Manager v1
**Reused components**:
- `modules/evaluation/pages/EvaluationManager.tsx`
- `modules/evaluation/pages/CreateEvaluation.tsx`
- `modules/evaluation/pages/CreateDataset.tsx`
- `components/Playground/tabs/EvaluationTab.tsx`

**Backend needs**:
- `POST /v1/evaluations` — create eval criteria
- `POST /v1/evaluations/:id/run` — run eval against dataset
- `GET /v1/evaluations/:id/results` — fetch results
- Dataset storage (SQLite table `datasets`)

#### Initiative 2.3: Compliance & Risk Dashboard
**Reused components**:
- `modules/compliance/pages/ReviewPromptsPage.tsx`
- `components/Compliance/RiskDistributionCard.tsx`
- `components/Compliance/ComplianceMetricsCard.tsx`
- `components/Compliance/IntegrityBadge.tsx`

**Backend needs**:
- `GET /v1/compliance/score` — aggregate compliance score per prompt
- `GET /v1/compliance/violations` — list violations with severity
- Rule engine (v1 can be regex/heuristic-based; v2 may use LLM-as-judge)

---

## 🔵 Later — 3–6 Month Horizon (Q4 2026)
Strategic bets. Not scheduled. Will advance to Next when evidence or priority warrants.

| Initiative | Strategic Hypothesis | Signal Needed to Advance |
|------------|---------------------|--------------------------|
| **Billing & Usage Management** | Self-serve billing reduces support overhead and increases conversion from free to paid | 3+ enterprise customers ask for usage-based billing or hit API rate limits |
| **Advanced Workspace RBAC** | Granular permissions (prompt-level, env-level) unblock enterprise procurement | Security review feedback consistently flags "lack of fine-grained RBAC" |
| **Real-time Collaboration** | Multi-user playground editing reduces iteration latency for teams | Playground MAU > 40% and qualitative feedback requests "share my session" |
| **Regression Testing Suite** | Automated regression catches prompt regressions before production | 2+ incident post-mortems cite "prompt drift" as root cause |
| **Mobile-Responsive Admin** | Admins need to approve prompts / review alerts from mobile | Analytics show > 15% of dashboard sessions on mobile/tablet |

---

## ❌ What We're Not Building (and Why)

| Request | Source | Reason for Deferral | Revisit Condition |
|---------|--------|---------------------|-----------------|
| Full Organization/Org-member module | Old frontend parity | New backend uses simpler workspace model; org features are overkill for current user size | > 50 workspaces or enterprise SSO demand |
| Stripe Billing portal | Old frontend parity | No billing backend exists yet; premature for open-source core | Commercial hosted version planned |
| Socket.IO real-time updates | Old frontend parity | Polling is sufficient; Socket.IO adds infra complexity | Real-time collaboration initiative approved |
| Custom theming / white-label | Old frontend parity | Adds CSS complexity; dark mode is sufficient for v1 | Enterprise customer explicitly requires white-label |
| Mobile-native app | Feature request | Web responsive is sufficient; MAU on mobile < 5% | Mobile MAU > 15% for 2 consecutive quarters |

---

## RICE Prioritization Summary

| Initiative | Reach | Impact | Confidence | Effort | RICE Score |
|------------|-------|--------|------------|--------|------------|
| Playground MVP | 80% MAU | 2 | 90% | M | 144 |
| A/B Testing | 40% MAU | 2 | 85% | L | 68 |
| Evaluation Manager | 35% MAU | 2 | 85% | L | 59 |
| Compliance Dashboard | 20% MAU | 3 | 60% | M | 36 |
| Version Diff | 60% MAU | 1 | 95% | S | 57 |
| Billing | 10% MAU | 2 | 50% | XL | 5 |
| Real-time Collab | 15% MAU | 2 | 40% | XL | 4 |

*RICE = (Reach × Impact × Confidence) ÷ Effort. Effort scale: S=1, M=2, L=3, XL=5.*

---

## Appendix

- **Reference codebase**: `~/Documents/pm-app-frontend/`
- **Target codebase**: `/Users/izzy/Documents/pm-opensource/code/promptmetrics/ui/`
- **API contract**: `ui/src/lib/api.ts`
- **Design system**: `ui/src/components/ui/*` (shadcn/ui primitives)
- **Existing dashboard plan**: `docs/plans/observability-dashboard-implementation-plan.md`
