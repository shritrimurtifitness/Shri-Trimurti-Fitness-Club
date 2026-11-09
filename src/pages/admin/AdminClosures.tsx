import { useState, useEffect } from "react";
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Calendar as CalendarIcon,
  Search,
  Loader2,
  Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import { format } from "date-fns";

interface Closure {
  id: number;
  date: string;
  reason: string;
  turf_id: string | null;
}

export default function AdminClosures() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newClosure, setNewClosure] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    reason: ""
  });

  const fetchClosures = async () => {
    try {
      const res = await api.get('/admin/closures');
      setClosures(res.data);
    } catch (err) {
      toast.error("Failed to fetch closures");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  const handleAddClosure = async () => {
    if (!newClosure.date) return toast.error("Date is required");
    
    setLoading(true);
    try {
      await api.post('/admin/closures', newClosure);
      toast.success("Arena closed for " + newClosure.date);
      setIsAdding(false);
      setNewClosure({ date: format(new Date(), "yyyy-MM-dd"), reason: "" });
      fetchClosures();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add closure");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to re-open the arena for this date?")) return;
    
    try {
      await api.delete(`/admin/closures/${id}`);
      toast.success("Arena re-opened!");
      fetchClosures();
    } catch (err) {
      toast.error("Failed to remove closure");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-3">
            <Lock className="w-8 h-8 text-primary" /> Dynamic Closures
          </h1>
          <p className="text-muted-foreground mt-1">Block specific dates for maintenance, holidays, or private events.</p>
        </div>

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-turf text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2">
              <Plus className="w-4 h-4" /> Schedule New Closure
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Close Arena</DialogTitle>
              <CardDescription>Selecting a date will instantly remove all available slots and block new bookings.</CardDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Date</label>
                <Input 
                  type="date" 
                  value={newClosure.date}
                  onChange={(e) => setNewClosure({ ...newClosure, date: e.target.value })}
                  className="bg-background border-border h-12"
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason (Visible to Customers)</label>
                <Input 
                  placeholder="e.g. Annual Maintenance, Monsoon Break" 
                  value={newClosure.reason}
                  onChange={(e) => setNewClosure({ ...newClosure, reason: e.target.value })}
                  className="bg-background border-border h-12"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button 
                onClick={handleAddClosure} 
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                Confirm Closure
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/30 border-border/50">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" /> Scheduled Closures
                </CardTitle>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {closures.length} active entries
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary/40" />
                </div>
              ) : closures.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {closures.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex flex-col items-center justify-center border border-destructive/20 text-destructive">
                          <span className="text-[10px] font-black uppercase leading-none">{format(new Date(c.date), "MMM")}</span>
                          <span className="text-xl font-black leading-none">{format(new Date(c.date), "dd")}</span>
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{format(new Date(c.date), "EEEE, do MMMM yyyy")}</p>
                          <p className="text-xs text-muted-foreground italic">"{c.reason}"</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground/30">
                    <CalendarIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">No upcoming closures</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">All turfs are currently open for booking according to their standard schedules.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20 sticky top-24">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" /> Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs space-y-3 text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">Online Blocking:</strong> Setting a closure instantly removes that date from the customer booking page.
                </p>
                <p>
                  <strong className="text-foreground">Offline Manual:</strong> Staff will also be blocked from creating manual "Green" bookings on these dates to prevent accidental overbooking.
                </p>
                <p>
                  <strong className="text-foreground">Re-opening:</strong> Deleting a closure will restore the normal slot generation logic for that date immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
