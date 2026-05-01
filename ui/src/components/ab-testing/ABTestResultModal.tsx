"use client";

import React from "react";

export interface ABTestResultModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  testId?: string;
}

/**
 * Stub for ABTestResultModal.
 * Full implementation with Recharts will be ported in FE-3.3.
 */
export function ABTestResultModal({ open, onOpenChange, testId }: ABTestResultModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-background p-6 shadow-lg">
        <p className="font-medium text-foreground">ABTestResultModal</p>
        <p className="mt-1 text-sm text-muted-foreground">Test ID: {testId}</p>
        <button
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => onOpenChange?.(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}
