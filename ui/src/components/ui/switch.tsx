type SwitchProps = {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export const Switch = ({ id, checked, disabled, onCheckedChange, className = "" }: SwitchProps) => {
  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      className={["h-4 w-8 cursor-pointer", className].join(" ")}
      checked={!!checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
    />
  );
};

export default Switch;
