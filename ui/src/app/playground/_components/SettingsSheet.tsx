"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export interface PlaygroundSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  jsonMode: boolean;
  timeoutMs: number;
}

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PlaygroundSettings;
  onSettingsChange: (settings: PlaygroundSettings) => void;
}

const DEFAULTS: PlaygroundSettings = {
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1.0,
  jsonMode: false,
  timeoutMs: 30000,
};

export function SettingsSheet({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: SettingsSheetProps) {
  const [draft, setDraft] = React.useState<PlaygroundSettings>(settings);

  const handleReset = () => {
    setDraft({ ...DEFAULTS });
  };

  const handleApply = () => {
    onSettingsChange(draft);
    onOpenChange(false);
  };

  const clamp = (val: number, min: number, max: number) =>
    Math.min(max, Math.max(min, val));

  const updateTemperature = (val: number) =>
    setDraft((d) => ({ ...d, temperature: Number(clamp(val, 0, 2).toFixed(1)) }));

  const updateMaxTokens = (val: number) =>
    setDraft((d) => ({ ...d, maxTokens: Math.round(clamp(val, 1, 8192)) }));

  const updateTopP = (val: number) =>
    setDraft((d) => ({ ...d, topP: Number(clamp(val, 0, 1).toFixed(2)) }));

  const updateJsonMode = (checked: boolean) =>
    setDraft((d) => ({ ...d, jsonMode: checked }));

  const updateTimeoutMs = (val: number) =>
    setDraft((d) => ({ ...d, timeoutMs: Math.round(clamp(val, 1000, 300000)) }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" onKeyDown={handleKeyDown}>
        <SheetHeader>
          <SheetTitle>Playground Settings</SheetTitle>
          <SheetDescription>
            Adjust model parameters and output format.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-8 overflow-y-auto py-4 px-6">
          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature-input">Temperature</Label>
              <Input
                id="temperature-input"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={draft.temperature}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateTemperature(val);
                }}
                className="w-24 text-right"
                aria-describedby="temperature-desc"
              />
            </div>
            <Slider
              value={[draft.temperature]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                updateTemperature(arr[0]);
              }}
              min={0}
              max={2}
              step={0.1}
              aria-label="Temperature"
              getAriaValueText={(value) => `Temperature ${value.toFixed(1)}`}
            />
            <p id="temperature-desc" className="text-xs text-muted-foreground">
              Controls randomness: lower values are more deterministic.
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxTokens-input">Max Tokens</Label>
              <Input
                id="maxTokens-input"
                type="number"
                min={1}
                max={8192}
                step={1}
                value={draft.maxTokens}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) updateMaxTokens(val);
                }}
                className="w-24 text-right"
                aria-describedby="maxTokens-desc"
              />
            </div>
            <Slider
              value={[draft.maxTokens]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                updateMaxTokens(arr[0]);
              }}
              min={1}
              max={8192}
              step={1}
              aria-label="Max Tokens"
            />
            <p id="maxTokens-desc" className="text-xs text-muted-foreground">
              Maximum number of tokens to generate.
            </p>
          </div>

          {/* Timeout */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="timeout-input">Timeout</Label>
              <Input
                id="timeout-input"
                type="number"
                min={1000}
                max={300000}
                step={1000}
                value={draft.timeoutMs}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) updateTimeoutMs(val);
                }}
                className="w-24 text-right"
                aria-describedby="timeout-desc"
              />
            </div>
            <Slider
              value={[draft.timeoutMs]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                updateTimeoutMs(arr[0]);
              }}
              min={1000}
              max={300000}
              step={1000}
              aria-label="Timeout"
            />
            <p id="timeout-desc" className="text-xs text-muted-foreground">
              Request timeout in milliseconds.
            </p>
          </div>

          {/* Top P */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="topP-input">Top P</Label>
              <Input
                id="topP-input"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={draft.topP}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) updateTopP(val);
                }}
                className="w-24 text-right"
                aria-describedby="topP-desc"
              />
            </div>
            <Slider
              value={[draft.topP]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                updateTopP(arr[0]);
              }}
              min={0}
              max={1}
              step={0.01}
              aria-label="Top P"
            />
            <p id="topP-desc" className="text-xs text-muted-foreground">
              Nucleus sampling: consider tokens with top P probability mass.
            </p>
          </div>

          {/* JSON Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="json-mode">JSON Mode</Label>
              <p id="json-mode-desc" className="text-xs text-muted-foreground">
                Force model to output valid JSON.
              </p>
            </div>
            <Switch
              id="json-mode"
              checked={draft.jsonMode}
              onCheckedChange={updateJsonMode}
              aria-describedby="json-mode-desc"
            />
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" onClick={handleApply}>
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
