"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ConfirmModal } from "@/components/common/confirm-modal";
import { DateRangePicker } from "@/components/common/date-range-picker";

export default function TestUIPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState([50]);
  const [switchOn, setSwitchOn] = useState(true);
  const [selectValue, setSelectValue] = useState("apple");
  const [toggleValue, setToggleValue] = useState("grid");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">UI Primitives Test Page</h1>
        <p className="text-muted-foreground mt-1">
          Renders every new shadcn component added in Phase 1 to verify they compose correctly.
        </p>
      </div>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="accent">Accent</Button>
          <Button loading>Loading</Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dialog</h2>
        <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>
                This dialog verifies that the custom Dialog primitive renders correctly with all sub-components.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="test-input">Sample input</Label>
              <Input id="test-input" placeholder="Type something..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Slider</h2>
        <div className="w-64">
          <Slider value={sliderValue} onValueChange={(v) => setSliderValue(Array.isArray(v) ? [...v] : [v])} max={100} step={1} />
          <p className="text-sm text-muted-foreground mt-2">Value: {sliderValue[0]}</p>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Switch</h2>
        <div className="flex items-center gap-3">
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
          <span className="text-sm">{switchOn ? "On" : "Off"}</span>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Select</h2>
        <div className="w-64">
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a fruit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
              <SelectItem value="cherry">Cherry</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tabs</h2>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <div className="rounded-lg border p-4 text-sm">Account settings go here.</div>
          </TabsContent>
          <TabsContent value="password">
            <div className="rounded-lg border p-4 text-sm">Password settings go here.</div>
          </TabsContent>
          <TabsContent value="settings">
            <div className="rounded-lg border p-4 text-sm">General settings go here.</div>
          </TabsContent>
        </Tabs>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Popover</h2>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm">This is popover content. Click outside to close.</p>
          </PopoverContent>
        </Popover>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Toggle Group</h2>
        <ToggleGroup type="single" value={toggleValue} onValueChange={(v) => v && setToggleValue(v as string)}>
          <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
          <ToggleGroupItem value="list">List</ToggleGroupItem>
          <ToggleGroupItem value="table">Table</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-sm text-muted-foreground">Selected: {toggleValue}</p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Textarea</h2>
        <Textarea placeholder="Type a longer message..." className="w-full max-w-md" />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Resizable Panels</h2>
        <div className="h-48 rounded-lg border">
          <ResizablePanelGroup>
            <ResizablePanel defaultSize={30}>
              <div className="flex h-full items-center justify-center text-sm">Left</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={70}>
              <div className="flex h-full items-center justify-center text-sm">Right</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Skeleton</h2>
        <div className="space-y-2 max-w-md">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Badges</h2>
        <div className="flex gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ConfirmModal</h2>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Show Confirm Modal
        </Button>
        <ConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete this item?"
          description="This action cannot be undone. The item will be permanently removed from your workspace."
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={() => setConfirmOpen(false)}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">DateRangePicker</h2>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Select date range"
        />
        <p className="text-sm text-muted-foreground">
          {dateRange.from && dateRange.to
            ? `Selected: ${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
            : "No range selected"}
        </p>
      </section>
    </div>
  );
}
