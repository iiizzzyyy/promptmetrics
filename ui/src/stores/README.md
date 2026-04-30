# State Management Conventions

## Decision Matrix

| State Type | Library | When to Use |
|-----------|---------|-------------|
| Server state | TanStack React Query | Data fetched from API (`api.ts`) — prompts, logs, traces, runs, evaluations |
| Shared UI state | Zustand | Ephemeral UI chrome — pane sizes, drawer open/close, modal stack, sidebar toggle |
| Local component state | `useState` / `useReducer` | Form inputs, local toggles, hover states — anything not shared across components |

## Stores

### `playground.store.ts`
Session-scoped state for the Playground page. Resets on refresh.

### `ui.store.ts`
Global UI chrome state. Survives soft navigation but NOT page refresh.

## Rules
- Do NOT persist Zustand stores to `localStorage` for tool UIs (Playground).
- React Query owns caching, deduplication, and background refetching.
- If data came from `api.ts`, it belongs in React Query.
- If it controls UI chrome, it belongs in Zustand.
