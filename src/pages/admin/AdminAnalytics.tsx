import { useState, useEffect, useCallback } from "react";
import { IndianRupee, TrendingUp, Users, Calendar, Clock, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const SPORT_COLORS: Record<string, string> = {
  cricket: "hsl(142 76% 36%)",
  snooker: "hsl(84 80% 55%)",
  pool: "hsl(200 80% 50%)",
};

const tooltipStyle = {
  background: "hsl(220 18% 10%)",
  border: "1px solid hsl(220 16% 18%)",
  borderRadius: "0.5rem",
  color: "hsl(0 0% 95%)",
};

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/analytics`);
      setData(res.data);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const sportData = (data?.revenueBySport || []).map((s: any) => ({
    name: s.type.charAt(0).toUpperCase() + s.type.slice(1),
    value: s.total,
    fill: SPORT_COLORS[s.type] || "hsl(0 0% 50%)",
  }));

  const dailyTrend = (data?.dailyTrend || []).map((d: any) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Operational Insights</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time performance metrics across all facilities.</p>
        </div>
      </div>

      {!data && loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full shadow-lg"></div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse uppercase tracking-widest">Gathering insights...</p>
        </div>
      ) : !data ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border text-muted-foreground">
          Failed to load analytics data.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Revenue Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={IndianRupee} label="Today's Revenue" value={`₹${data.revenue.today.toLocaleString()}`} sub={`Online: ₹${data.revenue.onlineToday.toLocaleString()} • Walk-in: ₹${data.revenue.walkInToday.toLocaleString()}`} color="text-emerald-500" bg="bg-emerald-500/10" />
        <StatCard icon={TrendingUp} label="This Week" value={`₹${data.revenue.week.toLocaleString()}`} sub={`${data.counts.totalBookings + data.counts.totalSessions} total transactions`} color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard icon={Calendar} label="This Month" value={`₹${data.revenue.month.toLocaleString()}`} sub={`Across all sports & tables`} color="text-purple-500" bg="bg-purple-500/10" />
        <StatCard icon={Activity} label="Utilization Rate" value={`${data.utilization.rate}%`} sub={`${data.utilization.booked}/${data.utilization.total} slots booked this week`} color="text-amber-500" bg="bg-amber-500/10" />
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard label="Today Bookings" value={data.counts.todayBookings} />
        <MiniCard label="Today Sessions" value={data.counts.todaySessions} />
        <MiniCard label="Total Bookings" value={data.counts.totalBookings} />
        <MiniCard label="Total Sessions" value={data.counts.totalSessions} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Daily Revenue Trend */}
        <div className="lg:col-span-2 rounded-xl bg-card border border-border p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Revenue Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyTrend}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`₹${value.toLocaleString()}`]} />
              <Legend />
              <Bar dataKey="online" name="Online Bookings" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="walkIn" name="Walk-in Sessions" fill="hsl(200 80% 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Sport */}
        <div className="rounded-xl bg-card border border-border p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Revenue by Sport</h3>
          {sportData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sportData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                    {sportData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`₹${value.toLocaleString()}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                {sportData.map((s: any) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: s.fill }}></div>
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">₹{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Peak Hours */}
      {data.peakHours.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4">Peak Booking Hours (This Month)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.peakHours}>
              <defs>
                <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="bookings" stroke="hsl(142 76% 36%)" strokeWidth={2} fill="url(#colorPeak)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom Row: Top Customers + Session History */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <div className="rounded-xl bg-card border border-border p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Top Customers
          </h3>
          {data.topCustomers.length > 0 ? (
            <div className="space-y-2">
              {data.topCustomers.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-muted/30 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.phone} • {c.visits} visit{c.visits > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <span className="font-bold text-primary text-sm">₹{c.spent.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">No customer data yet. Start tracking table sessions!</div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="rounded-xl bg-card border border-border p-5">
          <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Recent Activities
          </h3>
          {data.sessionHistory.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {data.sessionHistory.map((s: any) => {
                const isBooking = s.type === 'booking';
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                const durationMins = isBooking ? 60 : Math.round((end.getTime() - start.getTime()) / 60000); // Bookings usually 1h
                const h = Math.floor(durationMins / 60);
                const m = durationMins % 60;
                const durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

                return (
                  <div key={`${s.type}-${s.id}`} className="bg-muted/30 px-3 py-2.5 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBooking ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                           {isBooking ? <Calendar className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.facility}</p>
                          <p className="text-[10px] text-muted-foreground">{s.customer} • {s.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-primary text-sm">₹{s.amount.toLocaleString()}</span>
                        {isBooking && <Badge variant="outline" className="block text-[8px] mt-0.5 px-1 py-0 h-3 leading-none opacity-70">ONLINE</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                      <span className="font-mono">{start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      <span>{start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} → {end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-foreground font-medium">{isBooking ? 'Slot' : durationStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">No recent activities available.</div>
          )}
        </div>
      </div>
    </div>
  )}
</div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bg }: { icon: any; label: string; value: string; sub: string; color: string; bg: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className="font-heading font-bold text-2xl text-foreground mb-1">{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-card border border-border px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="font-heading font-bold text-lg text-foreground">{value}</span>
    </div>
  );
}
