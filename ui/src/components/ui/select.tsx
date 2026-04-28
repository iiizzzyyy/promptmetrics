import * as React from "react";

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(
  undefined
);

interface SelectProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export const Select = ({
  children,
  value,
  onValueChange,
  disabled,
}: SelectProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div
        className={`relative ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className = "", children, ...props }, ref) => {
  const context = React.useContext(SelectContext);

  return (
    <button
      ref={ref}
      type="button"
      className={[
        "flex h-11 w-full items-center justify-between rounded-[10px] border border-white/10 bg-[#111] px-3 py-2 text-sm min-h-[44px]",
        className,
      ].join(" ")}
      onClick={() => context?.setOpen(!context.open)}
      {...props}
    >
      {children}
      <svg
        className="h-4 w-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const context = React.useContext(SelectContext);
  return <span>{context?.value || placeholder}</span>;
};

export const SelectContent = ({ children }: { children: React.ReactNode }) => {
  const context = React.useContext(SelectContext);

  if (!context?.open) return null;

  return (
    <div className="absolute z-50 mt-1 w-full rounded-md border border-white/10 bg-[#111] p-1 shadow-lg">
      {children}
    </div>
  );
};

export const SelectItem = ({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) => {
  const context = React.useContext(SelectContext);

  const handleClick = () => {
    context?.onValueChange(value);
    context?.setOpen(false);
  };

  return (
    <div
      className={`px-2 py-2.5 text-sm hover:bg-[#171717] rounded cursor-pointer min-h-[44px] inline-flex items-center ${
        context?.value === value ? "bg-[#171717]" : ""
      }`}
      onClick={handleClick}
    >
      {children}
    </div>
  );
};
