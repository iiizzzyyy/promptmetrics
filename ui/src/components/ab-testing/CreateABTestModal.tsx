"use client";

import React from "react";

export interface CreateABTestModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (data: Record<string, unknown>) => void;
}

/**
 * Stub for CreateABTestModal.
 * Full implementation with react-hook-form + Zod will be ported in FE-3.2.
 */
export function CreateABTestModal({ open, onOpenChange, onSubmit }: CreateABTestModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-background p-6 shadow-lg">
        <p className="font-medium text-foreground">CreateABTestModal</p>
        <p className="mt-1 text-sm text-muted-foreground">A/B test creation form placeholder</p>
        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md border px-4 py-2"
            onClick={() => onOpenChange?.(false)}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => {
              onSubmit?.({});
              onOpenChange?.(false);
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
