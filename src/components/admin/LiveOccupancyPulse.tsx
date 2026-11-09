import { useState, useEffect } from "react";
import { Activity, Clock, User, AlertCircle, CircleDot, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { formatTime12Hour } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";

interface Resource {
  id: string;
  turfId: string;
  name: string;
  facilityType: string;
  tableNumber: number | null;
  status: "available" | "in_use" | "booked_soon";
  currentBooking: {
    id: string;
    customerName: string;
    startTime?: string;
    endTime?: string;
    type: "booking" | "session";
  } | null;
}

export function LiveOccupancyPulse() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchPulse = async () => {
    try {
      const { data } = await api.get("/admin/live-pulse");
      setResources(data);
    } catch (err) {
      console.error("Failed to fetch live pulse:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPulse();
    const interval = setInterval(fetchPulse, 30000);
    return () => clearInterval(interval);
  }, []);

  useSocket('facility_updated', fetchPulse);
  useSocket('booking_updated', fetchPulse);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-sm text-muted-foreground animate-pulse">Initializing Arena Sensors...</p>
      </div>
    );
  }

  // Count active stats
  const inUse = resources.filter((r) => r.status === "in_use").length;
  const bookedSoon = resources.filter((r) => r.status === "booked_soon").length;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-secondary/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="w-5 h-5 text-primary" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse hidden sm:block delay-75"></span>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              Live Occupancy Pulse
              <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 sm:hidden">
                LIVE
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Real-time physical state of the arena
            </p>
          </div>
          <div className="sm:hidden text-muted-foreground ml-auto">
             {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto">
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5 opacity-80">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available
            </span>
            <span className="flex items-center gap-1.5 opacity-80">
               <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span> In Use ({inUse})
            </span>
            <span className="flex items-center gap-1.5 opacity-80">
               <span className="w-2 h-2 rounded-full bg-amber-500"></span> Booked Soon ({bookedSoon})
            </span>
            <div className="hidden sm:block text-muted-foreground ml-2">
               {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {resources.map((res, i) => {
            const isTurf = ["cricket", "football"].includes(res.facilityType.toLowerCase());
            
            // Determine styles based on status
            const styles = {
              available: {
                bg: "bg-emerald-500/5",
                border: "border-emerald-500/20",
                text: "text-emerald-500",
                dot: "bg-emerald-500",
                shadow: "",
              },
              in_use: {
                bg: "bg-destructive/10",
                border: "border-destructive/30",
                text: "text-destructive",
                dot: "bg-destructive",
                shadow: "shadow-[0_0_15px_rgba(239,68,68,0.1)]",
              },
              booked_soon: {
                bg: "bg-amber-500/10",
                border: "border-amber-500/30",
                text: "text-amber-500",
                dot: "bg-amber-500",
                shadow: "shadow-[0_0_15px_rgba(245,158,11,0.1)]",
              },
            }[res.status];

            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`relative rounded-xl border p-4 flex flex-col justify-between min-h-[120px] transition-all duration-300 ${styles.bg} ${styles.border} ${styles.shadow}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <h4 className="font-heading font-bold text-foreground text-sm tracking-tight">{res.name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">
                      {isTurf ? "Turf Area" : "Table Sports"}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-background border border-border/50 shadow-sm ${styles.text}`}>
                    <CircleDot className={`w-3 h-3 ${res.status === "in_use" ? "animate-pulse" : ""}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{res.status.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="mt-auto">
                  {res.status === "available" ? (
                    <div className="flex items-center gap-2 text-muted-foreground opacity-60">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium">Ready for walk-ins</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 bg-background/60 rounded-lg p-2.5 border border-border/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-background border border-border`}>
                          <User className={`w-3.5 h-3.5 ${styles.text}`} />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                          {res.currentBooking?.customerName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 bg-background px-2 py-1 rounded text-[10px] font-bold">
                        <Clock className={`w-3 h-3 ${styles.text}`} />
                        <span className="text-foreground">
                          {res.status === "in_use" ? `Till ${res.currentBooking?.endTime ? formatTime12Hour(res.currentBooking.endTime) : 'open'}` : `At ${res.currentBooking?.startTime ? formatTime12Hour(res.currentBooking.startTime) : ''}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {resources.length === 0 && (
            <div className="col-span-full py-8 text-center flex flex-col items-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">No resources configured.</p>
            </div>
          )}
        </div>
      </div>
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
