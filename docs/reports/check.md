  Market Tool Research: What Paid Tools Provide vs. Audit Gaps                                                                           
                                                                                                                                         
  Executive Summary
                                                                                                                                         
  Most of the audit's critical issues can be resolved by PromptMetrics itself with small-to-medium effort using established open-source  
  patterns. However, several paid/premium tools in the market provide reference architectures and capabilities that directly map to the
  gaps discovered. No single paid tool is required — the issues are fixable in-house — but the market leaders show how to do it right.   
                                                                          
  ---                                                                                                                                    
  1. A/B Testing & Evaluation — The Biggest Gap
                                                                                                                                         
  Audit Issue: A/B Test "Run" button sends fabricated random scores. promoteWinner is a no-op.
                                                                                                                                         
  What Paid Tools Provide:                                                                                                               
                                                                                                                                         
  ┌─────────────┬────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐   
  │    Tool     │        Pricing         │                                    Relevant Capability                                    │ 
  ├─────────────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤   
  │ PromptLayer │ $49–$500/mo            │ Dedicated A/B Releases with traffic splitting, scheduled regression tests, and real       │ 
  │             │                        │ evaluation pipelines against usage history                                                │   
  ├─────────────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤   
  │ LangSmith   │ $39/seat + per-trace   │ Experiment tracking, evaluation runs, deployment uptime monitoring                        │
  ├─────────────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤   
  │ Evidently   │ Free (OSS) / $80/mo    │ 100+ built-in metrics, LLM-as-a-judge, synthetic data generation, regression test suites  │
  │ AI          │ Pro                    │ with Pass/Fail logic                                                                      │   
  ├─────────────┼────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤   
  │ GrowthBook  │ Free (OSS, MIT) /      │ Open-source experiment assignment, targeting by workspace, statistical significance       │
  │             │ Cloud paid             │ testing                                                                                   │   
  └─────────────┴────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘   
   
  Takeaway: PromptMetrics doesn't need to buy any of these. The fix is to wire the existing EvaluationService into the A/B test          
  controller. If the team later wants advanced targeting or statistical rigor, GrowthBook (open-source, MIT) is the recommended add-on.
                                                                                                                                         
  ---                                                                     
  2. Compliance / Security Scanning
                                   
  Audit Issue: Compliance detail dialog shows wrong data. Page unconditionally fetches 1000 items. No real scanning engine.
                                                                                                                                         
  What Paid Tools Provide:
                                                                                                                                         
  ┌───────────────────┬──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┐
  │       Tool        │         Pricing          │                                Relevant Capability                                │
  ├───────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤
  │ Lakera Guard      │ Free (10K req/mo) /      │ Real-time firewall for LLM apps: prompt injection, PII leakage, content           │
  │                   │ Enterprise               │ moderation, malicious link detection                                              │
  ├───────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤   
  │ Evidently AI      │ Free (OSS) / $80/mo Pro  │ PII detection, toxicity, hallucination detection, factuality scoring              │
  ├───────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────┤   
  │ Presidio          │ Free (MIT)               │ PII detection and anonymization — best for GDPR/CCPA compliance                   │
  │ (Microsoft)       │                          │                                                                                   │   
  └───────────────────┴──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘

  Takeaway: The Compliance page is currently a UI with no backend scanning engine. Lakera Guard (free tier: 10K req/mo) or the
  open-source LLM Guard can be integrated as sidecar APIs that the Compliance controller calls. This is the fastest path to making
  Compliance actually functional.

  ---
  3. Observability Dashboard & Tracing
                                      
  Audit Issue: Hardcoded error_rate: 0, JSON.parse crashes activity summary, hydration errors, accessibility gaps.
                                                                                                                                         
  What Paid Tools Provide:
                                                                                                                                         
  ┌───────────────┬───────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐ 
  │     Tool      │          Pricing          │                                 Relevant Capability                                 │ 
  ├───────────────┼───────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤ 
  │ Langfuse      │ Free (50K units/mo) /     │ Open-source (MIT), self-hostable with feature parity to cloud. Framework-agnostic   │ 
  │               │ $29–$199/mo               │ tracing, cost tracking, score tracking                                              │ 
  ├───────────────┼───────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    
  │ LangSmith     │ $39/seat + per-trace      │ Native LangChain tracing, agent observability, evaluation, deployment               │ 
  ├───────────────┼───────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    
  │ Weights &     │ ~$50/seat/mo              │ Full ML lifecycle + LLM tracing via W&B Weave                                       │
  │ Biases        │                           │                                                                                     │    
  └───────────────┴───────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                                         
  Takeaway: Langfuse is the closest direct competitor to PromptMetrics' dashboard. It is open-source and provides patterns for:          
  - Computing error rates from real trace data (solves hardcoded error_rate: 0)
  - Safe JSON parsing with graceful degradation                                                                                          
  - Accessible UI primitives (they use standard React patterns)           
                                                                                                                                         
  PromptMetrics should study Langfuse's OSS implementation for tracing and metrics computation patterns, but doesn't need to purchase it.
                                                                                                                                         
  ---                                                                                                                                    
  4. Playground Environment                                                                                                              
                                                                          
  Audit Issue: No input validation, dead settings button, ProviderRegistry crash on missing env vars, stream timeout fails.
                                                                                                                                         
  What Paid Tools Provide:                                                                                                               
                                                                                                                                         
  All leading tools (LangSmith, Langfuse, PromptLayer, Humanloop/Anthropic Console) use these patterns:                                  
  - BFF API Proxy — UI never holds provider API keys; backend proxies requests
  - Schema validation before any network call (model selected, prompt non-empty)                                                         
  - AbortController-based timeouts with client-side and server-side deadlines   
  - Lazy provider initialization with graceful fallbacks when env vars are missing                                                       
  - Collapsible settings drawer (temperature, max_tokens, top_p, JSON mode)                                                              
  - Cost estimation / token counter shown before running                                                                                 
                                                                                                                                         
  Takeaway: These are all implementable in-house. The most impactful immediate fixes are:                                                
  1. Add Zod validation + React Hook Form to the Playground                                                                              
  2. Implement AbortController with timeout wrapper                                                                                      
  3. Wrap ProviderRegistry in try/catch with a React Error Boundary                                                                      
                                                                                                                                         
  ---                                                                                                                                    
  5. UI Accessibility & Component Quality                                                                                                
                                                                                                                                         
  Audit Issue: Hydration errors (<button> inside <button>), missing focus traps, no keyboard navigation, non-functional resizable panels.
                                                                                                                                         
  What the Market Uses (Open Source):                                                                                                    
                                                                                                                                         
  ┌────────────────────────────────────┬──────────────────────────────────────────────────────────┬────────┐                             
  │              Problem               │                     Market Standard                      │ Effort │
  ├────────────────────────────────────┼──────────────────────────────────────────────────────────┼────────┤                             
  │ Hydration / invalid DOM nesting    │ Radix UI primitives (Dialog, Tabs, Popover, ToggleGroup) │ Small  │
  ├────────────────────────────────────┼──────────────────────────────────────────────────────────┼────────┤                             
  │ Focus traps, Escape-to-close, ARIA │ Radix UI (built-in) or React Aria (Adobe)                │ Small  │                             
  ├────────────────────────────────────┼──────────────────────────────────────────────────────────┼────────┤                             
  │ Keyboard navigation for Tabs       │ Radix UI Tabs (arrow-key nav out of the box)             │ Small  │                             
  ├────────────────────────────────────┼──────────────────────────────────────────────────────────┼────────┤                             
  │ Resizable panels                   │ react-resizable-panels (Brian Vaughn, MIT, 0 deps)       │ Small  │
  └────────────────────────────────────┴──────────────────────────────────────────────────────────┴────────┘                             
                                                                          
  Takeaway: These are solved problems. PromptMetrics should replace its custom primitives with Radix UI (already popular in the shadcn/ui
   ecosystem) and swap the resizable component for react-resizable-panels. Zero paid tools needed.
                                                                                                                                         
  ---                                                                     
  6. API Key Security
                                                                                                                                         
  Audit Issue: API key stored in localStorage, vulnerable to XSS extraction.
                                                                                                                                         
  What the Market Does:                                                                                                                  
                                                                                                                                         
  Every paid observability dashboard uses one of these patterns:                                                                         
  1. httpOnly, Secure, SameSite=strict cookie — JavaScript cannot read the key
  2. Backend-for-Frontend (BFF) Proxy — Next.js API routes proxy all requests; the browser never sees the API key                        
  3. Short-lived tokens in memory + refresh token in httpOnly cookie                                             
                                                                                                                                         
  Recommended fix for PromptMetrics: Use Next.js API routes as a BFF proxy. The UI talks to /api/proxy/*, and the API key is stored      
  server-side or injected by the proxy. This is how Langfuse and LangSmith handle it.                                                    
                                                                                                                                         
  ---                                                                                                                                    
  Prioritized Recommendation Matrix                                       
                                                                                                                                         
  Combined from both agents — ranked by Impact / Effort:                  
                                                                                                                                         
  ┌──────┬──────────────────────────────────────────┬────────────────────────────────────────────┬───────────────────────────────────┐   
  │ Rank │               Audit Issue                │              Recommended Fix               │       Can a Paid Tool Help?       │   
  ├──────┼──────────────────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────┤   
  │ 1    │ Backend auth gaps                        │ Apply existing middleware                  │ No — fix in-house                 │
  │      │ (requireScope('write'))                  │                                            │                                   │   
  ├──────┼──────────────────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────┤   
  │ 2    │ JSON.parse without try/catch             │ Wrap in try/catch, log and skip            │ No — fix in-house                 │   
  ├──────┼──────────────────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────┤   
  │ 3    │ error_rate hardcoded to 0                │ Compute from actual success/failure counts │ Learn from Langfuse OSS pattern   │   
  ├──────┼──────────────────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────┤
  │ 4    │ Missing audit logging on evaluation      │ Add auditLog() middleware                  │ No — fix in-house                 │   
  │      │ mutations                                │                                            │                                   │
  ├──────┼──────────────────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────┤   
  │ 5    │ Dataset deletion — no confirmation      │ Add Radix UI AlertDialog + optional         │ No — open-source primitive       │ 
  │      │                                         │ soft-delete                                 │                                  │    
  │      │                                        │ soft-delete                               │                                      │
  ├──────┼────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────┤   
  │ 6    │ Compliance detail wrong data /         │ Fix frontend to pass selected ID;         │ No — fix in-house                    │   
  │      │ limit:1000                             │ paginate backend                          │                                      │
  ├──────┼────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────┤   
  │ 7    │ API key in localStorage                │ Move to httpOnly cookie or BFF proxy      │ Learn from LangSmith/Langfuse        │   
  │      │                                        │                                           │ pattern                              │
  ├──────┼────────────────────────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────┤   
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤   
  │ 9    │ Playground — no input validation      │ Add Zod + React Hook Form                   │ No — open-source library            │
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤   
  │ 10   │ Playground — dead settings button     │ Implement Radix UI Sheet/Drawer or remove   │ No — open-source primitive          │
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤   
  │ 11   │ Playground — ProviderRegistry crash   │ Wrap in try/catch + React Error Boundary    │ No — fix in-house                   │
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤   
  │ 12   │ Playground — stream timeout fails     │ Implement AbortController with timeout      │ Learn from all paid tools           │
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤   
  │ 13   │ Resizable component non-functional    │ Replace with react-resizable-panels         │ No — open-source library            │
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤   
  │ 14   │ A/B Tests — fabricated scores         │ Wire to existing EvaluationService          │ Evidently AI or GrowthBook for      │
  │      │                                       │                                             │ advanced needs                      │   
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤
  │ 15   │ A/B Tests — promoteWinner no-op       │ Implement DB transaction, update winner     │ No — fix in-house                   │   
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤
  │ 16   │ UI primitives accessibility           │ Replace with Radix UI or React Aria         │ No — open-source libraries          │   
  ├──────┼───────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────────┤
  │ 17   │ Compliance scanning engine missing    │ Integrate Lakera Guard (free 10K/mo) or LLM │ Yes — Lakera Guard free tier        │   
  │      │                                       │  Guard (OSS)                                │                                     │
  └──────┴───────────────────────────────────────┴─────────────────────────────────────────────┴─────────────────────────────────────┘   
   
  ---                                                                                                                                    
  Bottom Line                                                             
                                                                                                                                         
  Do not buy any paid tool to fix the audit issues. Every critical and important issue can be resolved with:
  - Existing PromptMetrics code (auth middleware, EvaluationService, audit logging)                                                      
  - Free open-source libraries (Radix UI, Zod, React Hook Form, react-resizable-panels, react-error-boundary)                            
  - A single external API integration (Lakera Guard free tier, or open-source LLM Guard / Presidio)                                      
                                                                                                                                         
  The paid tools are valuable as reference architectures for how to build production-grade LLM observability, but PromptMetrics' gaps are
   implementation bugs and missing wiring — not missing capabilities that require a purchase.                                            
                                                                                                                                         
  Suggested 8-day sprint to production-safe:                                                                                             
  1. Days 1–2: Auth scopes, JSON.parse safety, error_rate computation, audit logging
  2. Days 3–4: Compliance lookup fix, dataset confirmation modal, API key storage fix                                                    
  3. Days 5–6: Radix UI migration (hydration + accessibility), playground validation, stream timeouts
  4. Days 7–8: Wire A/B tests to real evaluations, implement promoteWinner persistence                                                   
                                                                                                                                         
  The Trend Researcher agent is still running — I'll append any additional findings if they arrive.                                      
