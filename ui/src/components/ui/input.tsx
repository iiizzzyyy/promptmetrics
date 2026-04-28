import * as React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={[
      "flex h-10 w-full rounded-[10px] border border-white/10 bg-[#111] px-3 py-2 text-sm text-[#ededed]",
      "placeholder:text-muted-foreground",
      "focus:outline-none focus:ring-2 focus:ring-[#389438] focus:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    ].join(" ")}
    {...props}
  />
));
Input.displayName = "Input";
