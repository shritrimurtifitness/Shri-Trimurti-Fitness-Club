import { useState, useEffect } from "react";
import { Play, Square, Clock, User, Phone, History, IndianRupee, Filter, Calendar, Smartphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import api from "@/lib/api";
import { DatePicker } from "@/components/ui/date-picker";
import { useSocket } from "@/hooks/useSocket";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  weekday_day_price: number;
  table_count: number;
  is_active?: boolean;
}

interface Session {
  id: string;
  turf_id: string;
  facility_name: string;
  hourly_rate: number;
  start_time: string;
  name: string;
  customer_name: string;
  customer_phone: string;
  weekday_day_price: string;
  weekday_night_price: string;
  weekend_day_price: string;
  weekend_night_price: string;
}

export default function AdminTables() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());

  // History Filters
  const [filterSport, setFilterSport] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  // Start Dialog
  const [startOpen, setStartOpen] = useState(false);
  const [startTarget, setStartTarget] = useState<{ facility: Facility; tableNumber: number } | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Bill Dialog
  const [billOpen, setBillOpen] = useState(false);
  const [billTarget, setBillTarget] = useState<Session | null>(null);
  const [billElapsed, setBillElapsed] = useState(0);
  const [billAmount, setBillAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"upi" | "cash">("cash");

  // Live clock - ticks every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch hourly facilities
  const fetchFacilities = async () => {
    try {
      const res = await api.get("/facilities");
      const hourlyFacs = res.data.filter((f: any) => f.pricing_model === "hourly" && f.is_active !== false);
      setFacilities(hourlyFacs);
    } catch { toast.error("Failed to load facilities"); }
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  useSocket('facility_updated', fetchFacilities);

  // Fetch running sessions
  const fetchSessions = async () => {
    try {
      const res = await api.get("/sessions");
      setSessions(res.data);
    } catch { toast.error("Failed to load sessions"); }
  };

  useEffect(() => { fetchSessions(); fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get("/sessions/history");
      setHistory(res.data);
    } catch { /* silent */ }
  };

  const openStartDialog = (facility: Facility, tableNumber: number) => {
    setStartTarget({ facility, tableNumber });
    setCustomerName("");
    setCustomerPhone("");
    setStartOpen(true);
  };

  const confirmStartSession = async () => {
    if (!startTarget) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      return toast.error("Please enter customer name and phone number");
    }
    try {
      await api.post("/sessions", {
        turf_id: startTarget.facility.id,
        name: `${startTarget.facility.name} #${startTarget.tableNumber}`,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        table_number: startTarget.tableNumber
      });
      toast.success(`${startTarget.facility.name} #${startTarget.tableNumber} session started!`);
      setStartOpen(false);
      setStartTarget(null);
      fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to start session");
    }
  };

  const getSessionRate = (session: Session) => {
    const start = new Date(session.start_time);
    const day = start.getDay();
    const hour = start.getHours();
    const isWeekend = day === 0 || day === 6;
    const isNight = hour >= 18;

    if (isWeekend) {
      return isNight ? Number(session.weekend_night_price) : Number(session.weekend_day_price);
    }
    return isNight ? Number(session.weekday_night_price) : Number(session.weekday_day_price);
  };

  const calcRunningCost = (session: Session) => {
    const rate = getSessionRate(session);
    const start = new Date(session.start_time);
    const elapsedSecs = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
    // Minimum 1 hour billing
    const billableSecs = Math.max(elapsedSecs, 3600);
    const billableMinutes = billableSecs / 60;
    return Math.ceil((billableMinutes / 60) * rate);
  };

  const openBillDialog = (session: Session) => {
    const startMs = new Date(session.start_time).getTime();
    const nowMs = Date.now();
    const elapsedSecs = Math.floor((nowMs - startMs) / 1000);
    const rate = getSessionRate(session);
    // Minimum 1 hour billing: if under 3600 secs, charge full hour
    const billableSecs = Math.max(elapsedSecs, 3600);
    const billableMinutes = billableSecs / 60;
    const amount = Math.ceil((billableMinutes / 60) * rate);

    setBillTarget(session);
    setBillElapsed(elapsedSecs);
    setBillAmount(amount);
    setPaymentMode("cash"); // Default to cash for every new bill
    setBillOpen(true);
  };

  const confirmStopSession = async () => {
    if (!billTarget) return;
    try {
      await api.patch(`/sessions/${billTarget.id}/stop`, {
        total_amount: billAmount,
        payment_mode: paymentMode
      });
      toast.success(`Session stopped! Final bill: ₹${billAmount} (${paymentMode.toUpperCase()})`);
      setBillOpen(false);
      setBillTarget(null);
      fetchSessions();
      fetchHistory();
    } catch {
      toast.error("Failed to stop session");
    }
  };

  const formatElapsed = (startTimeStr: string) => {
    const elapsedSecs = Math.max(0, Math.floor((now.getTime() - new Date(startTimeStr).getTime()) / 1000));
    const h = Math.floor(elapsedSecs / 3600);
    const m = Math.floor((elapsedSecs % 3600) / 60);
    const s = elapsedSecs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatBillTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} minutes`;
  };

  return (
    <div className="space-y-6">
      {/* Idle Tables - Ready to Start */}
      {facilities.map(fac => {
        const count = fac.table_count || 1;
        const activeSessions = sessions.filter(s => s.turf_id === fac.id);
        const activeTableNames = activeSessions.map(s => s.name);

        return (
          <div key={fac.id}>
            <h3 className="font-heading font-semibold text-foreground mb-3">
              {fac.name} <span className="text-sm text-muted-foreground font-normal">({count} tables • ₹{fac.weekday_day_price}/hr)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
              {Array.from({ length: count }, (_, i) => i + 1).map(num => {
                const tableName = `${fac.name} #${num}`;
                const runningSession = sessions.find(s => s.name === tableName && s.turf_id === fac.id);

                if (runningSession) {
                  return (
                    <div key={num} className="rounded-xl border-2 border-green-500 bg-green-500/10 p-4 flex flex-col shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="relative">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 absolute top-0 left-0 animate-ping"></div>
                        </div>
                        <span className="text-green-400 text-[10px] uppercase tracking-wider font-bold">Live Now</span>
                      </div>
                      <h4 className="font-heading font-bold text-foreground text-sm mb-0.5">Table #{num}</h4>
                      <p className="text-[10px] text-muted-foreground mb-2 truncate" title={runningSession.customer_name}>
                        <User className="w-3 h-3 inline mr-1" />{runningSession.customer_name}
                      </p>
                      <div className="bg-background/60 rounded-md p-2 mb-3 text-center border border-border">
                        <p className="font-mono text-2xl font-bold text-foreground tracking-wider">
                          {formatElapsed(runningSession.start_time)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mb-3">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cost</span>
                        <span className="font-bold text-primary text-sm">₹{calcRunningCost(runningSession)}</span>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => openBillDialog(runningSession)} className="w-full text-xs">
                        <Square className="w-3 h-3 mr-1.5" /> Stop & Bill
                      </Button>
                    </div>
                  );
                }

                return (
                  <div key={num} className="rounded-xl border border-border bg-card p-4 flex flex-col hover:border-primary/30 transition-colors">
                    <h4 className="font-heading font-bold text-foreground text-sm mb-1">Table #{num}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Idle • Ready</p>
                    <Button size="sm" onClick={() => openStartDialog(fac, num)} className="w-full bg-gradient-turf text-primary-foreground text-xs mt-auto">
                      <Play className="w-3 h-3 mr-1.5" /> Start
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {facilities.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          No hourly-priced tables found. Add a sport with "Hourly" pricing model under Sports Events first!
        </div>
      )}

      {/* Session History Log */}
      <div className="rounded-xl bg-card border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Session History
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterSport} onValueChange={setFilterSport}>
              <SelectTrigger className="w-[120px] h-8 text-xs bg-card border-border">
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                {facilities.map(f => (
                  <SelectItem key={f.id} value={f.facility_type}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker 
              date={filterDate} 
              setDate={(d) => setFilterDate(d ? format(d, 'yyyy-MM-dd') : '')}
              className="w-[180px] h-9 text-sm"
              placeholder="Filter by date"
            />
            {(filterSport !== "all" || filterDate) && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => { setFilterSport("all"); setFilterDate(""); }}>Clear</Button>
            )}
          </div>
        </div>
        {(() => {
          const filtered = history.filter((h: any) => {
            if (filterSport !== "all" && !h.facility_name?.toLowerCase().includes(filterSport)) return false;
            if (filterDate) {
              const sessionDate = new Date(h.start_time).toISOString().split('T')[0];
              if (sessionDate !== filterDate) return false;
            }
            return true;
          });

          if (filtered.length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {history.length > 0 ? "No sessions match your filters." : "No completed sessions yet. Stop a running session to see it here!"}
              </div>
            );
          }

          return (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Table</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Customer</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Phone</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Time</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mode</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Duration</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((h: any) => {
                      const start = new Date(h.start_time);
                      const end = new Date(h.end_time);
                      const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
                      const hrs = Math.floor(durationMins / 60);
                      const mins = durationMins % 60;
                      const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

                      return (
                        <tr key={h.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground">{h.name || h.facility_name}</td>
                          <td className="py-2.5 px-3 text-foreground">{h.customer_name || '-'}</td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{h.customer_phone || '-'}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} → {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className={`text-[10px] uppercase px-1.5 h-5 ${h.payment_mode === 'upi' ? 'text-blue-400 border-blue-400/30' : 'text-amber-400 border-amber-400/30'}`}>
                              {h.payment_mode || 'cash'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-foreground font-medium">{durationStr}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-primary">₹{parseFloat(h.total_amount || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-border/50">
                {filtered.map((h: any) => {
                  const start = new Date(h.start_time);
                  const end = new Date(h.end_time);
                  const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
                  const hrs = Math.floor(durationMins / 60);
                  const mins = durationMins % 60;
                  const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

                  return (
                    <div key={h.id} className="py-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-foreground text-sm">{h.name || h.facility_name}</h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" /> {h.customer_name || 'Walk-in'}
                          </p>
                        </div>
                        <div className="text-right font-bold text-primary text-sm">
                          ₹{parseFloat(h.total_amount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground border-y border-border/40 py-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 shrink-0" />
                          {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <Clock className="w-3 h-3 shrink-0" />
                          {durationStr}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <p className="font-mono text-muted-foreground">{h.customer_phone}</p>
                        <p className="text-muted-foreground">
                          {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

      {/* Bill Settlement Dialog */}
      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Session Bill Summary</DialogTitle>
          </DialogHeader>
          {billTarget && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Table</span>
                  <span className="text-foreground font-medium">{billTarget.name || billTarget.facility_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-foreground font-medium">{billTarget.customer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="text-foreground font-medium">{billTarget.customer_phone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hourly Rate</span>
                  <span className="text-foreground font-medium">₹{getSessionRate(billTarget)}/hr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="text-foreground font-medium">{formatBillTime(billElapsed)}</span>
                </div>
                {billElapsed < 3600 && (
                  <p className="text-[10px] text-amber-500 font-semibold">⚠ Minimum 1 hour charge applied</p>
                )}
                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Payment Mode</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPaymentMode("cash")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${paymentMode === "cash"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}>
                      <Wallet className="w-4 h-4" />
                      <span className="font-semibold text-sm">Cash</span>
                    </button>
                    <button onClick={() => setPaymentMode("upi")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${paymentMode === "upi"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}>
                      <Smartphone className="w-4 h-4" />
                      <span className="font-semibold text-sm">UPI</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="font-semibold text-foreground">Total Bill</span>
                  <div className="text-right">
                    <span className="font-heading text-2xl font-bold text-primary">₹{billAmount}</span>
                    <p className="text-[10px] text-muted-foreground italic">via {paymentMode.toUpperCase()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setBillOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={confirmStopSession} className="flex-1 bg-gradient-turf text-primary-foreground shadow-turf">
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Session Dialog - Customer Info */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Start Session - {startTarget?.facility.name} #{startTarget?.tableNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Enter customer details before starting the timer. <span className="text-amber-500 font-semibold">Minimum billing: 1 hour.</span></p>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input placeholder="Enter name..." value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input placeholder="Enter phone..." type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setStartOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={confirmStartSession} className="flex-1 bg-gradient-turf text-primary-foreground shadow-turf">
              <Play className="w-4 h-4 mr-2" /> Start Timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
