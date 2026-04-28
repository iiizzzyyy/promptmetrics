"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const API_KEY_STORAGE_KEY = "pm-api-key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("default");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
                The API key is used to authenticate requests to the PromptMetrics backend.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace">Workspace</Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="default"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Workspace switching will be available in a future release.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} size="sm">
                Save
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
