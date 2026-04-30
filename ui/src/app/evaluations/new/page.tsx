"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  prompt_name: z.string().min(1, "Prompt is required"),
  version_tag: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewEvaluationPage() {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      prompt_name: "",
      version_tag: "",
    },
  });

  const { data: promptsData, isLoading: promptsLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => api.getPrompts({ limit: 100 }),
  });

  const prompts = useMemo(() => promptsData?.items || [], [promptsData]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.createEvaluation({
        name: data.name,
        description: data.description,
        prompt_name: data.prompt_name,
        version_tag: data.version_tag,
      }),
    onSuccess: () => {
      router.push("/evaluations");
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="pm-h3">Create Evaluation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a new evaluation for a prompt.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. QA Accuracy Check"
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description of this evaluation..."
              {...register("description")}
              aria-invalid={errors.description ? "true" : "false"}
              aria-describedby={
                errors.description ? "description-error" : undefined
              }
            />
            {errors.description && (
              <p id="description-error" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt_name">Prompt</Label>
            {promptsLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Controller
                name="prompt_name"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={promptsLoading || mutation.isPending}
                  >
                    <SelectTrigger id="prompt_name">
                      <SelectValue placeholder="Select a prompt" />
                    </SelectTrigger>
                    <SelectContent>
                      {prompts.map((prompt) => (
                        <SelectItem key={prompt.name} value={prompt.name}>
                          {prompt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.prompt_name && (
              <p id="prompt_name-error" className="text-sm text-destructive">
                {errors.prompt_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="version_tag">Version Tag</Label>
            <Input
              id="version_tag"
              placeholder="e.g. v1.0.0 (optional)"
              {...register("version_tag")}
              aria-invalid={errors.version_tag ? "true" : "false"}
              aria-describedby={
                errors.version_tag ? "version_tag-error" : undefined
              }
            />
            {errors.version_tag && (
              <p id="version_tag-error" className="text-sm text-destructive">
                {errors.version_tag.message}
              </p>
            )}
          </div>

          {mutation.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to create evaluation:{" "}
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Unknown error"}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/evaluations")}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || promptsLoading}
            >
              {mutation.isPending ? "Creating..." : "Create Evaluation"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
