"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

interface ToggleGroupProps {
  type?: "single" | "multiple";
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children?: React.ReactNode;
  className?: string;
}

export const ToggleGroup = ({
  type = "single",
  value,
  onValueChange,
  children,
  className,
}: ToggleGroupProps) => {
  const sharedProps = {
    className: cn("flex items-center gap-1", className),
    children,
  };

  if (type === "single") {
    return (
      <ToggleGroupPrimitive.Root
        type="single"
        value={value as string | undefined}
        onValueChange={(v: string) => onValueChange?.(v)}
        {...sharedProps}
      />
    );
  }

  return (
    <ToggleGroupPrimitive.Root
      type="multiple"
      value={value as string[] | undefined}
      onValueChange={(v: string[]) => onValueChange?.(v)}
      {...sharedProps}
    />
  );
};

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  isActive?: boolean;
}

export const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  ToggleGroupItemProps
>(({ value, className, ...props }, ref) => {
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      value={value}
      className={cn(
        "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground",
        className
      )}
      {...props}
    />
  );
});
ToggleGroupItem.displayName = "ToggleGroupItem";
