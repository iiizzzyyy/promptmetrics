"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function parseRowsJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { success: false as const, error: "Rows must be a JSON array" };
    }
    if (parsed.length < 1) {
      return { success: false as const, error: "Rows must contain at least 1 item" };
    }
    if (parsed.length > 10000) {
      return { success: false as const, error: "Rows must contain at most 10000 items" };
    }
    for (const row of parsed) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        return { success: false as const, error: "Each row must be an object" };
      }
      if (!("input" in row)) {
        return { success: false as const, error: "Each row must have an input field" };
      }
    }
    return { success: true as const, data: parsed };
  } catch {
    return { success: false as const, error: "Invalid JSON" };
  }
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  rows: z
    .string()
    .min(1, "Rows are required")
    .superRefine((value, ctx) => {
      const parsed = parseRowsJson(value);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsed.error,
        });
      }
    }),
});

type FormData = z.infer<typeof formSchema>;

export default function NewDatasetPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      rows: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const parsed = parseRowsJson(data.rows);
      if (!parsed.success) {
        throw new Error(parsed.error);
      }
      return api.createDataset({
        name: data.name,
        rows: parsed.data,
      });
    },
    onSuccess: () => {
      router.push("/datasets");
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="pm-h3">Create Dataset</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a new dataset for evaluations and A/B tests.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. QA Test Cases"
              {...register("name")}
              aria-invalid={errors.name ? "true" : "false"}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rows">Rows</Label>
            <Textarea
              id="rows"
              placeholder={`[\n  {\n    "input": { "question": "What is 2+2?" },\n    "expectedOutput": { "answer": "4" }\n  }\n]`}
              rows={12}
              {...register("rows")}
              aria-invalid={errors.rows ? "true" : "false"}
              aria-describedby={errors.rows ? "rows-error" : undefined}
            />
            {errors.rows && (
              <p id="rows-error" className="text-sm text-destructive">
                {errors.rows.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter a JSON array of objects with <code>input</code> and optional{" "}
              <code>expectedOutput</code> fields. Min 1 item, max 10000 items.
            </p>
          </div>

          {mutation.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to create dataset:{" "}
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Unknown error"}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/datasets")}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create Dataset"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
