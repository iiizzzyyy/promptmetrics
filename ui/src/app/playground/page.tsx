"use client";

import { PlaygroundLayout } from "@/components/playground/PlaygroundLayout";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export default function PlaygroundPage() {
  return (
    <ErrorBoundary>
      <PlaygroundLayout />
    </ErrorBoundary>
  );
}
