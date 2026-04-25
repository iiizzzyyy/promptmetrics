'use client';

import React from 'react';
import { runsApi, type RunResponse } from '@/lib/api';

export default function RunsPage() {
  const [runs, setRuns] = React.useState<RunResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    runsApi
      .list()
      .then((res) => setRuns(res.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Runs</h1>
      {loading && <p className="text-zinc-500">Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="space-y-2">
        {runs.map((run) => (
          <div key={run.run_id} className="rounded-md border px-4 py-3">
            <div className="font-medium">{run.workflow_name}</div>
            <div className="text-sm text-zinc-500">
              {run.status} · {run.run_id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
