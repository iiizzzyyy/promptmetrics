import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "horizontal" | "vertical";
}

export const ResizablePanelGroup = React.forwardRef<
  HTMLDivElement,
  ResizablePanelGroupProps
>(({ direction = "horizontal", className, children, ...props }, ref) => {
  return (
    <Group
      orientation={direction}
      className={cn(
        "flex",
        direction === "horizontal" ? "flex-row" : "flex-col",
        "h-full w-full",
        className
      )}
      {...props}
    >
      {children}
    </Group>
  );
});
ResizablePanelGroup.displayName = "ResizablePanelGroup";

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultSize?: number;
  minSize?: number;
}

export const ResizablePanel = React.forwardRef<
  HTMLDivElement,
  ResizablePanelProps
>(({ defaultSize = 50, minSize = 10, className, children, ...props }, ref) => {
  return (
    <Panel
      defaultSize={defaultSize}
      minSize={minSize}
      className={cn("overflow-auto", className)}
      {...props}
    >
      {children}
    </Panel>
  );
});
ResizablePanel.displayName = "ResizablePanel";

export const ResizableHandle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      className={cn(
        "flex w-1 items-center justify-center bg-border hover:bg-primary/50 cursor-col-resize",
        className
      )}
      {...props}
    >
      <div className="h-8 w-0.5 rounded-full bg-muted-foreground/20" />
    </Separator>
  );
});
ResizableHandle.displayName = "ResizableHandle";
