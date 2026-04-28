import * as React from "react";

interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = "horizontal", className = "" }, ref) => {
    return (
      <div
        ref={ref}
        className={`${
          orientation === "horizontal"
            ? "h-px w-full bg-border"
            : "w-px h-full bg-border"
        } ${className}`}
      />
    );
  }
);

Separator.displayName = "Separator";
