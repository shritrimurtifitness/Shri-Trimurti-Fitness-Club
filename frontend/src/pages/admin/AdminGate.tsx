import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DoorClosed,
  DoorOpen,
  Zap,
  Clock,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Activity,
  Sliders,
  Filter,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface GateConfig {
  secretKey: string;
  earlyArrivalMinutes: number;
  unlockDurationSeconds: number;
}

interface GateLog {
  id: number;
  booking_id: string | null;
  customer_name: string;
  turf_name: string;
  status: string;
  reason: string;
  gate_id: string;
  scanned_at: string;
}

export default function AdminGate() {
  const [config, setConfig] = useState<GateConfig>({
    secretKey: "trimurti_gate_secret_2026",
    earlyArrivalMinutes: 15,
    unlockDurationSeconds: 10,
  });
  const [logs, setLogs] = useState<GateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockDuration, setUnlockDuration] = useState<number>(10);
  const [activeCountdown, setActiveCountdown] = useState<number>(0);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial configuration & logs
  const fetchGateData = async () => {
    try {
      setLoading(true);
      const [configRes, logsRes] = await Promise.all([
        api.get("/gate/config"),
        api.get("/gate/logs?limit=50"),
      ]);

      if (configRes.data.success && configRes.data.config) {
        setConfig(configRes.data.config);
        setUnlockDuration(configRes.data.config.unlockDurationSeconds || 10);
      }

      if (logsRes.data.success && Array.isArray(logsRes.data.logs)) {
        setLogs(logsRes.data.logs);
      }
    } catch (err: any) {
      console.error("Failed to load gate data:", err);
      toast.error(err.response?.data?.error || "Failed to load smart gate data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateData();
  }, []);

  // Listen for Realtime Socket.IO Gate Events
  useSocket("gate_scan_event", (eventData: any) => {
    if (!eventData) return;

    // Prepend new scan event to live logs
    const newLog: GateLog = {
      id: Date.now(),
      booking_id: eventData.bookingId || null,
      customer_name: eventData.customerName || "Unknown Player",
      turf_name: eventData.turfName || "Turf",
      status: eventData.status || "granted",
      reason: eventData.status === "re_entry" ? "RE_ENTRY_SUCCESS" : "SCAN_SUCCESS",
      gate_id: eventData.gateId || "main_gate",
      scanned_at: eventData.timestamp || new Date().toISOString(),
    };

    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);

    if (eventData.status === "granted" || eventData.status === "re_entry") {
      toast.success(
        `🚪 Gate Unlocked: ${eventData.customerName} entered ${eventData.turfName}`
      );
    } else {
      toast.warning(
        `⚠️ Gate Denied: ${eventData.customerName} (${eventData.reason || "Invalid"})`
      );
    }
  });

  useSocket("gate_manual_unlock", (data: any) => {
    if (!data) return;
    const duration = data.durationSeconds || 10;
    startCountdown(duration);
    toast.info(`⚡ Gate manually unlocked by ${data.triggeredBy || "Staff"} for ${duration}s`);
  });

  // Countdown timer helper
  const startCountdown = (durationSec: number) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setActiveCountdown(durationSec);

    countdownTimerRef.current = setInterval(() => {
      setActiveCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Handle Remote Buzz-in
  const handleRemoteUnlock = async () => {
    try {
      setUnlocking(true);
      const res = await api.post("/gate/manual-unlock", {
        durationSeconds: unlockDuration,
        reason: "Admin Dashboard Remote Override",
        gateId: "main_gate",
      });

      if (res.data.success) {
        startCountdown(unlockDuration);
        toast.success(res.data.message || `Gate unlocked for ${unlockDuration} seconds!`);
        // Refresh logs after brief delay
        setTimeout(fetchGateData, 1000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to trigger remote unlock");
    } finally {
      setUnlocking(false);
    }
  };

  // Handle Saving Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await api.put("/gate/config", {
        earlyArrivalMinutes: Number(config.earlyArrivalMinutes),
        unlockDurationSeconds: Number(config.unlockDurationSeconds),
        secretKey: config.secretKey,
      });

      if (res.data.success) {
        setConfig(res.data.config);
        toast.success("Gate timing and settings updated successfully!");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update gate settings");
    } finally {
      setSavingConfig(false);
    }
  };

  // Copy Secret Key
  const handleCopyKey = () => {
    navigator.clipboard.writeText(config.secretKey);
    setCopiedKey(true);
    toast.success("Gate Secret Key copied to clipboard!");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "granted") return log.status === "granted" || log.status === "re_entry";
    if (filterStatus === "denied") return log.status === "denied";
    if (filterStatus === "manual") return log.status === "manual_override";
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "granted":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> GRANTED
          </Badge>
        );
      case "re_entry":
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" /> RE-ENTRY
          </Badge>
        );
      case "manual_override":
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1 font-semibold">
            <Zap className="w-3.5 h-3.5" /> REMOTE BUZZ
          </Badge>
        );
      case "denied":
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 flex items-center gap-1 font-semibold">
            <XCircle className="w-3.5 h-3.5" /> DENIED
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-card via-card to-card/70 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <DoorClosed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Smart Gate Access Hub
              </h1>
              <p className="text-sm text-muted-foreground">
                Control automated turnstiles, tune early check-in buffers, and monitor live scans.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Gateway Online
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGateData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Hero Remote Gate Unlock Card */}
      <Card className="border-primary/20 shadow-sm relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wide uppercase">
                <Zap className="w-4 h-4" /> Quick Remote Gate Override
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Buzz Open Entrance Gate Remotely
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Need to let in a player with a flat phone battery or manual pass? Tap below to release
                the 12V electromagnetic lock from anywhere in the arena.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Pulse Duration Selector */}
              <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl border border-border">
                {[5, 10, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setUnlockDuration(sec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      unlockDuration === sec
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              {/* Unlock Action Button */}
              <Button
                size="lg"
                onClick={handleRemoteUnlock}
                disabled={unlocking || activeCountdown > 0}
                className={`font-bold transition-all px-6 shadow-md ${
                  activeCountdown > 0
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white animate-pulse"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {activeCountdown > 0 ? (
                  <span className="flex items-center gap-2">
                    <DoorOpen className="w-5 h-5" /> Gate Open ({activeCountdown}s)
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="w-5 h-5" /> Buzz Gate Open Now
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Active Countdown Indicator */}
          <AnimatePresence>
            {activeCountdown > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  EM Lock Power Cut: Gate is unlocked for player walk-through.
                </div>
                <div>Auto-locking in {activeCountdown}s</div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Grid: Timing & Hardware Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Gate Timing Rules */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Entry Timing & Check-In Rules</CardTitle>
            </div>
            <CardDescription>
              Configure how early players can enter and lock release duration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="earlyArrival" className="text-sm font-semibold">
                    Early Arrival Buffer
                  </Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                    {config.earlyArrivalMinutes} mins before slot
                  </span>
                </div>
                <Input
                  id="earlyArrival"
                  type="number"
                  min={0}
                  max={60}
                  value={config.earlyArrivalMinutes}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      earlyArrivalMinutes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Example: If set to 15 mins, a 6:00 PM booking can be scanned starting at 5:45 PM.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="unlockDuration" className="text-sm font-semibold">
                    Gate Unlock Pulse Duration
                  </Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                    {config.unlockDurationSeconds} seconds
                  </span>
                </div>
                <Input
                  id="unlockDuration"
                  type="number"
                  min={3}
                  max={60}
                  value={config.unlockDurationSeconds}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      unlockDurationSeconds: parseInt(e.target.value, 10) || 10,
                    })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  How long the lock cuts power after a valid scan to let the team enter.
                </p>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={savingConfig} className="w-full">
                  {savingConfig ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving Changes...
                    </span>
                  ) : (
                    "Save Timing Changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Card 2: Hardware Gateway Credentials */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Key className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Hardware Authentication</CardTitle>
            </div>
            <CardDescription>
              Security credentials to paste into the ESP32 gate controller code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Gate Secret Key (X-Gate-Key)</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={config.secretKey}
                    onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyKey}
                  className="shrink-0 flex items-center gap-1.5"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Matches the <code className="font-mono">GATE_SECRET</code> constant in the ESP32 C++ firmware.
              </p>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Hardware Gateway ID:</span>
                <span className="font-mono font-semibold text-foreground">main_gate</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Verification Endpoint:</span>
                <span className="font-mono text-foreground font-semibold">/api/gate/scan</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Re-Entry Support:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active (Unlimited in slot)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                All scan attempts are cryptographically validated against slot reservations and bank payment status in real-time.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Gate Access Logs Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Real-Time Gate Scan Logs</CardTitle>
            </div>
            <CardDescription>
              Live activity stream of QR scans and access decisions at the gate.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] text-xs h-9">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="granted">Granted Only</SelectItem>
                <SelectItem value="denied">Denied Only</SelectItem>
                <SelectItem value="manual">Manual Overrides</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/60 text-muted-foreground border-y border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                  <th className="px-6 py-3 font-semibold">Player Name</th>
                  <th className="px-6 py-3 font-semibold">Facility / Turf</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Result / Reason</th>
                  <th className="px-6 py-3 font-semibold text-right">Gate ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      <DoorClosed className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No gate scan logs found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const formattedDate = log.scanned_at
                      ? format(new Date(log.scanned_at), "dd MMM, hh:mm:ss a")
                      : "N/A";

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-foreground whitespace-nowrap">
                          {log.customer_name || "Unknown"}
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                          {log.turf_name || "N/A"}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {log.reason || "N/A"}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {log.gate_id || "main_gate"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
