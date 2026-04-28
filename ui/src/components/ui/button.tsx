import * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "default"
    | "outline"
    | "ghost"
    | "accent"
    | "destructive"
    | "outline-accent";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const buttonVariants = (props?: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) => {
  const variant = props?.variant || "default";
  const size = props?.size || "md";

  const variantClass =
    variant === "outline"
      ? "border border-[#E0EBE3] text-[#ededed] bg-transparent hover:bg-[#ddc6c6] hover:text-[#262626]"
      : variant === "ghost"
      ? "bg-transparent hover:bg-muted"
      : variant === "accent"
      ? "bg-transparent hover:bg-[#ddc6c6]"
      : variant === "outline-accent"
      ? "border border-[#E0EBE3] text-[#ededed] bg-transparent hover:bg-[#ddc6c6] hover:text-[#262626]"
      : variant === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  const sizeClass =
    size === "sm"
      ? "px-3 py-1.5 text-sm"
      : size === "lg"
      ? "px-5 py-3 text-base"
      : "px-4 py-2";

  return `inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors min-h-[44px] ${variantClass} ${sizeClass}`;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "md",
      loading = false,
      children,
      ...props
    },
    ref
  ) => {
    const variantClass =
      variant === "outline"
        ? "border border-[#E0EBE3] text-[#ededed] bg-transparent hover:bg-[#ddc6c6] hover:text-[#262626]"
        : variant === "ghost"
        ? "bg-transparent hover:bg-muted"
        : variant === "accent"
        ? "bg-transparent hover:bg-[#ddc6c6]"
        : variant === "outline-accent"
        ? "border border-[#E0EBE3] text-[#ededed] bg-transparent hover:bg-[#ddc6c6] hover:text-[#262626]"
        : variant === "destructive"
        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        : "bg-primarygradient text-primary-foreground hover:opacity-90";
    const sizeClass =
      size === "sm"
        ? "px-3 py-1.5 text-sm"
        : size === "lg"
        ? "px-5 py-3 text-base"
        : "px-4 py-2";
    return (
      <button
        ref={ref}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors cursor-pointer min-h-[44px]",
          !className.includes("bg-") ? variantClass : "",
          sizeClass,
          className,
        ].join(" ")}
        {...props}
      >
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
