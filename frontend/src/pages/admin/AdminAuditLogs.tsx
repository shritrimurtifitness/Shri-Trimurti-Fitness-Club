import { useState, useEffect } from "react";
import { Shield, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
  admin_name: string | null;
}

const actionColors: Record<string, string> = {
  login: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  logout: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  create: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  delete: "bg-red-500/10 text-red-500 border-red-500/20",
  reset: "bg-red-500/10 text-red-500 border-red-500/20",
};

function getActionColor(action: string): string {
  const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
  return key ? actionColors[key] : "bg-muted text-muted-foreground border-border";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/audit-logs?page=${p}&limit=30`);
      setLogs(res.data.logs);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      setPage(p);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" /> Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            Track all administrative actions performed on this platform.
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          {total} total entries
        </Badge>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-2xl border border-border">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          Loading audit logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-lg font-bold text-foreground mb-1">No Logs Yet</p>
          <p className="text-muted-foreground text-sm">Administrative actions will appear here.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 font-semibold text-muted-foreground">Timestamp</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Admin</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Action</th>
                  <th className="text-left p-4 font-semibold text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-4 text-muted-foreground text-xs font-mono whitespace-nowrap">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="p-4 font-medium text-foreground whitespace-nowrap">
                      {log.admin_name || "System"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs max-w-md truncate">
                      {log.details || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTimestamp(log.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{log.admin_name || "System"}</p>
                {log.details && (
                  <p className="text-xs text-muted-foreground">{log.details}</p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
