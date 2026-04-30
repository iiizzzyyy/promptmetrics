"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export interface NestedObjectEditorProps {
  value?: Record<string, unknown>;
  onChange?: (obj: Record<string, unknown>) => void;
}

type ValueType = "string" | "number" | "boolean" | "object" | "null";

function inferType(v: unknown): ValueType {
  if (v === null) return "null";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "object" && !Array.isArray(v)) return "object";
  return "string";
}

function valueToString(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function parseValue(type: ValueType, raw: string): unknown {
  switch (type) {
    case "boolean":
      return raw === "true";
    case "number":
      return Number.isNaN(Number(raw)) ? 0 : Number(raw);
    case "null":
      return null;
    case "object":
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    default:
      return raw;
  }
}

interface RowProps {
  name: string;
  value: unknown;
  depth?: number;
  onUpdate: (name: string, newValue: unknown) => void;
  onRename: (oldName: string, newName: string) => void;
  onRemove: (name: string) => void;
}

function Row({ name, value, depth = 0, onUpdate, onRename, onRemove }: RowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const type = inferType(value);
  const isObject = type === "object";
  const indent = depth * 16;

  const handleBlur = () => {
    if (editName && editName !== name) {
      onRename(name, editName);
    }
    setIsEditing(false);
  };

  const handleValueChange = (raw: string) => {
    onUpdate(name, parseValue(type, raw));
  };

  const handleTypeChange = (newType: ValueType) => {
    if (newType === type) return;
    if (newType === "boolean") {
      onUpdate(name, false);
    } else if (newType === "number") {
      onUpdate(name, 0);
    } else if (newType === "null") {
      onUpdate(name, null);
    } else if (newType === "object") {
      onUpdate(name, {});
    } else {
      onUpdate(name, "");
    }
  };

  const objValue = isObject ? (value as Record<string, unknown>) : {};

  return (
    <div style={{ paddingLeft: `${indent}px` }}>
      <div className="flex items-center gap-2 py-1">
        <div className="w-32 min-w-0">
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBlur();
                if (e.key === "Escape") {
                  setEditName(name);
                  setIsEditing(false);
                }
              }}
              autoFocus
              className="h-8"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium truncate hover:underline text-left w-full"
              title={name}
            >
              {name}
            </button>
          )}
        </div>

        <div className="w-24">
          <Select value={type} onValueChange={(v) => handleTypeChange(v as ValueType)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="object">object</SelectItem>
              <SelectItem value="null">null</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-0">
          {isObject ? (
            <span className="text-xs text-muted-foreground px-2">{`{${Object.keys(objValue).length} keys}`}</span>
          ) : type === "boolean" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => onUpdate(name, e.target.checked)}
                className="rounded border-muted"
              />
              {value ? "true" : "false"}
            </label>
          ) : (
            <Input
              value={valueToString(value)}
              onChange={(e) => handleValueChange(e.target.value)}
              className="h-8"
            />
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(name)}
          aria-label="Remove property"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>

      {isObject && (
        <div className="border-l border-muted ml-2 pl-2">
          <ObjectRows
            value={objValue}
            depth={depth + 1}
            onChange={(next) => onUpdate(name, next)}
          />
        </div>
      )}
    </div>
  );
}

interface ObjectRowsProps {
  value: Record<string, unknown>;
  depth?: number;
  onChange: (obj: Record<string, unknown>) => void;
}

function ObjectRows({ value, depth = 0, onChange }: ObjectRowsProps) {
  const handleUpdate = useCallback(
    (name: string, newValue: unknown) => {
      onChange({ ...value, [name]: newValue });
    },
    [value, onChange]
  );

  const handleRename = useCallback(
    (oldName: string, newName: string) => {
      if (oldName === newName) return;
      const { [oldName]: _, ...rest } = value;
      onChange({ ...rest, [newName]: _ });
    },
    [value, onChange]
  );

  const handleRemove = useCallback(
    (name: string) => {
      const { [name]: _, ...rest } = value;
      onChange(rest);
    },
    [value, onChange]
  );

  return (
    <div className="space-y-1">
      {Object.entries(value).map(([key, val]) => (
        <Row
          key={key}
          name={key}
          value={val}
          depth={depth}
          onUpdate={handleUpdate}
          onRename={handleRename}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}

export function NestedObjectEditor({ value = {}, onChange }: NestedObjectEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<ValueType>("string");

  const handleAdd = () => {
    if (!newKey.trim()) return;
    if (newKey in value) return;

    let defaultValue: unknown = "";
    if (newType === "boolean") defaultValue = false;
    if (newType === "number") defaultValue = 0;
    if (newType === "null") defaultValue = null;
    if (newType === "object") defaultValue = {};

    onChange?.({ ...value, [newKey.trim()]: defaultValue });
    setNewKey("");
  };

  const handleObjectChange = useCallback(
    (next: Record<string, unknown>) => {
      onChange?.(next);
    },
    [onChange]
  );

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="New property name"
            className="h-9"
          />
        </div>
        <div className="w-28">
          <Select value={newType} onValueChange={(v) => setNewType(v as ValueType)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="object">object</SelectItem>
              <SelectItem value="null">null</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={!newKey.trim()}>
          Add
        </Button>
      </div>

      <ObjectRows value={value} onChange={handleObjectChange} />

      {Object.keys(value).length === 0 && (
        <p className="text-sm text-muted-foreground">No properties. Add one above.</p>
      )}
    </div>
  );
}
