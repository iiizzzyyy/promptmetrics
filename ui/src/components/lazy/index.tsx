"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const modalLoadingFallback = (
  <div className="flex flex-col gap-2 p-6">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

const editorLoadingFallback = (
  <div className="flex flex-col gap-2 p-4">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
);

/**
 * Lazy-loaded Monaco Editor.
 * ~500KB chunk; must be client-only (ssr: false).
 */
export const LazyMonacoEditor = dynamic(
  () => import("@monaco-editor/react"),
  {
    ssr: false,
    loading: () => editorLoadingFallback,
  }
);

/**
 * Lazy-loaded ParameterSchemaBuilder.
 * Heavy recursive-rendering component; loads in a separate chunk.
 */
export const LazyParameterSchemaBuilder = dynamic(
  () => import("@/components/playground/ParameterSchemaBuilder").then((mod) => mod.ParameterSchemaBuilder),
  {
    ssr: false,
    loading: () => modalLoadingFallback,
  }
);

/**
 * Lazy-loaded A/B Test result modal with Recharts charts.
 */
export const LazyABTestResultModal = dynamic(
  () => import("@/components/ab-testing/ABTestResultModal").then((mod) => mod.ABTestResultModal),
  {
    ssr: false,
    loading: () => modalLoadingFallback,
  }
);

/**
 * Lazy-loaded A/B Test creation modal.
 */
export const LazyCreateABTestModal = dynamic(
  () => import("@/components/ab-testing/CreateABTestModal").then((mod) => mod.CreateABTestModal),
  {
    ssr: false,
    loading: () => modalLoadingFallback,
  }
);

export { LazyLoadBoundary } from "./LazyLoadBoundary";
