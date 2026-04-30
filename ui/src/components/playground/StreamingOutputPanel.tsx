"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePlaygroundStore } from "@/stores/playground.store";
import { createSSEStream } from "@/lib/streaming";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Copy, Trash2, Square, AlertCircle, Check } from "lucide-react";

interface StreamingOutputPanelProps {
  url?: string;
}

export function StreamingOutputPanel({
  url = "/v1/playground/chat/stream",
}: StreamingOutputPanelProps) {
  const {
    isRunning,
    streamTokens,
    streamError,
    runMetrics,
    appendStreamToken,
    setStreamError,
    setRunMetrics,
    setIsRunning,
    resetStream,
  } = usePlaygroundStore();

  const streamOutput = streamTokens.join("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  // Blinking cursor animation while streaming
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(id);
  }, [isRunning]);

  // Auto-scroll to bottom as output grows
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamOutput]);

  // Track mounted state to avoid state updates after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle stream lifecycle
  useEffect(() => {
    if (!isRunning) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function runStream() {
      const state = usePlaygroundStore.getState();

      try {
        const stream = createSSEStream(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: state.selectedProvider,
            model: state.selectedModel,
            system: state.systemMessage,
            user: state.userMessage,
            variables: state.currentVariables,
            temperature: state.temperature,
            max_tokens: state.maxTokens,
            top_p: state.topP,
          }),
          signal: controller.signal,
        });

        for await (const chunk of stream) {
          switch (chunk.type) {
            case "token":
              appendStreamToken(chunk.content);
              break;
            case "tool_call":
              appendStreamToken(`\n[Tool call: ${chunk.name}]\n`);
              break;
            case "metrics":
              setRunMetrics({
                tokensIn: chunk.tokensIn,
                tokensOut: chunk.tokensOut,
                latencyMs: chunk.latencyMs,
                costUsd: chunk.costUsd,
              });
              break;
            case "error":
              if (mountedRef.current) {
                setStreamError(chunk.message);
              }
              break;
            case "done":
              break;
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && mountedRef.current) {
          setStreamError((err as Error).message);
        }
      } finally {
        if (mountedRef.current) {
          setIsRunning(false);
        }
        abortControllerRef.current = null;
      }
    }

    runStream();

    return () => {
      controller.abort();
    };
  }, [isRunning, url, appendStreamToken, setStreamError, setRunMetrics, setIsRunning]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  };

  const handleCopy = async () => {
    if (!streamOutput) return;
    try {
      await navigator.clipboard.writeText(streamOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed — ignore
    }
  };

  const handleClear = () => {
    resetStream();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-foreground">Output</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!streamOutput}
            className="px-2"
            aria-label="Copy output"
            title="Copy output"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!streamOutput && !streamError}
            className="px-2"
            aria-label="Clear output"
            title="Clear output"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {isRunning && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              className="px-2 gap-1"
              aria-label="Cancel stream"
              title="Cancel stream"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap text-foreground"
      >
        {streamOutput}
        {isRunning && (
          <span
            className="inline-block w-2 h-4 bg-primary ml-0.5 align-middle"
            style={{
              opacity: cursorVisible ? 1 : 0,
              transition: "opacity 0.05s",
            }}
          />
        )}
        {!isRunning && !streamOutput && (
          <span className="text-muted-foreground">
            Click Run to generate output...
          </span>
        )}
      </div>

      {/* Error state */}
      {streamError && (
        <div className="border-t px-4 py-3 bg-destructive/10">
          <div className="flex items-start gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="break-words">{streamError}</span>
          </div>
        </div>
      )}

      {/* Metrics panel */}
      {runMetrics && !isRunning && (
        <div className="border-t px-4 py-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                Tokens In: {runMetrics.tokensIn}
              </Badge>
              <Badge variant="secondary">
                Tokens Out: {runMetrics.tokensOut}
              </Badge>
              <Badge variant="secondary">
                Latency: {runMetrics.latencyMs}ms
              </Badge>
              <Badge variant="secondary">
                Cost: ${runMetrics.costUsd.toFixed(6)}
              </Badge>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
