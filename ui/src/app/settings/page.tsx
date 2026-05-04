"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setClientCsrfToken, clearCsrfToken } from "@/lib/csrf";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => process.env.NEXT_PUBLIC_DEMO_API_KEY || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save session");
      }

      const data = await res.json();
      if (data.csrfToken) {
        setClientCsrfToken(data.csrfToken);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "DELETE" });
      clearCsrfToken();
      setApiKey("");
      setSaved(false);
    } catch {
      // ignore
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-xl">
        <h1 className="pm-h3">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
              <p className="text-xs text-muted-foreground">
                The API key is stored server-side; only an opaque session cookie is kept in the browser.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} size="sm">
                Save
              </Button>
              <Button onClick={handleLogout} size="sm" variant="outline">
                Logout
              </Button>
              {saved && (
                <span className="text-sm text-green-500">Saved!</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>PromptMetrics Dashboard v1.1.0</p>
            <p>
              Observability dashboard for managing prompts, logs, traces, runs, and evaluations.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
