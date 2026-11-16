import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Sparkles, Send, Clock, Calendar, CheckCircle2, AlertTriangle, RefreshCw, MessageSquare, ExternalLink, ShieldCheck } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

interface RetentionLog {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total_past_matches: number;
  preferred_day_of_week: number;
  preferred_time: string;
  target_date: string;
  slot_status: "open" | "alternative" | "general";
  generated_message: string;
  status: "drafted" | "sent" | "converted" | "snoozed";
  turf_name?: string;
  created_at: string;
  dispatched_at?: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminRetention() {
  const [logs, setLogs] = useState<RetentionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/retention/logs?limit=100");
      if (res.data.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err: any) {
      toast.error("Failed to load retention records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useSocket("retention_updated", fetchLogs);

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      const res = await api.post("/retention/churn-analysis");
      if (res.data.success) {
        toast.success(`Analysis complete! Found ${res.data.count} at-risk regular teams.`);
        fetchLogs();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error running churn analysis");
    } finally {
      setAnalyzing(false);
    }
  };

  const snoozePlayer = async (id: string) => {
    try {
      await api.post(`/retention/logs/${id}/snooze`, { days: 14 });
      toast.success("Player outreach snoozed for 14 days");
      fetchLogs();
    } catch (err) {
      toast.error("Failed to snooze outreach");
    }
  };

  const dispatchDirectly = async (id: string) => {
    try {
      await api.post(`/retention/logs/${id}/dispatch`);
      toast.success("WhatsApp re-engagement message sent to captain!");
      fetchLogs();
    } catch (err: any) {
      toast.error("Failed to send WhatsApp message");
    }
  };

  const markSent = async (id: string) => {
    try {
      await api.post(`/retention/logs/${id}/mark-sent`);
      toast.success("Marked as sent");
      fetchLogs();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === "all") return true;
    return log.status === filterStatus;
  });

  const atRiskCount = logs.filter((l) => l.status === "drafted").length;
  const sentCount = logs.filter((l) => l.status === "sent").length;
  const convertedCount = logs.filter((l) => l.status === "converted").length;

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Squad Retention & Churn Predictor</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3" />
              <span>AI & SQL Powered</span>
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Detects regular teams inactive for 10–14 days, checks upcoming weekend slot availability, and generates 1-tap WhatsApp invites.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={runAnalysis}
            disabled={analyzing}
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md text-xs sm:text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`} />
            <span>{analyzing ? "Analyzing Database..." : "Run Live Churn Check"}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>At-Risk Regular Squads</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-500">{atRiskCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Teams inactive for 10+ days without upcoming bookings</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              <span>Outreach Dispatched</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-500">{sentCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Invites sent via WhatsApp for upcoming weekend</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Recovered & Converted</span>
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-500">{convertedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Captains who replied & re-booked their weekend slot</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Scheduled Cron Trigger</span>
            </CardDescription>
            <CardTitle className="text-lg font-bold text-foreground">Every Thursday</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">11:00 AM IST via cron-job.org webhook</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs - horizontally scrollable on mobile without causing page overflow */}
      <div className="w-full overflow-x-auto no-scrollbar scrollbar-none pb-1">
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-border/40 pb-2 w-max min-w-full">
          <Button
            size="sm"
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => setFilterStatus("all")}
            className="text-xs h-7 shrink-0 whitespace-nowrap"
          >
            All ({logs.length})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === "drafted" ? "default" : "outline"}
            onClick={() => setFilterStatus("drafted")}
            className="text-xs h-7 shrink-0 whitespace-nowrap"
          >
            Needs Outreach ({atRiskCount})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === "sent" ? "default" : "outline"}
            onClick={() => setFilterStatus("sent")}
            className="text-xs h-7 shrink-0 whitespace-nowrap"
          >
            Sent ({sentCount})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === "converted" ? "default" : "outline"}
            onClick={() => setFilterStatus("converted")}
            className="text-xs h-7 text-emerald-500 shrink-0 whitespace-nowrap"
          >
            Converted ({convertedCount})
          </Button>
        </div>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="py-12 flex justify-center items-center text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span>Loading retention records...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-dashed border-border/60 py-12 text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">No At-Risk Teams Found!</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Your regular teams are either actively playing or have already been contacted. Tap "Run Live Churn Check" to refresh.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLogs.map((log) => {
            const dayName = DAYS[log.preferred_day_of_week] || "Weekend";
            const encodedMsg = encodeURIComponent(log.generated_message);
            const waWebUrl = `https://wa.me/91${log.customer_phone}?text=${encodedMsg}`;

            return (
              <Card key={log.id} className="border-border/60 overflow-hidden bg-card/40">
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Customer Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-base">{log.customer_name}</span>
                      <span className="text-xs font-mono text-muted-foreground">(+91 {log.customer_phone})</span>
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {log.total_past_matches} matches played
                      </Badge>
                      {log.slot_status === "open" ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold">
                          🟢 Usual Slot Open
                        </Badge>
                      ) : log.slot_status === "alternative" ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold">
                          🟡 Alternate Slot Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border font-medium">
                          ⚪ General Re-engagement
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-bold ${
                          log.status === "converted"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : log.status === "sent"
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            : log.status === "snoozed"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}
                      >
                        {log.status === "drafted" ? "Needs Outreach" : log.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>Usual Routine: <strong>{dayName} around {log.preferred_time?.substring(0, 5)}</strong></span>
                      {log.turf_name && <span>• Facility: <strong>{log.turf_name}</strong></span>}
                      {log.target_date && <span>• Target: <strong>{log.target_date}</strong></span>}
                    </div>

                    {/* AI Message Preview */}
                    <div className="mt-2.5 bg-muted/40 rounded-lg p-3 border border-border/40 text-xs font-sans text-foreground/90 whitespace-pre-wrap break-words overflow-hidden">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary mb-1 uppercase tracking-wide">
                        <MessageSquare className="w-3 h-3" />
                        <span>Personalized WhatsApp Draft</span>
                      </div>
                      {log.generated_message}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex md:flex-col items-center gap-2 shrink-0">
                    <a
                      href={waWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(log.id)}
                      className="w-full"
                    >
                      <Button size="sm" className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                        <Send className="w-3.5 h-3.5" />
                        <span>1-Tap WhatsApp Invite</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </Button>
                    </a>

                    <div className="flex items-center gap-2 w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dispatchDirectly(log.id)}
                        className="text-xs h-8 flex-1"
                        title="Send directly from WhatsApp Business Bot"
                      >
                        Send via Bot
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => snoozePlayer(log.id)}
                        className="text-xs h-8 text-muted-foreground hover:text-foreground"
                        title="Snooze for 14 days"
                      >
                        Snooze
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
