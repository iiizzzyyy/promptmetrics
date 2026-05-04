import * as React from "react";

export type SwitchProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = "", onCheckedChange, onChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className={["h-4 w-8 cursor-pointer", className].join(" ")}
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.currentTarget.checked);
        }}
        {...props}
      />
    );
  }
);
Switch.displayName = "Switch";

export default Switch;
