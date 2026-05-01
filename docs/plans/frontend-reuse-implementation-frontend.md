# Frontend Reuse Implementation Plan
**Target**: PromptMetrics Next.js Dashboard (`ui/`)
**Source**: PromptSmith Legacy Frontend (`~/Documents/pm-app-frontend/`)
**Status**: Draft for Frontend Lead review
**Last Updated**: 2026-04-29

---

## 1. Phase-by-Phase Implementation Roadmap

### Phase 1: Foundation (Weeks 1–2)
**Goal**: Align the stack, extend shadcn/ui, and establish the API adapter layer so subsequent feature ports are pure component work.

| Deliverable | Location | Effort |
|-------------|----------|--------|
| Install runtime dependencies (zustand, react-hook-form, zod, sonner, @monaco-editor/react, date-fns) | `ui/package.json` | 2h |
| Extend shadcn primitives: Drawer, Resizable, Calendar, Popover, Textarea, Slider, Toggle Group, Badge variants | `ui/src/components/ui/*` | 8h |
| Create `usePlaygroundStore` (Zustand) for client-only UI state | `ui/src/stores/playground.store.ts` | 4h |
| Build `PlaygroundAPI` adapter layer extending `ui/src/lib/api.ts` | `ui/src/lib/playground-api.ts` | 6h |
| Port pure UI helpers (ConfirmModal, DiscardChangesModal, DateRangePicker) | `ui/src/components/common/*` | 6h |
| Set up dynamic-import boundaries for Monaco and heavy modals | `ui/src/components/lazy/*` | 3h |

**Key decisions**
- Zustand is adopted for client UI state (drawer open/close, panel sizes, playground session drafts). Server state remains in TanStack React Query.
- The Playground adapter isolates legacy API shapes from the new backend contract. If the backend `/v1/playground/run` payload changes, only the adapter file changes.

---

### Phase 2: Playground MVP (Weeks 3–5)
**Goal**: Port the 8 core playground components and wire them to the new backend proxy.

| Component | Source | Target | Strategy |
|-----------|--------|--------|----------|
| `PlaygroundLayout` | `components/Playground/PlaygroundLayout.tsx` | `ui/src/app/playground/page.tsx` + `ui/src/components/playground/PlaygroundLayout.tsx` | Adapt split-pane to shadcn Resizable; remove Redux/connect; replace `useNavigate` with `useRouter` |
| `EditorTab` | `components/Playground/tabs/EditorTab.tsx` | `ui/src/components/playground/EditorTab.tsx` | Monaco editor stays; wrap in `React.Suspense`; replace Axios with `fetch` via playground adapter |
| `ModelSelector` | `components/Playground/ModelSelector.tsx` | `ui/src/components/playground/ModelSelector.tsx` | Replace custom button with shadcn `Select` + provider icon helper |
| `StreamingOutputPanel` | `components/Playground/StreamingOutputPanel.tsx` | `ui/src/components/playground/StreamingOutputPanel.tsx` | Replace Axios stream handler with native `fetch` reader against `/v1/runs` stream; keep Lucide icons |
| `VariableSetsPanel` | `components/Playground/VariableSetsPanel.tsx` | `ui/src/components/playground/VariableSetsPanel.tsx` | Remove Redux `useSelector`; pass data via props or Zustand; replace old `Button` with shadcn `Button` |
| `ModelConfigDrawer` | `components/Playground/modals/ModelConfigDrawer.tsx` | `ui/src/components/playground/ModelConfigDrawer.tsx` | Map to shadcn Drawer + Slider + Input |
| `VariableSetModal` | `components/Playground/modals/VariableSetModal.tsx` | `ui/src/components/playground/VariableSetModal.tsx` | shadcn Dialog + react-hook-form + Zod validation |
| `ParameterSchemaBuilder` | `components/Playground/helpers/ParameterSchemaBuilder.tsx` | `ui/src/components/playground/ParameterSchemaBuilder.tsx` | Pure UI port; no data-layer changes |

**Backend contract assumptions**
- `POST /v1/playground/run` accepts `{ prompt_name, version_tag, model, variables, parameters }` and returns a streaming NDJSON response.
- `GET /v1/playground/models` returns `PaginatedResponse<Model>`.

---

### Phase 3: A/B Testing + Evaluation Manager (Weeks 6–8)
**Goal**: Port complex modules that require new backend endpoints but have highly reusable UI trees.

| Module | Source | Target | Strategy |
|--------|--------|--------|----------|
| `ABTestingTab` | `components/Playground/tabs/ABTestingTab.tsx` | `ui/src/components/playground/tabs/ABTestingTab.tsx` | Replace Redux data with React Query hooks; keep tab interaction logic |
| `CreateABTestModal` | `modules/ab-testing/components/CreateABTestModal.tsx` | `ui/src/components/ab-testing/CreateABTestModal.tsx` | shadcn Dialog + Zod schema; submit via `api.ts` wrapper |
| `ABTestResultModal` | `modules/ab-testing/components/ABTestResultModal.tsx` | `ui/src/components/ab-testing/ABTestResultModal.tsx` | Port Recharts-based result cards; replace Axios with `fetch` |
| `EvaluationTab` | `components/Playground/tabs/EvaluationTab.tsx` | `ui/src/components/playground/tabs/EvaluationTab.tsx` | Adapt to new eval schema; reuse UI skeleton |
| `EvaluationManager` | `modules/evaluation/pages/EvaluationManager.tsx` | `ui/src/app/evaluations/page.tsx` | Replace Redux with React Query; wrap in `DashboardLayout` |
| `CreateEvaluation` | `modules/evaluation/pages/CreateEvaluation.tsx` | `ui/src/app/evaluations/new/page.tsx` | Next.js routing; react-hook-form + Zod |
| `CreateDataset` | `modules/evaluation/pages/CreateDataset.tsx` | `ui/src/app/evaluations/datasets/new/page.tsx` | Next.js routing; port modal content into page |
| `VersionTimeline` | `components/Playground/VersionTimeline.tsx` | `ui/src/components/prompts/VersionTimeline.tsx` | Replace `useNavigate` with `next/link`; keep timeline markup |

---

### Phase 4: Compliance + Polish (Weeks 9–10)
**Goal**: Ship compliance views, perform bundle-size audit, and polish accessibility.

| Deliverable | Location | Notes |
|-------------|----------|-------|
| `ComplianceQuickSummary` + `RiskDistributionCard` | `ui/src/components/compliance/*` | Direct reuse with Tailwind token remap |
| `IntegrityBadge` | `ui/src/components/compliance/IntegrityBadge.tsx` | shadcn Badge variant |
| ReviewPromptsPage | `ui/src/app/compliance/page.tsx` | Wrap cards in `DashboardLayout` |
| Bundle-size audit + code-splitting pass | `ui/next.config.*` | Enforce dynamic imports for Monaco, modals, and charts |
| Accessibility pass (keyboard traps, focus management, ARIA) | All `ui/src/components/playground/*` | See Accessibility Checklist below |
| E2E coverage for Playground, A/B Test, Evaluation | `ui/e2e/` | Expand existing Playwright suite |

---

## 2. Per-Component Migration Guide

### 2.1 ConfirmModal / DiscardChangesModal
**Before (old)**
```tsx
// ~/Documents/pm-app-frontend/src/components/Common/ConfirmModal.tsx
import { Modal } from "./Modal";
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md w-full">
      <div className="p-6">{/* custom markup */}</div>
    </Modal>
  );
};
```

**After (new)**
```tsx
// ui/src/components/common/ConfirmModal.tsx
"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  variant = "default",
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 2.2 DateRangePicker
**Before (old)**
```tsx
// ~/Documents/pm-app-frontend/src/components/Common/DateRangePicker.tsx
import { DateRangePicker } from "react-date-range";
// custom modal ref, click-outside handler, manual resize listener
```

**After (new)**
```tsx
// ui/src/components/common/DateRangePicker.tsx
"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DateRangePicker({
  range,
  onChange,
}: {
  range: { from: Date; to: Date } | undefined;
  onChange: (range: { from: Date; to: Date } | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {range?.from ? (
            range.to ? (
              <>
                {format(range.from, "LLL dd, y")} - {format(range.to, "LLL dd, y")}
              </>
            ) : (
              format(range.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={range?.from}
          selected={range}
          onSelect={(r) => {
            onChange(r ? { from: r.from, to: r.to } : undefined);
            if (r?.to) setOpen(false);
          }}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
```

---

### 2.3 ModelSelector
**Before (old)**
```tsx
// ~/Documents/pm-app-frontend/src/components/Playground/ModelSelector.tsx
<button onClick={onOpenDrawer} className="w-full h-full bg-white/90 ...">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-lightgradient4 ...">
      {getProviderIcon(selectedModel?.providerSlug || "", "w-5 h-5")}
    </div>
    <div className="text-left">
      <span className="text-xs font-medium text-gray-500 uppercase">{selectedModel?.providerName}</span>
      <div className="font-semibold text-gray-900 truncate">{selectedModel?.name || "Select Model"}</div>
    </div>
  </div>
</button>
```

**After (new)**
```tsx
// ui/src/components/playground/ModelSelector.tsx
"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProviderIcon } from "@/lib/provider-icons";

interface Model {
  id: string;
  name: string;
  providerName: string;
  providerSlug: string;
}

export function ModelSelector({
  models,
  value,
  onChange,
}: {
  models: Model[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = models.find((m) => m.id === value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          {selected && getProviderIcon(selected.providerSlug, "w-4 h-4")}
          <SelectValue placeholder="Select Model" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <div className="flex items-center gap-2">
              {getProviderIcon(m.providerSlug, "w-4 h-4")}
              <span className="text-xs text-muted-foreground uppercase">{m.providerName}</span>
              <span className="font-medium">{m.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

### 2.4 StreamingOutputPanel
**Before (old)**
```tsx
// ~/Documents/pm-app-frontend/src/components/Playground/StreamingOutputPanel.tsx
// Uses Axios interceptor for streaming + local component state
useEffect(() => {
  axios.post("/api/playground/run", payload, { responseType: "stream" });
}, []);
```

**After (new)**
```tsx
// ui/src/components/playground/StreamingOutputPanel.tsx
"use client";
import { useEffect, useRef, useState } from "react";

export function StreamingOutputPanel({ runId }: { runId: string }) {
  const [content, setContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/v1/runs/${runId}/stream`, { signal: abort.signal })
      .then(async (res) => {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        while (reader) {
          const { done, value } = await reader.read();
          if (done) {
            setIsComplete(true);
            break;
          }
          setContent((prev) => prev + decoder.decode(value, { stream: true }));
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, [runId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-4">
        <pre className="whitespace-pre-wrap text-sm font-mono">{content}</pre>
        {!isComplete && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
      </div>
    </div>
  );
}
```

---

### 2.5 PlaygroundLayout (Resizable Adaptation)
**Before (old)**
```tsx
// ~/Documents/pm-app-frontend/src/components/Playground/PlaygroundLayout.tsx
// Uses a custom split-pane library or CSS grid with manual drag handles
<div className="flex h-screen">
  <div className="w-1/3">{sidebar}</div>
  <div className="w-2/3">{editor + output}</div>
</div>
```

**After (new)**
```tsx
// ui/src/components/playground/PlaygroundLayout.tsx
"use client";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TemplateSidebar } from "./TemplateSidebar";
import { EditorTab } from "./tabs/EditorTab";
import { StreamingOutputPanel } from "./StreamingOutputPanel";

export function PlaygroundLayout() {
  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-4rem)]">
      <ResizablePanel defaultSize={25} minSize={20}>
        <TemplateSidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={75}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={60}>
            <EditorTab />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40}>
            <StreamingOutputPanel runId="temp" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

---

### 2.6 VariableSetsPanel
**Before (old)**
```tsx
// ~/Documents/pm-app-frontend/src/components/Playground/VariableSetsPanel.tsx
const { _id: userId } = useSelector(getUserData);
<Button onClick={(e) => { e.stopPropagation(); onAddSet(); Mixpanel.track(...); }} ... />
```

**After (new)**
```tsx
// ui/src/components/playground/VariableSetsPanel.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Copy, Trash2, Plus, History } from "lucide-react";

export type VariablePair = { name: string; value: string };
export type VariableSet = { id: number; name: string; variables: VariablePair[] };

interface Props {
  variableSets: VariableSet[];
  onAddSet: () => void;
  onOpenSet: (set: VariableSet) => void;
  onDuplicate: (set: VariableSet) => void;
  onDeleteSet: (set: VariableSet) => void;
  onOpenHistory: () => void;
  readonly?: boolean;
}

export function VariableSetsPanel({ variableSets, onAddSet, onOpenSet, onDuplicate, onDeleteSet, onOpenHistory, readonly }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <h3 className="font-semibold text-sm">Input Variable Sets</h3>
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenHistory} disabled={readonly}>
            <History className="w-3 h-3 mr-1" /> History
          </Button>
          <Button size="sm" onClick={onAddSet} disabled={readonly}>
            <Plus className="w-3 h-3 mr-1" /> Add Set
          </Button>
        </div>
      </div>
      <CollapsibleContent className="p-4 space-y-2">
        {variableSets.map((set, idx) => (
          <div key={set.id} onClick={() => onOpenSet(set)} className="rounded-lg border p-3 hover:bg-muted cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Set #{idx + 1}</span>
                <span className="text-xs text-muted-foreground">{set.variables.length} vars</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDuplicate(set); }} disabled={readonly}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteSet(set); }} disabled={readonly}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {set.variables.map((v, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="font-medium text-muted-foreground min-w-[90px]">{v.name}:</span>
                  <span className="text-muted-foreground truncate">{v.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

---

## 3. Stack Translation Cheatsheet

| Concern | Old Pattern | New Pattern | Migration Action |
|---------|-------------|-------------|------------------|
| **Global State** | Redux Toolkit slices (`redux/slices/*.slice.ts`) | Zustand store (`ui/src/stores/*.store.ts`) | Remove `useDispatch`/`useSelector`; create atomic stores per domain |
| **Server State** | Redux thunks + manual caching | TanStack React Query (`useQuery`, `useMutation`) | Replace thunk dispatch with `useQuery`/`useMutation`; derive cache keys from entity + params |
| **Routing** | React Router DOM (`useNavigate`, `<NavLink>`) | Next.js App Router (`useRouter`, `next/link`) | Replace `useNavigate()` with `useRouter().push`; replace `<NavLink>` with `<Link>` from `next/link` |
| **Forms** | React Hook Form + Yup (`validationSchemas/*.ts`) | React Hook Form + Zod (`zodResolver`) | Translate Yup `.required()` / `.string()` to `z.string().min(1)`; replace `.shape()` with `z.object()` |
| **Charts** | ApexCharts + Chart.js | Recharts only | Port `ApexChart` `series` + `options` to `<LineChart>`, `<BarChart>`, `<AreaChart>` from Recharts |
| **HTTP** | Axios instance + interceptors | Native `fetch` via `ui/src/lib/api.ts` | Replace `axios.get/post` with `api.getX()` or direct `fetchJson`; remove interceptors; use React Query `queryFn` |
| **Notifications** | notistack + toastify + SweetAlert2 | Sonner (`ui/src/components/ui/sonner.tsx`) | Replace `enqueueSnackbar` with `toast.success/error`; replace SweetAlert2 confirm with shadcn Dialog |
| **Icons** | Lucide + React Icons | Lucide only | Replace `react-icons/fi` or `react-icons/md` with nearest Lucide equivalent (e.g., `FiSettings` -> `Settings`) |
| **Modals** | Custom `<Modal>` backdrop + portal | shadcn Dialog/Drawer/Sheet | Remove manual `createPortal` and backdrop styles; use `DialogContent` which handles `focus-trap` and `ScrollLock` |
| **Tables** | ag-grid-react | TanStack Table + shadcn Table primitives | Port columnDefs to `columns` array; use `flexRender` for cells; keep virtual scrolling for >500 rows |

---

## 4. shadcn/ui Component Mapping

| Old Component (PromptSmith) | shadcn Primitive(s) | Install Command | Notes |
|-----------------------------|---------------------|-----------------|-------|
| `Common/Modal.tsx` | `Dialog` | `npx shadcn add dialog` | Drop-in replacement; supports `focus-trap`, `aria-describedby`, and body scroll lock automatically |
| `Common/ConfirmModal.tsx` | `Dialog` + `Button` | already installed | Map `isOpen` -> `open`; `onClose` -> `onOpenChange` |
| `Common/DateRangePicker.tsx` | `Popover` + `Calendar` | `npx shadcn add popover calendar` | Replace `react-date-range` with `date-fns` powered shadcn Calendar |
| `Common/Button.tsx` | `Button` | already installed | Remove custom hover/gradient classes; use `variant` and `size` props |
| `Common/InputField.tsx` | `Input` + `Label` + `Form` | already installed | Map validation errors to `FormMessage` inside `FormItem` |
| `Common/Tabs.tsx` | `Tabs` | already installed | Replace custom tab state with `Tabs` + `TabsList` + `TabsTrigger` |
| `Playground/ModelSelector.tsx` | `Select` | already installed | Use `SelectContent` with grouped items; provider icons as `SelectItem` prefix |
| `Playground/ModelConfigDrawer.tsx` | `Drawer` + `Slider` + `Input` | `npx shadcn add drawer slider` | Temperature slider -> shadcn `Slider`; max_tokens -> `Input type="number"` |
| `Playground/PlaygroundLayout.tsx` | `Resizable` | `npx shadcn add resizable` | Replace custom drag handles with `ResizableHandle` |
| `Playground/VariableSetModal.tsx` | `Dialog` + `Form` | already installed | Wrap variable form in `react-hook-form` + Zod resolver |
| `Compliance/RiskDistributionCard.tsx` | `Card` + `Badge` | already installed | Map risk levels to `Badge` variants |
| `Compliance/ComplianceMetricsCard.tsx` | `Card` + `Progress` | `npx shadcn add progress` | Use `Progress` for score bars |
| `Evaluation/EvaluationTable.tsx` | `Table` + `Skeleton` | already installed | Port ag-grid column definitions to TanStack Table `columns` array |

---

## 5. Tailwind v4 to v3 Migration Notes

The legacy frontend uses Tailwind CSS v4 syntax (arbitrary values, custom utilities, and `bg-lightgradient*` tokens). The new dashboard uses Tailwind v3 + shadcn/ui design tokens.

### 5.1 Arbitrary Value Replacement

| Old (v4) | New (v3 + shadcn) | Rationale |
|----------|-------------------|-----------|
| `bg-white/90 backdrop-blur-sm` | `bg-card/90 backdrop-blur-sm` | Use semantic `card` token so dark mode works |
| `bg-lightgradient4` | `bg-muted` or `bg-gradient-to-br from-muted to-accent` | Replace bespoke gradients with semantic tokens |
| `bg-lightgradient7` | `bg-muted/50` | Same as above |
| `bg-green/10` | `bg-primary/10` | `green` is the brand color; map to `primary` |
| `text-green` | `text-primary` | Consistent with shadcn token system |
| `text-dark` | `text-foreground` | shadcn foreground token |
| `text-gray-500` | `text-muted-foreground` | Semantic muted text |
| `border-gray-200/50` | `border-border/50` | shadcn border token |
| `hover:bg-white/80` | `hover:bg-accent` | Use accent for hover states |
| `shadow-md rounded-xl lg:rounded-2xl` | `shadow-sm rounded-xl` | Reduce radius proliferation; use `rounded-xl` as standard |

### 5.2 Custom Token Migration

Old frontend defines custom tokens in a v4 CSS file (e.g., `--color-lightgradient4`). The new dashboard defines custom colors in `tailwind.config.ts` under `theme.extend.colors.pm`.

**Action**: Audit all `bg-*` and `text-*` classes in ported components against the mapping table above. If a token has no semantic equivalent, add it to `tailwind.config.ts` under `pm` namespace (e.g., `pm-brand-bright`) rather than creating one-off arbitrary values.

### 5.3 Container and Spacing

- Remove `max-w-4xl w-full` from modal internals; `DialogContent` already enforces `sm:max-w-md` etc.
- Replace manual `px-4 py-2` padding stacks with shadcn `gap-4` + `p-6` defaults inside `Card` and `Dialog`.

---

## 6. Bundle Size Optimization Strategy

**Current baseline**: ~180 KB gzipped (observability dashboard only).
**Budget after Playground MVP**: < 500 KB gzipped.
**Hard ceiling**: 1.5 MB gzipped (rollback trigger per PRD).

### 6.1 Lazy Loading Boundaries

| Asset | Import Strategy | File |
|-------|----------------|------|
| Monaco Editor | `next/dynamic` with `ssr: false` | `ui/src/components/playground/EditorTab.tsx` |
| `ParameterSchemaBuilder` | `next/dynamic` | `ui/src/components/playground/ParameterSchemaBuilder.tsx` |
| `ABTestResultModal` | `next/dynamic` | `ui/src/components/ab-testing/ABTestResultModal.tsx` |
| `CreateABTestModal` | `next/dynamic` | `ui/src/components/ab-testing/CreateABTestModal.tsx` |
| Recharts (existing charts) | Already tree-shaken; no action needed | `ui/src/components/charts/*` |

Example:
```tsx
import dynamic from "next/dynamic";
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
```

### 6.2 Code Splitting by Route

Next.js App Router automatically code-splits by route. Ensure that `/playground`, `/evaluations`, and `/compliance` do not share a single heavy chunk:
- Keep layout shells (`DashboardLayout`, `AdminSidebar`) in the root layout.
- Do **not** import playground-specific heavy components in `ui/src/app/page.tsx` or `layout.tsx`.

### 6.3 Dependency Deduplication

- Remove `chart.js` and `apexcharts` from the dependency tree entirely.
- Consolidate date handling to `date-fns` (already a transitive dependency of shadcn Calendar); remove `dayjs` or `moment` if introduced by legacy code.
- Use `lucide-react` tree-shaking (already working); ban `react-icons` imports via ESLint rule.

### 6.4 Monitoring

Add `next-bundle-analyzer` as a dev dependency and run it before each Phase gate:
```bash
npx next-bundle-analyzer ui/.next/stats.json
```

---

## 7. Accessibility Checklist for Ported Components

Every component ported from the old frontend must pass the following checks before merge.

### 7.1 Keyboard Navigation

| Component | Requirement | Test |
|-----------|-------------|------|
| `PlaygroundLayout` | Resizable panels must be adjustable via keyboard (`ArrowLeft`/`ArrowRight`). | Tab to handle, press arrow keys. |
| `ModelSelector` | Select options must be navigable with `ArrowUp`/`ArrowDown` and confirmable with `Enter`. | shadcn Select handles this natively. |
| `VariableSetsPanel` | Collapsible toggle must respond to `Enter`/`Space`. | shadcn Collapsible handles this natively. |
| `DateRangePicker` | Calendar grid must be navigable with arrow keys; focus trap inside popover. | shadcn Calendar + Popover handle this natively. |
| `ConfirmModal` | Focus must be trapped inside the dialog; `Escape` closes; focus returns to trigger. | shadcn Dialog handles this natively. |
| `EditorTab` (Monaco) | Monaco must expose `role="textbox"` and support standard editor shortcuts. | Automated axe-core scan. |

### 7.2 Screen Reader Support

- All form inputs must have associated `<Label>` or `aria-label`.
- Live regions for streaming output: `StreamingOutputPanel` must use `aria-live="polite"` on the content container.
- Error states must be linked via `aria-describedby` to the offending input.
- Icons used without text must have `aria-hidden` or an `sr-only` label.

### 7.3 Motion and Contrast

- Respect `prefers-reduced-motion`: disable Monaco cursor blink animations and pulse effects when the media query is active.
- Minimum contrast ratio: 4.5:1 for all text (shadcn default tokens already meet WCAG 2.1 AA).
- Focus indicators must be visible (`ring-2 ring-ring ring-offset-2`).

### 7.4 ARIA Patterns

| Pattern | Required ARIA | Implementation |
|---------|---------------|----------------|
| Splitter (Resizable) | `role="separator"`, `aria-orientation`, `aria-valuenow` | shadcn Resizable injects these automatically. |
| Tabs (Playground sub-tabs) | `role="tablist"`, `role="tab"`, `role="tabpanel"` | shadcn Tabs injects these automatically. |
| Dialogs / Drawers | `role="dialog"`, `aria-modal="true"` | shadcn Dialog/Drawer injects these automatically. |
| Tooltips | `role="tooltip"` | Use `Tooltip` primitive from shadcn. |

---

## 8. Testing Strategy

### 8.1 Unit Tests (Jest + React Testing Library)

**Location**: `ui/src/components/**/*.test.tsx`

| Module | What to test | Mock strategy |
|--------|--------------|---------------|
| `ConfirmModal` | Open/close, confirm callback, escape key | Render with `screen`; fire `userEvent.keyboard('{Escape}')` |
| `ModelSelector` | Selection change, disabled state | Mock `models` array; assert `onChange` receives correct `model.id` |
| `VariableSetsPanel` | Collapse/expand, duplicate, delete | Pass mock handlers; assert call counts |
| `DateRangePicker` | Date selection, clear, apply | Mock `date-fns` if needed; assert `onChange` called with `Date` objects |
| `ParameterSchemaBuilder` | Add/remove properties, schema validation | Pure component test; no network mocks |
| Zustand stores | State transitions, persistence | Initialize store in `beforeEach`; call actions and assert state |

### 8.2 Integration Tests (React Testing Library + MSW)

**Location**: `ui/src/app/**/*.test.tsx`

| Flow | Test steps |
|------|------------|
| Playground run | 1. Render `/playground`. 2. Select model. 3. Fill variables. 4. Click Run. 5. Mock `/v1/playground/run` with MSW. 6. Assert `StreamingOutputPanel` renders streamed tokens. |
| Create A/B Test | 1. Render A/B test modal. 2. Fill form. 3. Submit. 4. Assert POST body matches Zod schema. 5. Assert success toast. |
| Evaluation creation | 1. Navigate to `/evaluations/new`. 2. Fill criteria. 3. Attach dataset. 4. Submit. 5. Assert navigation to `/evaluations`. |

**MSW setup**: Create `ui/src/mocks/handlers.ts` with handlers for:
- `GET /v1/playground/models`
- `POST /v1/playground/run`
- `GET /v1/ab-tests`
- `POST /v1/ab-tests`
- `GET /v1/evaluations`
- `POST /v1/evaluations`

### 8.3 E2E Tests (Playwright)

**Location**: `ui/e2e/`

| Spec file | Coverage | Critical path |
|-----------|----------|---------------|
| `playground.spec.ts` | Load playground, select prompt, edit variables, run, observe output | Yes |
| `ab-testing.spec.ts` | Create test, view results, promote winner | Yes |
| `evaluation.spec.ts` | Create eval, create dataset, attach, run, view results | Yes |
| `compliance.spec.ts` | View compliance page, expand risk cards | No |

**Data setup**: Use `global-setup.ts` to seed a demo workspace with prompts, runs, and evaluations via the existing `src/scripts/seed-demo-data.ts` script. E2E tests run against the local Next.js dev server (`localhost:3001`) with `NEXT_PUBLIC_DEMO_API_KEY`.

### 8.4 Visual Regression

- Add Playwright `snapshot` assertions for:
  - `playground.spec.ts-snapshots/playground-loaded-linux.png`
  - `ab-testing.spec.ts-snapshots/create-modal-open-linux.png`
- Run on CI with `ubuntu-latest` to avoid OS font rendering differences.

### 8.5 Performance Budget Tests

Add a CI step that fails if `ui/.next/static/chunks` exceeds thresholds:
```bash
# scripts/bundle-budget.sh
MAX_SIZE=500000 # 500KB gzipped
ACTUAL=$(gzip -c ui/.next/static/chunks/main-*.js | wc -c)
if [ "$ACTUAL" -gt "$MAX_SIZE" ]; then echo "Bundle size $ACTUAL exceeds $MAX_SIZE"; exit 1; fi
```

---

## 9. Appendix: File Path Reference

| Artifact | Path |
|----------|------|
| New dashboard entry | `ui/src/app/page.tsx` |
| Dashboard layout | `ui/src/components/layout/DashboardLayout.tsx` |
| API client | `ui/src/lib/api.ts` |
| Query client | `ui/src/lib/query-client.ts` |
| Tailwind config | `ui/tailwind.config.ts` |
| shadcn components | `ui/src/components/ui/*` |
| Old frontend source | `~/Documents/pm-app-frontend/src/` |
| Old playground components | `~/Documents/pm-app-frontend/src/components/Playground/` |
| Old AB testing module | `~/Documents/pm-app-frontend/src/modules/ab-testing/` |
| Old evaluation module | `~/Documents/pm-app-frontend/src/modules/evaluation/` |
| Backend OpenAPI spec | `docs/openapi.yaml` |
