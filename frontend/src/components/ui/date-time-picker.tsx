"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  date?: string
  onChange: (date: string) => void
  placeholder?: string
}

export function DateTimePicker({ date, onChange, placeholder = "Pick date & time" }: DateTimePickerProps) {
  const selectedDate = React.useMemo(() => {
    if (!date) return undefined;
    const d = new Date(date);
    return isNaN(d.getTime()) ? undefined : d;
  }, [date]);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) return
    const current = selectedDate || new Date()
    newDate.setHours(current.getHours())
    newDate.setMinutes(current.getMinutes())
    onChange(newDate.toISOString())
  }

  const handleTimeChange = (type: 'hours' | 'minutes', value: string) => {
    const current = selectedDate || new Date()
    if (type === 'hours') current.setHours(parseInt(value))
    else current.setMinutes(parseInt(value))
    onChange(current.toISOString())
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal border-border bg-card",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP p") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 border-border shadow-xl space-y-4" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Select 
              value={selectedDate?.getHours().toString()} 
              onValueChange={(v) => handleTimeChange('hours', v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, i) => (
                  <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={selectedDate?.getMinutes().toString()} 
              onValueChange={(v) => handleTimeChange('minutes', v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {[0, 15, 30, 45].map((m) => (
                  <SelectItem key={m} value={m.toString()}>{m.toString().padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
