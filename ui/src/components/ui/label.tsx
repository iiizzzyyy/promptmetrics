import * as React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className = "", ...props }, ref) => (
  <label ref={ref} className={["text-sm text-left w-full block text-[#ededed] font-medium", className].join(" ")} {...props} />
));
Label.displayName = "Label";

export default Label;
