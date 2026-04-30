"use client";

import React from "react";
import { usePlaygroundStore } from "@/stores/playground.store";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EditorTab } from "./EditorTab";
import { StreamingOutputPanel } from "./StreamingOutputPanel";
import { ModelSelector } from "./ModelSelector";
import { ModelConfigDrawer } from "./ModelConfigDrawer";
import {
  Play,
  Settings,
  Code,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";

export function PlaygroundLayout() {
  const {
    leftPaneSize,
    rightPaneSize,
    activeTab,
    setActiveTab,
    selectedProvider,
    selectedModel,
    systemMessage,
    userMessage,
    isRunning,
    setIsRunning,
    resetStream,
  } = usePlaygroundStore();

  const [configOpen, setConfigOpen] = React.useState(false);

  const centerPaneSize = Math.max(100 - leftPaneSize - rightPaneSize, 20);

  const handleRun = () => {
    setIsRunning(true);
    resetStream();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Playground</span>
        </div>

        <div className="flex items-center gap-3">
          <ModelSelector />

          <Button
            variant="default"
            size="sm"
            loading={isRunning}
            onClick={handleRun}
            disabled={!selectedModel || (!systemMessage.trim() && !userMessage.trim())}
            className="gap-1.5"
          >
            <Play className="h-4 w-4" />
            Run
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label="Config"
            onClick={() => setConfigOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Resizable Panes */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left Pane */}
        <ResizablePanel defaultSize={leftPaneSize} minSize={15}>
          <div className="flex h-full flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "editor" | "variables" | "config")
              }
              className="flex h-full flex-col"
            >
              <TabsList className="mx-2 mt-2">
                <TabsTrigger value="editor">
                  <Code className="mr-1.5 h-3.5 w-3.5" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="variables">
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  Variables
                </TabsTrigger>
                <TabsTrigger value="config">
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Config
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="editor"
                className="flex-1 overflow-hidden px-2 pb-2"
              >
                <EditorTab />
              </TabsContent>

              <TabsContent
                value="variables"
                className="flex-1 overflow-auto px-2 pb-2"
              >
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    Variable sets and current variables will appear here.
                  </p>
                </div>
              </TabsContent>

              <TabsContent
                value="config"
                className="flex-1 overflow-auto px-2 pb-2"
              >
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Temperature
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Model creativity parameter
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Max Tokens
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Maximum output length
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Top P
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Nucleus sampling parameter
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Center Pane */}
        <ResizablePanel defaultSize={centerPaneSize} minSize={20}>
          <div className="flex h-full flex-col">
            <StreamingOutputPanel />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Pane */}
        <ResizablePanel defaultSize={rightPaneSize} minSize={15}>
          <div className="flex h-full flex-col">
            <div className="border-b px-4 py-2 shrink-0">
              <span className="text-sm font-medium text-foreground">
                Variables & Config
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Current Variables
                </h4>
                <p className="text-xs text-muted-foreground">
                  No variables configured
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Model Config
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="text-foreground">{selectedProvider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="text-foreground">{selectedModel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ModelConfigDrawer open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
}
