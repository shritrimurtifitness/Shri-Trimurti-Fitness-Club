import { useState, useEffect, useMemo } from "react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  getDay,
  isBefore,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, User, Phone, CreditCard, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

type CalendarView = "day" | "week" | "month";

interface CalendarBooking {
  id: string;
  customer_name: string;
  phone: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "cancelled";
  payment_status: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  facility_type: string;
  facility_name: string;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  confirmed: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  pending: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  cancelled: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-600 dark:text-red-400/60", dot: "bg-red-500/60" },
  completed: { bg: "bg-slate-500/15", border: "border-slate-500/30", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-500" },
};

function getComputedStatus(booking: CalendarBooking) {
  if (booking.status !== "confirmed") return booking.status;
  
  // Safely extract just the 'YYYY-MM-DD' and strip out 'T00:00:00.000Z'
  const dateStr = booking.date.split("T")[0];
  const endDateTime = parseISO(`${dateStr}T${booking.end_time.substring(0, 5)}:00`);
  
  return isBefore(endDateTime, new Date()) ? "completed" : "confirmed";
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(time: string): number {
  const [h, m] = time.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(time: string): string {
  const [h, m] = time.substring(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function AdminCalendar() {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [loading, setLoading] = useState(false);

  // Compute date range based on current view
  const dateRange = useMemo(() => {
    if (view === "day") {
      return { start: currentDate, end: currentDate };
    } else if (view === "week") {
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return { start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) };
    }
  }, [view, currentDate]);

  // Fetch bookings
  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const res = await api.get("/bookings/calendar", {
          params: { startDate: format(dateRange.start, "yyyy-MM-dd"), endDate: format(dateRange.end, "yyyy-MM-dd") },
        });
        setBookings(res.data);
      } catch {
        toast.error("Failed to load calendar data");
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [dateRange]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    if (view === "day") setCurrentDate((d) => subDays(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };
  const goNext = () => {
    if (view === "day") setCurrentDate((d) => addDays(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const handleCancelBooking = async (id: string) => {
    toast("Cancel this booking?", {
      action: {
        label: "Confirm",
        onClick: async () => {
          try {
            await api.patch(`/bookings/${id}/cancel`);
            setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
            setSelectedBooking(null);
            toast.success("Booking cancelled");
          } catch {
            toast.error("Failed to cancel booking");
          }
        },
      },
      cancel: { label: "Keep", onClick: () => {} },
    });
  };

  // Heading label
  const headingLabel = useMemo(() => {
    if (view === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [view, currentDate]);

  // ===== BOOKING EVENT BLOCK (shared by Day & Week) =====
  const BookingBlock = ({ booking, compact = false }: { booking: CalendarBooking; compact?: boolean }) => {
    const computedStatus = getComputedStatus(booking);
    const colors = STATUS_COLORS[computedStatus] || STATUS_COLORS.pending;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
        className={`w-full text-left rounded-lg border px-2 py-1 transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer ${colors.bg} ${colors.border}`}
      >
        {compact ? (
          <p className={`text-[10px] font-semibold truncate ${colors.text}`}>{booking.customer_name}</p>
        ) : (
          <>
            <p className={`text-xs font-bold truncate ${colors.text}`}>{booking.customer_name}</p>
            <p className="text-[10px] text-foreground/60 dark:text-muted-foreground truncate">
              {formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}
            </p>
            <p className="text-[10px] text-foreground/50 dark:text-muted-foreground/70 truncate">{booking.facility_name}</p>
          </>
        )}
      </button>
    );
  };

  // ===== DAY VIEW =====
  const DayView = () => {
    const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.date), currentDate));
    return (
      <div className="relative overflow-auto rounded-xl border border-border bg-card" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {HOURS.map((hour) => {
          const hourBookings = dayBookings.filter((b) => {
            const startH = parseInt(b.start_time);
            return startH === hour;
          });
          return (
            <div key={hour} className="flex border-b border-border/50 min-h-[72px]">
              <div className="w-20 shrink-0 py-3 px-3 text-xs font-mono text-muted-foreground border-r border-border/50 bg-muted/20">
                {hour > 12 ? hour - 12 : hour} {hour >= 12 ? "PM" : "AM"}
              </div>
              <div className="flex-1 p-1.5 flex flex-wrap gap-1">
                {hourBookings.map((b) => (
                  <div key={b.id} className="flex-1 min-w-[200px]">
                    <BookingBlock booking={b} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ===== WEEK VIEW =====
  const WeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="overflow-auto rounded-xl border border-border bg-card" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <div className="min-w-[800px] lg:min-w-full">
          {/* Column Headers */}
          <div className="flex sticky top-0 z-10 bg-card border-b border-border">
          <div className="w-20 shrink-0 border-r border-border/50" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              onClick={() => { setCurrentDate(day); setView("day"); }}
              className={`flex-1 text-center py-3 border-r border-border/30 cursor-pointer hover:bg-muted/30 transition-colors ${
                isToday(day) ? "bg-primary/5" : ""
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {DAY_LABELS[getDay(day)]}
              </p>
              <p className={`text-lg font-bold ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                {format(day, "d")}
              </p>
            </div>
          ))}
        </div>

        {/* Hour Rows */}
        {HOURS.map((hour) => (
          <div key={hour} className="flex border-b border-border/30 min-h-[56px]">
            <div className="w-20 shrink-0 py-2 px-3 text-[10px] font-mono text-muted-foreground border-r border-border/50 bg-muted/10">
              {hour > 12 ? hour - 12 : hour} {hour >= 12 ? "PM" : "AM"}
            </div>
            {days.map((day) => {
              const cellBookings = bookings.filter(
                (b) => isSameDay(parseISO(b.date), day) && parseInt(b.start_time) === hour
              );
              return (
                <div key={day.toISOString()} className={`flex-1 p-0.5 border-r border-border/20 ${isToday(day) ? "bg-primary/5" : ""}`}>
                  {cellBookings.map((b) => (
                    <BookingBlock key={b.id} booking={b} compact />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>
    );
  };

  // ===== MONTH VIEW =====
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weeks: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      weeks.push(week);
    }

    return (
      <div className="rounded-xl border border-border bg-card overflow-auto">
        <div className="min-w-[800px] lg:min-w-full">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-r border-border/30 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/30 last:border-b-0">
            {week.map((day) => {
              const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.date), day));
              const inMonth = isSameMonth(day, currentDate);
              const confirmedCount = dayBookings.filter(b => getComputedStatus(b) === "confirmed").length;
              const pendingCount = dayBookings.filter(b => getComputedStatus(b) === "pending").length;
              const completedCount = dayBookings.filter(b => getComputedStatus(b) === "completed").length;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => { setCurrentDate(day); setView("day"); }}
                  className={`min-h-[100px] p-2 border-r border-border/20 last:border-r-0 cursor-pointer transition-colors hover:bg-muted/30 ${
                    !inMonth ? "opacity-30" : ""
                  } ${isToday(day) ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}
                >
                  <p className={`text-sm font-bold mb-1.5 ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((b) => {
                      const currentStatus = getComputedStatus(b);
                      const colors = STATUS_COLORS[currentStatus] || STATUS_COLORS.pending;
                      return (
                        <button
                          key={b.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                          className={`w-full text-left text-[10px] font-medium truncate rounded px-1.5 py-0.5 ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity`}
                        >
                          {formatTime12(b.start_time)} {b.customer_name}
                        </button>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-[10px] text-muted-foreground font-medium pl-1">+{dayBookings.length - 3} more</p>
                    )}
                  </div>
                  {/* Status dots summary */}
                  {dayBookings.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {confirmedCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-emerald-700 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {confirmedCount}
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-amber-700 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {pendingCount}
                        </span>
                      )}
                      {completedCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-slate-600 dark:text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          {completedCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ===== TOOLBAR ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs font-semibold">
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goPrev} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goNext} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="font-heading font-bold text-lg text-foreground whitespace-nowrap">{headingLabel}</h2>
        </div>

        {/* View Toggle */}
        <div className="flex bg-secondary/50 p-1 rounded-lg">
          {(["day", "week", "month"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CALENDAR BODY ===== */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {view === "day" && <DayView />}
          {view === "week" && <WeekView />}
          {view === "month" && <MonthView />}
        </>
      )}

      {/* ===== BOOKING DETAIL MODAL ===== */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Booking Details
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (() => {
            const computedStats = getComputedStatus(selectedBooking);
            const colors = STATUS_COLORS[computedStats] || STATUS_COLORS.pending;
            return (
              <div className="space-y-4 py-2">
                {/* Status Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  {computedStats}
                </div>

                {/* Time & Date */}
                <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border border-border">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date & Time</p>
                    <p className="font-semibold text-foreground">
                      {format(parseISO(selectedBooking.date), "EEE, MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime12(selectedBooking.start_time)} → {formatTime12(selectedBooking.end_time)}
                    </p>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="font-medium text-foreground">{selectedBooking.customer_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-foreground">{selectedBooking.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Facility</p>
                      <p className="font-medium text-foreground capitalize">{selectedBooking.facility_name} <span className="text-xs text-muted-foreground">({selectedBooking.facility_type})</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="font-medium text-foreground">
                        ₹{Number(selectedBooking.paid_amount || 0)} / ₹{Number(selectedBooking.total_amount)}
                        {Number(selectedBooking.remaining_amount) > 0 && (
                          <span className="text-amber-700 dark:text-amber-400 text-xs ml-2">(₹{Number(selectedBooking.remaining_amount)} due)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {selectedBooking.status !== "cancelled" && computedStats !== "completed" && (
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      onClick={() => handleCancelBooking(selectedBooking.id)}
                      className="w-full text-destructive hover:bg-destructive/10 font-semibold"
                    >
                      <X className="w-4 h-4 mr-2" /> Cancel Booking
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
