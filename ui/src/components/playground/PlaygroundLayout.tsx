"use client";

import React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  playgroundChatRequestSchema,
  type PlaygroundChatRequest,
} from "@/lib/schemas/playground";
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
import { SettingsSheet } from "@/app/playground/_components/SettingsSheet";
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
    setSystemMessage,
    setUserMessage,
    isRunning,
    setIsRunning,
    resetStream,
    currentVariables,
  } = usePlaygroundStore();

  const [configOpen, setConfigOpen] = React.useState(false);
  const [settingsKey, setSettingsKey] = React.useState(0);

  const {
    handleSubmit,
    setValue,
    control,
    formState: { errors, isValid },
  } = useForm<PlaygroundChatRequest>({
    resolver: zodResolver(playgroundChatRequestSchema),
    mode: "onChange",
    defaultValues: {
      provider: selectedProvider,
      model: selectedModel,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      variables: currentVariables,
      temperature: 0.7,
      maxTokens: 1024,
      topP: 1.0,
      jsonMode: false,
      timeoutMs: 30000,
    },
  });

  // Sync zustand changes back into RHF
  React.useEffect(() => {
    setValue("provider", selectedProvider, { shouldValidate: true });
  }, [selectedProvider, setValue]);

  React.useEffect(() => {
    setValue("model", selectedModel, { shouldValidate: true });
  }, [selectedModel, setValue]);

  React.useEffect(() => {
    setValue(
      "messages",
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      { shouldValidate: true }
    );
  }, [systemMessage, userMessage, setValue]);

  React.useEffect(() => {
    setValue("variables", currentVariables, { shouldValidate: true });
  }, [currentVariables, setValue]);

  const messagesError =
    (errors.messages as { message?: string; root?: { message?: string } } | undefined)
      ?.message ||
    (errors.messages as { message?: string; root?: { message?: string } } | undefined)
      ?.root?.message;

  const centerPaneSize = Math.max(100 - leftPaneSize - rightPaneSize, 20);

  const onSubmit = () => {
    setIsRunning(true);
    resetStream();
  };

  const provider = useWatch({ control, name: "provider" });
  const model = useWatch({ control, name: "model" });
  const temperature = useWatch({ control, name: "temperature" }) ?? 0.7;
  const maxTokens = useWatch({ control, name: "maxTokens" }) ?? 1024;
  const topP = useWatch({ control, name: "topP" }) ?? 1.0;
  const jsonMode = useWatch({ control, name: "jsonMode" }) ?? false;
  const timeoutMs = useWatch({ control, name: "timeoutMs" }) ?? 30000;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-background">
      <form onSubmit={handleSubmit(onSubmit)} className="contents">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-2 h-14 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Playground</span>
          </div>

          <div className="flex items-center gap-3">
            <ModelSelector
              provider={provider}
              model={model}
              onSelect={(p, m) => {
                setValue("provider", p, { shouldValidate: true });
                setValue("model", m, { shouldValidate: true });
                usePlaygroundStore.getState().setSelectedModel(p, m);
              }}
            />

            <Button
              variant="default"
              size="sm"
              loading={isRunning}
              type="submit"
              disabled={!isValid || isRunning}
              className="gap-1.5"
            >
              <Play className="h-4 w-4" />
              Run
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              aria-label="Settings"
              type="button"
              onClick={() => {
                setSettingsKey((k) => k + 1);
                setConfigOpen(true);
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {messagesError && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive">
            {messagesError}
          </div>
        )}

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
                  <EditorTab
                    messages={useWatch({ control, name: "messages" }) ?? [
                      { role: "system", content: systemMessage },
                      { role: "user", content: userMessage },
                    ]}
                    onMessagesChange={(msgs) => {
                      setValue("messages", msgs, { shouldValidate: true });
                      const sys = msgs.find((m) => m.role === "system")?.content || "";
                      const user = msgs.find((m) => m.role === "user")?.content || "";
                      setSystemMessage(sys);
                      setUserMessage(user);
                    }}
                    messagesError={messagesError}
                  />
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
              <StreamingOutputPanel
                settings={{
                  temperature,
                  maxTokens,
                  topP,
                  jsonMode,
                  timeoutMs,
                }}
              />
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
                      <span className="text-foreground">{provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span className="text-foreground">{model}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        <SettingsSheet
          key={settingsKey}
          open={configOpen}
          onOpenChange={setConfigOpen}
          settings={{
            temperature,
            maxTokens,
            topP,
            jsonMode,
            timeoutMs,
          }}
          onSettingsChange={(s) => {
            setValue("temperature", s.temperature, { shouldValidate: true });
            setValue("maxTokens", s.maxTokens, { shouldValidate: true });
            setValue("topP", s.topP, { shouldValidate: true });
            setValue("jsonMode", s.jsonMode, { shouldValidate: true });
            setValue("timeoutMs", s.timeoutMs, { shouldValidate: true });
          }}
        />
      </form>
    </div>
  );
}
