"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date | string
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  fromDate?: Date
  disabled?: React.ComponentProps<typeof Calendar>["disabled"]
}

export function DatePicker({ date, setDate, placeholder = "Pick a date", className, fromDate, disabled }: DatePickerProps) {
  const selectedDate = React.useMemo(() => {
    if (!date) return undefined;
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? undefined : d;
  }, [date]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal border-border bg-card hover:bg-muted/50 transition-colors",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border shadow-xl" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setDate}
          fromDate={fromDate}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
