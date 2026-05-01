"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const formSchema = z.object({
  prompt_name: z.string().min(1, "Prompt name is required"),
  version_a: z.string().min(1, "Version A is required"),
  version_b: z.string().min(1, "Version B is required"),
  metric: z.enum(["latency", "cost", "win_rate"]),
  dataset_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewABTestPage() {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt_name: "",
      version_a: "",
      version_b: "",
      metric: "latency",
      dataset_id: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.createABTest({
        prompt_name: data.prompt_name,
        version_a: data.version_a,
        version_b: data.version_b,
        metric: data.metric,
        dataset_id: data.dataset_id ? Number(data.dataset_id) : undefined,
      }),
    onSuccess: () => {
      router.push("/ab-tests");
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="pm-h3">Create A/B Test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a new A/B test comparing two prompt versions.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="prompt_name">Prompt Name</Label>
            <Input
              id="prompt_name"
              placeholder="e.g. qa-prompt"
              {...register("prompt_name")}
              aria-invalid={errors.prompt_name ? "true" : "false"}
              aria-describedby={
                errors.prompt_name ? "prompt_name-error" : undefined
              }
            />
            {errors.prompt_name && (
              <p id="prompt_name-error" className="text-sm text-destructive">
                {errors.prompt_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version_a">Version A</Label>
              <Input
                id="version_a"
                placeholder="e.g. v1.0.0"
                {...register("version_a")}
                aria-invalid={errors.version_a ? "true" : "false"}
                aria-describedby={
                  errors.version_a ? "version_a-error" : undefined
                }
              />
              {errors.version_a && (
                <p id="version_a-error" className="text-sm text-destructive">
                  {errors.version_a.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="version_b">Version B</Label>
              <Input
                id="version_b"
                placeholder="e.g. v1.1.0"
                {...register("version_b")}
                aria-invalid={errors.version_b ? "true" : "false"}
                aria-describedby={
                  errors.version_b ? "version_b-error" : undefined
                }
              />
              {errors.version_b && (
                <p id="version_b-error" className="text-sm text-destructive">
                  {errors.version_b.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metric">Metric</Label>
            <Controller
              name="metric"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger id="metric">
                    <SelectValue placeholder="Select a metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latency">Latency</SelectItem>
                    <SelectItem value="cost">Cost</SelectItem>
                    <SelectItem value="win_rate">Win Rate</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.metric && (
              <p id="metric-error" className="text-sm text-destructive">
                {errors.metric.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset_id">Dataset ID (optional)</Label>
            <Input
              id="dataset_id"
              type="text"
              inputMode="numeric"
              placeholder="Optional dataset ID"
              {...register("dataset_id")}
              aria-invalid={errors.dataset_id ? "true" : "false"}
              aria-describedby={
                errors.dataset_id ? "dataset_id-error" : undefined
              }
            />
            {errors.dataset_id && (
              <p id="dataset_id-error" className="text-sm text-destructive">
                {errors.dataset_id.message}
              </p>
            )}
          </div>

          {mutation.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to create A/B test:{" "}
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Unknown error"}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/ab-tests")}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create A/B Test"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
