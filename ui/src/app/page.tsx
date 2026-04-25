import Link from "next/link";

export default function Home() {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">PromptMetrics Dashboard</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Browse prompts, logs, traces, runs, and labels.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: '/prompts', label: 'Prompts', desc: 'View and manage prompts' },
          { href: '/logs', label: 'Logs', desc: 'Audit log entries' },
          { href: '/traces', label: 'Traces', desc: 'Execution traces' },
          { href: '/runs', label: 'Runs', desc: 'Workflow runs' },
          { href: '/labels', label: 'Labels', desc: 'Prompt labels' },
          { href: '/settings', label: 'Settings', desc: 'Configure API key' },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-md border p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="font-medium">{card.label}</div>
            <div className="text-sm text-zinc-500 mt-1">{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
