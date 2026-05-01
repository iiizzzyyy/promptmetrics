"use client";

import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
}

function formatDate(date?: Date): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [fromStr, setFromStr] = useState(formatDate(value?.from));
  const [toStr, setToStr] = useState(formatDate(value?.to));

  const handleApply = () => {
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    onChange?.({ from, to });
    setOpen(false);
  };

  const handleClear = () => {
    setFromStr("");
    setToStr("");
    onChange?.({});
    setOpen(false);
  };

  const displayText =
    value?.from && value?.to
      ? `${value.from.toLocaleDateString()} - ${value.to.toLocaleDateString()}`
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors cursor-pointer min-h-[44px] px-4 py-2 border border-[#E0EBE3] text-[#ededed] bg-transparent hover:bg-[#ddc6c6] hover:text-[#262626] min-w-[240px] justify-start text-left font-normal">
        <svg className="mr-2 h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value?.from ? "" : "text-muted-foreground"}>{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="date-from">From</Label>
          <Input
            id="date-from"
            type="date"
            value={fromStr}
            onChange={(e) => setFromStr(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">To</Label>
          <Input
            id="date-to"
            type="date"
            value={toStr}
            onChange={(e) => setToStr(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
