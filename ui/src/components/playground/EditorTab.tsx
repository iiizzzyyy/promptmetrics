"use client";

import React, { Suspense, useCallback, useRef } from "react";
import { usePlaygroundStore } from "@/stores/playground.store";
import { LazyMonacoEditor } from "@/components/lazy";
import { Skeleton } from "@/components/ui/skeleton";
import type { editor } from "monaco-editor";

interface EditorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function MonacoField({ label, value, onChange, placeholder }: EditorFieldProps) {
  const decorationsRef = useRef<string[]>([]);

  const handleMount = useCallback(
    (
      ed: editor.IStandaloneCodeEditor,
      monaco: typeof import("monaco-editor")
    ) => {
      const updateDecorations = () => {
        const model = ed.getModel();
        if (!model) return;

        const text = model.getValue();
        const newDecorations: editor.IModelDeltaDecoration[] = [];
        const regex = /\{\{[^{}]*\}\}/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const startPos = model.getPositionAt(match.index);
          const endPos = model.getPositionAt(match.index + match[0].length);
          newDecorations.push({
            range: new monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            ),
            options: {
              inlineClassName: "mustache-variable-highlight",
              overviewRuler: {
                color: "#5cc15c",
                position: monaco.editor.OverviewRulerLane.Center,
              },
            },
          });
        }

        decorationsRef.current = ed.deltaDecorations(
          decorationsRef.current,
          newDecorations
        );
      };

      updateDecorations();
      ed.onDidChangeModelContent(updateDecorations);
    },
    []
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border overflow-hidden">
      <div className="px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <LazyMonacoEditor
            height="100%"
            defaultLanguage="markdown"
            value={value}
            onChange={(val) => onChange(val || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              lineNumbers: "off",
              folding: false,
              renderLineHighlight: "none",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              placeholder,
            }}
            onMount={handleMount}
          />
        </Suspense>
      </div>
    </div>
  );
}

export function EditorTab() {
  const {
    systemMessage,
    userMessage,
    setSystemMessage,
    setUserMessage,
  } = usePlaygroundStore();

  return (
    <div className="flex h-full flex-col gap-2">
      <MonacoField
        label="System Message"
        value={systemMessage}
        onChange={setSystemMessage}
        placeholder="Enter system prompt..."
      />
      <MonacoField
        label="User Message"
        value={userMessage}
        onChange={setUserMessage}
        placeholder="Enter user message..."
      />
    </div>
  );
}
