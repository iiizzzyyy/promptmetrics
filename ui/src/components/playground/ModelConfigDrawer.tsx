"use client";

import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePlaygroundStore } from "@/stores/playground.store";

interface ModelConfigDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TOP_P = 1.0;

export function ModelConfigDrawer({
  open,
  onOpenChange,
}: ModelConfigDrawerProps) {
  const temperature = usePlaygroundStore((state) => state.temperature);
  const maxTokens = usePlaygroundStore((state) => state.maxTokens);
  const topP = usePlaygroundStore((state) => state.topP);
  const setTemperature = usePlaygroundStore((state) => state.setTemperature);
  const setMaxTokens = usePlaygroundStore((state) => state.setMaxTokens);
  const setTopP = usePlaygroundStore((state) => state.setTopP);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleReset = () => {
    setTemperature(DEFAULT_TEMPERATURE);
    setMaxTokens(DEFAULT_MAX_TOKENS);
    setTopP(DEFAULT_TOP_P);
  };

  const clampAndSetTemperature = (val: number) => {
    const clamped = Math.min(2, Math.max(0, val));
    setTemperature(Number(clamped.toFixed(1)));
  };

  const clampAndSetMaxTokens = (val: number) => {
    const clamped = Math.min(8192, Math.max(1, Math.round(val)));
    setMaxTokens(clamped);
  };

  const clampAndSetTopP = (val: number) => {
    const clamped = Math.min(1, Math.max(0, val));
    setTopP(Number(clamped.toFixed(2)));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Model Configuration</DrawerTitle>
          <DrawerDescription>
            Adjust inference parameters for the selected model.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-8 overflow-y-auto py-4">
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
                value={temperature}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) clampAndSetTemperature(val);
                }}
                className="w-24 text-right"
                aria-describedby="temperature-desc"
              />
            </div>
            <Slider
              value={[temperature]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                clampAndSetTemperature(arr[0]);
              }}
              min={0}
              max={2}
              step={0.1}
              aria-label="Temperature"
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
                value={maxTokens}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) clampAndSetMaxTokens(val);
                }}
                className="w-24 text-right"
                aria-describedby="maxTokens-desc"
              />
            </div>
            <Slider
              value={[maxTokens]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                clampAndSetMaxTokens(arr[0]);
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
                value={topP}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) clampAndSetTopP(val);
                }}
                className="w-24 text-right"
                aria-describedby="topP-desc"
              />
            </div>
            <Slider
              value={[topP]}
              onValueChange={(v) => {
                const arr = Array.isArray(v) ? v : [v];
                clampAndSetTopP(arr[0]);
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
        </div>

        <div className="pt-6 border-t mt-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleReset}
          >
            Reset to defaults
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
