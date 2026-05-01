"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePlaygroundStore, VariableSet } from "@/stores/playground.store";

const variableRowSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  variables: z
    .array(variableRowSchema)
    .refine(
      (items) => {
        const keys = items.map((item) => item.key.trim()).filter(Boolean);
        return new Set(keys).size === keys.length;
      },
      { message: "Variable keys must be unique" }
    ),
});

type FormData = z.infer<typeof formSchema>;

export interface VariableSetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  variableSet?: VariableSet;
}

export function VariableSetModal({
  open,
  onOpenChange,
  mode,
  variableSet,
}: VariableSetModalProps) {
  const addVariableSet = usePlaygroundStore((state) => state.addVariableSet);
  const updateVariableSet = usePlaygroundStore(
    (state) => state.updateVariableSet
  );

  const defaultValues = React.useMemo<FormData>(() => {
    if (mode === "edit" && variableSet) {
      return {
        name: variableSet.name,
        variables:
          Object.entries(variableSet.variables).length > 0
            ? Object.entries(variableSet.variables).map(([key, value]) => ({
                key,
                value,
              }))
            : [{ key: "", value: "" }],
      };
    }
    return {
      name: "",
      variables: [{ key: "", value: "" }],
    };
  }, [mode, variableSet]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variables",
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, reset, defaultValues]);

  const onSubmit = (data: FormData) => {
    try {
      const variablesRecord: Record<string, string> = {};
      data.variables.forEach(({ key, value }) => {
        const trimmedKey = key.trim();
        if (trimmedKey) {
          variablesRecord[trimmedKey] = value;
        }
      });

      if (mode === "edit" && variableSet) {
        updateVariableSet(variableSet.id, {
          name: data.name.trim(),
          variables: variablesRecord,
        });
        console.log("Variable set updated successfully");
      } else {
        const newSet: VariableSet = {
          id: crypto.randomUUID(),
          name: data.name.trim(),
          variables: variablesRecord,
        };
        addVariableSet(newSet);
        console.log("Variable set created successfully");
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save variable set:", err);
    }
  };

  // Focus trap
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector = [
      'input:not([disabled])',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    // Focus first input on open
    const firstInput = container.querySelector<HTMLElement>("input");
    firstInput?.focus();

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const title = mode === "create" ? "Create Variable Set" : "Edit Variable Set";
  const submitLabel = mode === "create" ? "Create" : "Save";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div ref={containerRef}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div>
              <Label htmlFor="variable-set-name">Name</Label>
              <Input
                id="variable-set-name"
                {...register("name")}
                placeholder="e.g. Production Variables"
                aria-invalid={errors.name ? "true" : "false"}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p
                  id="name-error"
                  className="text-sm text-destructive mt-1"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Variables</Label>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <Input
                        {...register(`variables.${index}.key`)}
                        placeholder="Key"
                        aria-invalid={
                          errors.variables?.[index]?.key ? "true" : "false"
                        }
                        aria-describedby={
                          errors.variables?.[index]?.key
                            ? `key-error-${index}`
                            : undefined
                        }
                      />
                      {errors.variables?.[index]?.key && (
                        <p
                          id={`key-error-${index}`}
                          className="text-sm text-destructive mt-1"
                        >
                          {errors.variables[index].key.message}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        {...register(`variables.${index}.value`)}
                        placeholder="Value"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      aria-label={`Remove variable row ${index + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              {errors.variables && typeof errors.variables.message === "string" && (
                <p className="text-sm text-destructive">
                  {errors.variables.message}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ key: "", value: "" })}
              >
                Add Variable
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </div>
    </Dialog>
  );
}

export function CreateVariableSetModal(
  props: Omit<VariableSetModalProps, "mode" | "variableSet">
) {
  return <VariableSetModal {...props} mode="create" />;
}

export function EditVariableSetModal(
  props: Omit<VariableSetModalProps, "mode">
) {
  return <VariableSetModal {...props} mode="edit" />;
}
