'use client';

import React from 'react';
import { auditApi, type AuditLogEntry } from '@/lib/api';

export default function LogsPage() {
  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    auditApi
      .list()
      .then((res) => setLogs(res.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Audit Logs</h1>
      {loading && <p className="text-zinc-500">Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="rounded-md border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Action</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Prompt</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Version</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Key</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <td className="px-4 py-2">{log.action}</td>
                <td className="px-4 py-2">{log.prompt_name || '-'}</td>
                <td className="px-4 py-2">{log.version_tag || '-'}</td>
                <td className="px-4 py-2">{log.api_key_name || '-'}</td>
                <td className="px-4 py-2">
                  {log.timestamp ? new Date(log.timestamp * 1000).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
