'use client';

import { useAuth } from '@/lib/auth';

export function ApiKeyInput() {
  const { apiKey, setApiKey } = useAuth();

  return (
    <div className="px-4 py-3 border-t">
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
        API Key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter X-API-Key"
        className="w-full rounded-md border px-2 py-1 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700"
      />
    </div>
  );
}
