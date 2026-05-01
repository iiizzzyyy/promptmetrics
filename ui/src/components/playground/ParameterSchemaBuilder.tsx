"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export type SchemaType = "string" | "number" | "boolean" | "object" | "array";

export interface SchemaField {
  id: string;
  name: string;
  type: SchemaType;
  description: string;
  required: boolean;
  children?: SchemaField[];
}

export interface ParameterSchemaBuilderProps {
  value?: Record<string, unknown>;
  onChange?: (schema: Record<string, unknown>) => void;
}

function generateId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function jsonSchemaToFields(schema: Record<string, unknown>): SchemaField[] {
  const props = (schema.properties || {}) as Record<string, unknown>;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];

  return Object.entries(props).map(([name, def]) => {
    const d = def as Record<string, unknown>;
    const type = (d.type as SchemaType) || "string";
    const children = type === "object" ? jsonSchemaToFields(d as Record<string, unknown>) : undefined;
    return {
      id: generateId(),
      name,
      type,
      description: (d.description as string) || "",
      required: required.includes(name),
      children,
    };
  });
}

function fieldsToJsonSchema(fields: SchemaField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const f of fields) {
    const prop: Record<string, unknown> = {
      type: f.type,
      description: f.description,
    };
    if (f.type === "object" && f.children) {
      Object.assign(prop, fieldsToJsonSchema(f.children));
    }
    properties[f.name] = prop;
    if (f.required) required.push(f.name);
  }

  return { type: "object", properties, required };
}

interface FieldRowProps {
  field: SchemaField;
  depth?: number;
  onUpdate: (id: string, updates: Partial<SchemaField>) => void;
  onRemove: (id: string) => void;
  onAddChild: (parentId: string) => void;
}

function FieldRow({ field, depth = 0, onUpdate, onRemove, onAddChild }: FieldRowProps) {
  const isObject = field.type === "object";
  const indentClass = depth > 0 ? `ml-${Math.min(depth * 4, 12)}` : "";

  return (
    <div className={`space-y-2 ${indentClass}`}>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Label className="text-xs">Name</Label>
          <Input
            value={field.name}
            onChange={(e) => onUpdate(field.id, { name: e.target.value })}
            placeholder="field_name"
            className="h-9"
          />
        </div>
        <div className="w-28">
          <Label className="text-xs">Type</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onUpdate(field.id, { type: v as SchemaType })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="object">object</SelectItem>
              <SelectItem value="array">array</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
              className="rounded border-muted"
            />
            Required
          </label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(field.id)}
          aria-label="Remove field"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={field.description}
            onChange={(e) => onUpdate(field.id, { description: e.target.value })}
            placeholder="Description..."
            className="h-8 text-sm"
          />
        </div>
        {isObject && (
          <Button variant="outline" size="sm" onClick={() => onAddChild(field.id)}>
            + Nested
          </Button>
        )}
      </div>
      {isObject && field.children && field.children.length > 0 && (
        <div className="border-l-2 border-muted pl-3 space-y-3 mt-2">
          {field.children.map((child) => (
            <FieldRow
              key={child.id}
              field={child}
              depth={depth + 1}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ParameterSchemaBuilder({ value, onChange }: ParameterSchemaBuilderProps) {
  const [fields, setFields] = useState<SchemaField[]>(() =>
    value && Object.keys(value).length > 0 ? jsonSchemaToFields(value) : []
  );

  const emitChange = useCallback(
    (next: SchemaField[]) => {
      const schema = fieldsToJsonSchema(next);
      onChange?.(schema);
    },
    [onChange]
  );

  const addField = useCallback(() => {
    setFields((prev) => {
      const next = [
        ...prev,
        { id: generateId(), name: "", type: "string" as SchemaType, description: "", required: false },
      ];
      emitChange(next);
      return next;
    });
  }, [emitChange]);

  const updateField = useCallback(
    (id: string, updates: Partial<SchemaField>) => {
      setFields((prev) => {
        const updateRecursively = (list: SchemaField[]): SchemaField[] => {
          return list.map((f) => {
            if (f.id === id) {
              const next = { ...f, ...updates };
              if (updates.type && updates.type !== "object") {
                next.children = undefined;
              }
              return next;
            }
            if (f.children) {
              return { ...f, children: updateRecursively(f.children) };
            }
            return f;
          });
        };
        const next = updateRecursively(prev);
        emitChange(next);
        return next;
      });
    },
    [emitChange]
  );

  const removeField = useCallback(
    (id: string) => {
      setFields((prev) => {
        const removeRecursively = (list: SchemaField[]): SchemaField[] => {
          return list
            .filter((f) => f.id !== id)
            .map((f) => (f.children ? { ...f, children: removeRecursively(f.children) } : f));
        };
        const next = removeRecursively(prev);
        emitChange(next);
        return next;
      });
    },
    [emitChange]
  );

  const addChild = useCallback(
    (parentId: string) => {
      setFields((prev) => {
        const addRecursively = (list: SchemaField[]): SchemaField[] => {
          return list.map((f) => {
            if (f.id === parentId) {
              const children = f.children || [];
              return {
                ...f,
                children: [
                  ...children,
                  { id: generateId(), name: "", type: "string" as SchemaType, description: "", required: false },
                ],
              };
            }
            if (f.children) {
              return { ...f, children: addRecursively(f.children) };
            }
            return f;
          });
        };
        const next = addRecursively(prev);
        emitChange(next);
        return next;
      });
    },
    [emitChange]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            onUpdate={updateField}
            onRemove={removeField}
            onAddChild={addChild}
          />
        ))}
      </div>
      <Button variant="outline" onClick={addField}>
        + Add Field
      </Button>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No fields defined. Click "Add Field" to start building the schema.
        </p>
      )}
    </div>
  );
}
