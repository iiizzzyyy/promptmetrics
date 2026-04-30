"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Variable,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  usePlaygroundStore,
  VariableSet,
} from "@/stores/playground.store";

function generateId(): string {
  return `vs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface KeyValueRow {
  key: string;
  value: string;
}

function variablesToRows(variables: Record<string, string>): KeyValueRow[] {
  const entries = Object.entries(variables);
  if (entries.length === 0) return [{ key: "", value: "" }];
  return entries.map(([key, value]) => ({ key, value }));
}

function rowsToVariables(rows: KeyValueRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.trim()) {
      result[row.key.trim()] = row.value;
    }
  }
  return result;
}

interface VariableSetFormProps {
  initialName?: string;
  initialRows?: KeyValueRow[];
  onSave: (name: string, variables: Record<string, string>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

function VariableSetForm({
  initialName = "",
  initialRows = [{ key: "", value: "" }],
  onSave,
  onCancel,
  submitLabel = "Save",
}: VariableSetFormProps) {
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<KeyValueRow[]>(initialRows);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  const handleRemoveRow = useCallback((index: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ key: "", value: "" }];
    });
  }, []);

  const handleRowChange = useCallback(
    (index: number, field: "key" | "value", value: string) => {
      setRows((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      );
    },
    []
  );

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(trimmedName, rowsToVariables(rows));
  }, [name, rows, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <div
      className="space-y-3 rounded-lg border border-[#E0EBE3]/20 bg-[#111] p-4"
      onKeyDown={handleKeyDown}
      role="form"
      aria-label="Variable set form"
    >
      <div>
        <Label htmlFor="variable-set-name">Name</Label>
        <Input
          id="variable-set-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Production defaults"
          className="mt-1"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Variables</Label>
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={row.key}
              onChange={(e) => handleRowChange(index, "key", e.target.value)}
              placeholder="Key"
              className="flex-1"
              aria-label={`Variable key ${index + 1}`}
            />
            <span className="text-muted-foreground">=</span>
            <Input
              value={row.value}
              onChange={(e) =>
                handleRowChange(index, "value", e.target.value)
              }
              placeholder="Value"
              className="flex-1"
              aria-label={`Variable value ${index + 1}`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveRow(index)}
              aria-label={`Remove variable row ${index + 1}`}
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          type="button"
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add variable
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim()}
          type="button"
        >
          <Check className="mr-1 h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function VariableSetsPanel() {
  const variableSets = usePlaygroundStore((s) => s.variableSets);
  const activeVariableSetId = usePlaygroundStore(
    (s) => s.activeVariableSetId
  );
  const addVariableSet = usePlaygroundStore((s) => s.addVariableSet);
  const updateVariableSet = usePlaygroundStore((s) => s.updateVariableSet);
  const deleteVariableSet = usePlaygroundStore((s) => s.deleteVariableSet);
  const setActiveVariableSet = usePlaygroundStore(
    (s) => s.setActiveVariableSet
  );

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = useCallback(
    (name: string, variables: Record<string, string>) => {
      const newSet: VariableSet = {
        id: generateId(),
        name,
        variables,
      };
      addVariableSet(newSet);
      setActiveVariableSet(newSet.id);
      setMode("list");
    },
    [addVariableSet, setActiveVariableSet]
  );

  const handleUpdate = useCallback(
    (name: string, variables: Record<string, string>) => {
      if (!editingId) return;
      updateVariableSet(editingId, { name, variables });
      setMode("list");
      setEditingId(null);
    },
    [editingId, updateVariableSet]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteVariableSet(id);
    },
    [deleteVariableSet]
  );

  const handleStartEdit = useCallback((set: VariableSet) => {
    setEditingId(set.id);
    setMode("edit");
  }, []);

  const handleCancel = useCallback(() => {
    setMode("list");
    setEditingId(null);
  }, []);

  const editingSet = variableSets.find((s) => s.id === editingId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#ededed]">
          Variable Sets
        </h3>
        {mode === "list" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("create")}
            aria-label="Create new variable set"
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        )}
      </div>

      {mode === "create" && (
        <VariableSetForm
          onSave={handleCreate}
          onCancel={handleCancel}
          submitLabel="Create"
        />
      )}

      {mode === "edit" && editingSet && (
        <VariableSetForm
          initialName={editingSet.name}
          initialRows={variablesToRows(editingSet.variables)}
          onSave={handleUpdate}
          onCancel={handleCancel}
          submitLabel="Update"
        />
      )}

      <div className="space-y-2" role="list" aria-label="Variable sets">
        {variableSets.length === 0 && mode === "list" && (
          <p className="text-sm text-muted-foreground">
            No variable sets yet. Click New to create one.
          </p>
        )}

        {variableSets.map((set) => {
          const isActive = set.id === activeVariableSetId;
          const variableCount = Object.keys(set.variables).length;

          return (
            <Card
              key={set.id}
              role="listitem"
              className={[
                "cursor-pointer transition-colors",
                isActive
                  ? "border-[#389438] bg-[#389438]/10"
                  : "border-[#E0EBE3]/20 bg-[#111] hover:bg-[#1a1a1a]",
              ].join(" ")}
              onClick={() => setActiveVariableSet(set.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveVariableSet(set.id);
                }
              }}
              aria-pressed={isActive}
            >
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Variable className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium text-[#ededed]">
                    {set.name}
                  </span>
                  <Badge variant="secondary">{variableCount}</Badge>
                </div>
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="group"
                  aria-label={`Actions for ${set.name}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(set)}
                    aria-label={`Edit ${set.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(set.id)}
                    aria-label={`Delete ${set.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default VariableSetsPanel;
