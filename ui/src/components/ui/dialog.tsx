import * as React from "react";

type DialogRootProps = {
  open?: boolean;
  modal_class?: string;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

export const Dialog = ({
  open = false,
  modal_class,
  onOpenChange,
  children,
}: DialogRootProps) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div
        className={`relative w-full sm:max-w-lg mx-auto z-50 ${modal_class}`}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => (
  <div
    className={[
      "rounded-lg border p-6 bg-background shadow-lg",
      className,
    ].join(" ")}
    {...props}
  />
);

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => <div className={["space-y-1.5", className].join(" ")} {...props} />;

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => (
  <div className={["flex justify-end gap-2", className].join(" ")} {...props} />
);

export const DialogTitle: React.FC<
  React.HTMLAttributes<HTMLHeadingElement>
> = ({ className = "", ...props }) => (
  <h2 className={["text-lg font-semibold", className].join(" ")} {...props} />
);

export const DialogDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className = "", ...props }) => (
  <p
    className={["text-sm text-muted-foreground", className].join(" ")}
    {...props}
  />
);

export default Dialog;
