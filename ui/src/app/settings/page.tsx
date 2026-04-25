'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { apiKey, setApiKey } = useAuth();
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    setUrl(window.location.origin);
  }, []);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      <div className="space-y-4">
        <div className="rounded-md border p-4">
          <label className="block text-sm font-medium mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter X-API-Key"
            className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
          />
          <p className="text-xs text-zinc-500 mt-1">Stored in localStorage.</p>
        </div>
        <div className="rounded-md border p-4">
          <label className="block text-sm font-medium mb-1">Server URL</label>
          <input
            type="text"
            value={url}
            readOnly
            className="w-full rounded-md border px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700"
          />
          <p className="text-xs text-zinc-500 mt-1">Configure via NEXT_PUBLIC_API_URL.</p>
        </div>
      </div>
    </div>
  );
}
