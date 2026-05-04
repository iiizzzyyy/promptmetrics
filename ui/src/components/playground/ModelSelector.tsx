"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, LLMModel } from "@/lib/api";
import { usePlaygroundStore } from "@/stores/playground.store";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Bot,
  Link,
  Server,
  Cloud,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const providerIcons: Record<string, React.ReactNode> = {
  openai: <Sparkles className="h-4 w-4 text-yellow-400" />,
  anthropic: <Bot className="h-4 w-4 text-orange-400" />,
  cohere: <Link className="h-4 w-4 text-blue-400" />,
  ollama: <Server className="h-4 w-4 text-green-400" />,
  azure_openai: <Cloud className="h-4 w-4 text-sky-400" />,
};

const providerOrder = ["openai", "anthropic", "cohere", "ollama", "azure_openai"];

function getProviderIcon(provider: string) {
  return (
    providerIcons[provider] || <Sparkles className="h-4 w-4 text-gray-400" />
  );
}

function groupByProvider(models: LLMModel[]) {
  const grouped = new Map<string, LLMModel[]>();
  for (const model of models) {
    const list = grouped.get(model.provider) || [];
    list.push(model);
    grouped.set(model.provider, list);
  }
  const sortedProviders = Array.from(grouped.keys()).sort((a, b) => {
    const ia = providerOrder.indexOf(a);
    const ib = providerOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return sortedProviders.map((provider) => ({
    provider,
    models: grouped.get(provider)!,
  }));
}

interface ModelSelectorProps {
  provider?: string;
  model?: string;
  onSelect?: (provider: string, model: string) => void;
}

export function ModelSelector({
  provider: propProvider,
  model: propModel,
  onSelect: propOnSelect,
}: ModelSelectorProps = {}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const storeProvider = usePlaygroundStore((s) => s.selectedProvider);
  const storeModel = usePlaygroundStore((s) => s.selectedModel);
  const storeSetSelectedModel = usePlaygroundStore((s) => s.setSelectedModel);

  const selectedProvider = propProvider ?? storeProvider;
  const selectedModel = propModel ?? storeModel;

  const { data, isLoading } = useQuery({
    queryKey: ["playground-models"],
    queryFn: () => api.getPlaygroundModels(),
  });

  const models = data?.items ?? [];

  const filteredModels = React.useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q)
    );
  }, [models, search]);

  const grouped = React.useMemo(
    () => groupByProvider(filteredModels),
    [filteredModels]
  );

  const flatItems = React.useMemo(() => {
    const items: Array<{ provider: string; model: LLMModel }> = [];
    for (const group of grouped) {
      for (const model of group.models) {
        items.push({ provider: group.provider, model });
      }
    }
    return items;
  }, [grouped]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setHighlightedId(null);
      } else {
        const selectedItem = flatItems.find(
          (item) =>
            item.provider === selectedProvider &&
            item.model.slug === selectedModel
        );
        setHighlightedId(
          selectedItem?.model.id ?? flatItems[0]?.model.id ?? null
        );
      }
      setOpen(nextOpen);
    },
    [flatItems, selectedProvider, selectedModel]
  );

  const handleClose = React.useCallback(() => {
    handleOpenChange(false);
    setSearch("");
    // Return focus to trigger after close
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, [handleOpenChange]);

  const handleSelect = React.useCallback(
    (provider: string, modelSlug: string) => {
      if (propOnSelect) {
        propOnSelect(provider, modelSlug);
      } else {
        storeSetSelectedModel(provider, modelSlug);
      }
      handleClose();
    },
    [propOnSelect, storeSetSelectedModel, handleClose]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const currentIdx = flatItems.findIndex(
            (item) => item.model.id === highlightedId
          );
          const nextIdx = Math.min(currentIdx + 1, flatItems.length - 1);
          const nextItem = flatItems[nextIdx];
          if (nextItem) setHighlightedId(nextItem.model.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const currentIdx = flatItems.findIndex(
            (item) => item.model.id === highlightedId
          );
          const prevIdx = Math.max(currentIdx - 1, 0);
          const prevItem = flatItems[prevIdx];
          if (prevItem) setHighlightedId(prevItem.model.id);
          break;
        }
        case "Enter": {
          e.preventDefault();
          const item = flatItems.find(
            (item) => item.model.id === highlightedId
          );
          if (item) handleSelect(item.provider, item.model.slug);
          break;
        }
        case "Escape": {
          e.preventDefault();
          handleClose();
          break;
        }
      }
    },
    [open, flatItems, highlightedId, handleSelect, handleClose]
  );

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!open || !highlightedId) return;
    const el = document.querySelector(`[data-model-id="${highlightedId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedId, open]);

  const displayText = selectedModel
    ? `${selectedProvider} / ${selectedModel}`
    : "Select model...";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-11 items-center justify-between rounded-[10px] border border-white/10 bg-[#111] px-3 py-2 text-sm min-h-[44px]",
          "text-[#ededed] hover:bg-[#171717] focus:outline-none focus:ring-2 focus:ring-[#389438] focus:ring-offset-2",
          "cursor-pointer min-w-[240px]"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select model"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedProvider && getProviderIcon(selectedProvider)}
          <span className="truncate">{displayText}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-50 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 overflow-hidden"
        onKeyDown={handleKeyDown}
        role="listbox"
        aria-label="Available models"
      >
        <div className="p-2 border-b border-white/10">
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            autoFocus={open}
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : flatItems.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {search
                ? "No models match your search"
                : "No models available"}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.provider} className="py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  {getProviderIcon(group.provider)}
                  {group.provider}
                </div>
                {group.models.map((model) => {
                  const isHighlighted = model.id === highlightedId;
                  const isSelected =
                    model.provider === selectedProvider &&
                    model.slug === selectedModel;

                  return (
                    <div
                      key={model.id}
                      role="option"
                      aria-selected={isSelected}
                      data-model-id={model.id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm cursor-pointer min-h-[40px]",
                        isHighlighted && "bg-[#171717]",
                        isSelected && "text-[#389438]"
                      )}
                      onClick={() =>
                        handleSelect(model.provider, model.slug)
                      }
                      onMouseEnter={() => setHighlightedId(model.id)}
                    >
                      <span className="truncate">{model.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
