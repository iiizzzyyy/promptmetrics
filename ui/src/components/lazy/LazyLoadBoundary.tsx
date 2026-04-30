"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingFallbackProps {
  timeoutMs?: number;
  onTimeout?: () => void;
}

function LoadingFallback({ timeoutMs, onTimeout }: LoadingFallbackProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!timeoutMs || timeoutMs <= 0) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs, onTimeout]);

  if (timedOut) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <Skeleton className="h-4 w-48" />
        <p className="text-sm text-destructive">
          This component took longer than expected to load.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

export interface LazyLoadBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  timeoutMs?: number;
  onTimeout?: () => void;
}

/**
 * A Suspense boundary that renders Skeleton placeholders while lazy-loaded
 * chunks are being fetched. Optionally shows an error state if loading exceeds
 * the provided timeout.
 */
export function LazyLoadBoundary({
  children,
  fallback,
  timeoutMs,
  onTimeout,
}: LazyLoadBoundaryProps) {
  return (
    <Suspense
      fallback={
        fallback ?? <LoadingFallback timeoutMs={timeoutMs} onTimeout={onTimeout} />
      }
    >
      {children}
    </Suspense>
  );
}
