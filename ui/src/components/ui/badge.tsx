import * as React from "react";

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "outline" | "secondary";
};

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variantClass =
      variant === "outline"
        ? "border border-input bg-background hover:bg-muted"
        : variant === "secondary"
        ? "bg-[#ceb6b6] text-[#262626] hover:bg-[#ceb6b6]/80"
        : "bg-primary text-primary-foreground hover:bg-primary/90";

    return (
      <div
        ref={ref}
        className={[
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
          variantClass,
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
