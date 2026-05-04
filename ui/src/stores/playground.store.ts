import { create } from "zustand";

export interface VariableSet {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface PlaygroundState {
  // Layout
  leftPaneSize: number;
  rightPaneSize: number;
  activeTab: "editor" | "variables" | "config";

  // Model selection
  selectedProvider: string;
  selectedModel: string;

  // Prompt content
  systemMessage: string;
  userMessage: string;

  // Variables
  variableSets: VariableSet[];
  activeVariableSetId: string | null;
  currentVariables: Record<string, string>;

  // Execution
  isRunning: boolean;
  streamTokens: string[];
  streamError: string | null;
  runMetrics: {
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    costUsd: number;
  } | null;

  // Validation
  validationError: string | null;

  // Model config
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface PlaygroundActions {
  setPaneSizes: (left: number, right: number) => void;
  setActiveTab: (tab: PlaygroundState["activeTab"]) => void;
  setSelectedModel: (provider: string, model: string) => void;
  setSystemMessage: (text: string) => void;
  setUserMessage: (text: string) => void;
  addVariableSet: (set: VariableSet) => void;
  updateVariableSet: (id: string, set: Partial<VariableSet>) => void;
  deleteVariableSet: (id: string) => void;
  setActiveVariableSet: (id: string | null) => void;
  setCurrentVariable: (key: string, value: string) => void;
  setIsRunning: (running: boolean) => void;
  appendStreamToken: (token: string) => void;
  setStreamError: (error: string | null) => void;
  setRunMetrics: (metrics: PlaygroundState["runMetrics"]) => void;
  resetStream: () => void;
  validateBeforeRun: () => boolean;
  setTemperature: (val: number) => void;
  setMaxTokens: (val: number) => void;
  setTopP: (val: number) => void;
}

export const usePlaygroundStore = create<PlaygroundState & PlaygroundActions>(
  (set) => ({
    // Initial state
    leftPaneSize: 50,
    rightPaneSize: 50,
    activeTab: "editor",
    selectedProvider: "openai",
    selectedModel: "gpt-4o",
    systemMessage: "",
    userMessage: "",
    variableSets: [],
    activeVariableSetId: null,
    currentVariables: {},
    isRunning: false,
    streamTokens: [],
    streamError: null,
    runMetrics: null,
    validationError: null,
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,

    // Actions
    setPaneSizes: (left, right) => set({ leftPaneSize: left, rightPaneSize: right }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedModel: (provider, model) =>
      set({ selectedProvider: provider, selectedModel: model }),
    setSystemMessage: (text) => set({ systemMessage: text }),
    setUserMessage: (text) => set({ userMessage: text }),
    addVariableSet: (variableSet) =>
      set((state) => ({
        variableSets: [...state.variableSets, variableSet],
      })),
    updateVariableSet: (id, updates) =>
      set((state) => ({
        variableSets: state.variableSets.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })),
    deleteVariableSet: (id) =>
      set((state) => ({
        variableSets: state.variableSets.filter((s) => s.id !== id),
        activeVariableSetId:
          state.activeVariableSetId === id ? null : state.activeVariableSetId,
      })),
    setActiveVariableSet: (id) => {
      set((state) => {
        const set = state.variableSets.find((s) => s.id === id);
        return {
          activeVariableSetId: id,
          currentVariables: set ? { ...set.variables } : {},
        };
      });
    },
    setCurrentVariable: (key, value) =>
      set((state) => ({
        currentVariables: { ...state.currentVariables, [key]: value },
      })),
    setIsRunning: (running) => set({ isRunning: running }),
    appendStreamToken: (token) =>
      set((state) => ({ streamTokens: [...state.streamTokens, token] })),
    setStreamError: (error) => set({ streamError: error }),
    setRunMetrics: (metrics) => set({ runMetrics: metrics }),
    resetStream: () =>
      set({ streamTokens: [], streamError: null, runMetrics: null }),
    validateBeforeRun: () => {
      let error: string | null = null;

      set((state) => {
        if (!state.selectedModel) {
          error = "Please select a model before running.";
        } else if (!state.systemMessage.trim() && !state.userMessage.trim()) {
          error = "Please provide at least a system message or a user message.";
        }
        return { validationError: error };
      });

      return error === null;
    },
    setTemperature: (val) => set({ temperature: val }),
    setMaxTokens: (val) => set({ maxTokens: val }),
    setTopP: (val) => set({ topP: val }),
  })
);

// Selector hooks to prevent excessive re-renders
export const usePlaygroundLayout = () =>
  usePlaygroundStore((state) => ({
    leftPaneSize: state.leftPaneSize,
    rightPaneSize: state.rightPaneSize,
    activeTab: state.activeTab,
    setActiveTab: state.setActiveTab,
    setPaneSizes: state.setPaneSizes,
  }));

export const usePlaygroundModel = () =>
  usePlaygroundStore((state) => ({
    selectedProvider: state.selectedProvider,
    selectedModel: state.selectedModel,
    setSelectedModel: state.setSelectedModel,
  }));

export const usePlaygroundMessages = () =>
  usePlaygroundStore((state) => ({
    systemMessage: state.systemMessage,
    userMessage: state.userMessage,
    setSystemMessage: state.setSystemMessage,
    setUserMessage: state.setUserMessage,
  }));

export const usePlaygroundVariables = () =>
  usePlaygroundStore((state) => ({
    variableSets: state.variableSets,
    activeVariableSetId: state.activeVariableSetId,
    currentVariables: state.currentVariables,
    addVariableSet: state.addVariableSet,
    updateVariableSet: state.updateVariableSet,
    deleteVariableSet: state.deleteVariableSet,
    setActiveVariableSet: state.setActiveVariableSet,
    setCurrentVariable: state.setCurrentVariable,
  }));

export const usePlaygroundExecution = () =>
  usePlaygroundStore((state) => ({
    isRunning: state.isRunning,
    streamTokens: state.streamTokens,
    streamError: state.streamError,
    runMetrics: state.runMetrics,
    setIsRunning: state.setIsRunning,
    appendStreamToken: state.appendStreamToken,
    setStreamError: state.setStreamError,
    setRunMetrics: state.setRunMetrics,
    resetStream: state.resetStream,
  }));
