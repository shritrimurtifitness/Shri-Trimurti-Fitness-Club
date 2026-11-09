import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Users, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Copy, 
  Check, 
  X, 
  XCircle, 
  ShieldCheck, 
  AlertCircle,
  Loader2,
  Mail,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import { format } from "date-fns";
import { Tournament } from "./AdminTournaments";
import { io, Socket } from "socket.io-client";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface Registration {
  id: string;
  tournament_id: string;
  team_name: string;
  captain_name: string;
  phone: string;
  email: string | null;
  payment_status: string;
  utr_number: string | null;
  payment_mode: string | null;
  rejection_reason: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
}

export default function AdminTournamentRegistrations({ tournament, onBack }: { tournament: Tournament, onBack: () => void }) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "rejected">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject dialog state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingReg, setRejectingReg] = useState<Registration | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchRegistrations = async () => {
    try {
      const res = await api.get(`/tournaments/${tournament.id}/registrations`);
      setRegistrations(res.data);
    } catch {
      toast.error("Failed to load registrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();

    // Listen for real-time registration updates
    const socket: Socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000");
    socket.on("tournament_registration_success", () => {
      fetchRegistrations();
    });

    return () => {
      socket.disconnect();
    };
  }, [tournament.id]);

  const paidCount = registrations.filter(r => r.payment_status === 'paid' || r.payment_status === 'completed').length;
  const pendingCount = registrations.filter(r => r.payment_status === 'pending_verification' || r.payment_status === 'pending').length;
  const rejectedCount = registrations.filter(r => r.payment_status === 'rejected').length;

  const handleVerifyUpi = async (regId: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(regId);
    try {
      await api.post(`/tournaments/registrations/${regId}/verify-upi`, {
        action,
        rejection_reason: reason
      });
      toast.success(action === 'approve' ? "Registration approved & match pass emailed to captain!" : "Registration rejected & captain notified via email");
      fetchRegistrations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update registration status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReject = (reg: Registration) => {
    setRejectingReg(reg);
    setRejectReason("UTR not matching received bank transaction");
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectingReg) return;
    handleVerifyUpi(rejectingReg.id, 'reject', rejectReason);
    setRejectModalOpen(false);
    setRejectingReg(null);
  };

  const handleDeleteRegistration = (regId: string, teamName: string) => {
    toast(`Remove team ${teamName}?`, {
      description: "This will permanently delete their registration record.",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/tournaments/registrations/${regId}`);
            toast.success("Team registration removed");
            fetchRegistrations();
          } catch {
            toast.error("Failed to remove team");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const filteredRegistrations = registrations.filter(r => {
    if (filter === "pending") return r.payment_status === 'pending_verification' || r.payment_status === 'pending';
    if (filter === "paid") return r.payment_status === 'paid' || r.payment_status === 'completed';
    if (filter === "rejected") return r.payment_status === 'rejected';
    return true;
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> {tournament.name} Registrations
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>
                Confirmed Teams: <strong className="text-foreground">{paidCount}</strong> / {tournament.max_teams}
              </span>
              <span>•</span>
              <span>Entry Fee: <strong className="text-emerald-400">₹{tournament.entry_fee}</strong></span>
              {pendingCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {pendingCount} Pending Verification
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl self-start sm:self-auto overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({registrations.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              filter === "pending" 
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Verify UPI {pendingCount > 0 && <span className="bg-amber-500 text-black px-1.5 py-0.2 rounded-full text-[10px] font-bold">{pendingCount}</span>}
          </button>
          <button
            onClick={() => setFilter("paid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "paid" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Confirmed ({paidCount})
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "rejected" ? "bg-destructive/20 text-destructive border border-destructive/30 shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading registrations...
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No registrations match this filter.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold">
                  <tr>
                    <th className="px-6 py-4">Registration Date</th>
                    <th className="px-6 py-4">Team Name</th>
                    <th className="px-6 py-4">Captain</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Bank UTR / Ref</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Verification & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistrations.map((r) => {
                    const isPending = r.payment_status === 'pending_verification' || r.payment_status === 'pending';
                    const isPaid = r.payment_status === 'paid' || r.payment_status === 'completed';
                    const isRejected = r.payment_status === 'rejected';

                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                          {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-base text-foreground block">{r.team_name}</span>
                          {/* <span className="text-[11px] text-muted-foreground font-mono">0% Fee Direct UPI</span> */}
                        </td>
                        <td className="px-6 py-4 text-foreground font-medium">{r.captain_name}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-foreground font-medium text-xs">{r.phone}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const text = `Hi ${r.captain_name}! Regarding your team registration for *${tournament.name}* (Team: *${r.team_name}*) at Shri Trimurti Sports Arena Akola...`;
                                window.open(getWhatsAppUrl(text, r.phone), '_blank');
                              }}
                              className="p-1 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title="Chat with Captain on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {r.email && (
                            <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[170px]" title={r.email}>
                              {r.email}
                            </div>
                          )}
                        </td>
                        
                        {/* UTR / Ref column */}
                        <td className="px-6 py-4">
                          {r.utr_number ? (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(r.utr_number!);
                                toast.success(`Copied UTR: ${r.utr_number}`);
                              }}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-muted/60 hover:bg-primary/10 hover:text-primary px-2.5 py-1 rounded-lg border border-border transition-colors text-foreground group"
                              title="Click to copy UTR"
                            >
                              <span>{r.utr_number}</span>
                              <Copy className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs font-mono">
                              {r.razorpay_payment_id || r.razorpay_order_id || "-"}
                            </span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="px-6 py-4">
                          {isPaid ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMED
                            </div>
                          ) : isPending ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full w-fit border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5 animate-pulse" /> VERIFY UPI
                            </div>
                          ) : isRejected ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full w-fit border border-destructive/20" title={r.rejection_reason || undefined}>
                              <XCircle className="w-3.5 h-3.5" /> REJECTED
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full w-fit">
                              {r.payment_status.toUpperCase()}
                            </div>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={processingId === r.id}
                                  onClick={() => handleVerifyUpi(r.id, 'approve')}
                                  className="h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                                >
                                  {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={processingId === r.id}
                                  onClick={() => handleOpenReject(r)}
                                  className="h-8 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 border-destructive/30"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                              onClick={() => handleDeleteRegistration(r.id, r.team_name)}
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="flex flex-col gap-4 p-4 md:hidden">
              {filteredRegistrations.map((r) => {
                const isPending = r.payment_status === 'pending_verification' || r.payment_status === 'pending';
                const isPaid = r.payment_status === 'paid' || r.payment_status === 'completed';
                const isRejected = r.payment_status === 'rejected';

                return (
                  <div key={r.id} className="border border-border bg-card rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-base text-foreground line-clamp-1">{r.team_name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
                        </div>
                      </div>

                      {isPaid ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                          <Clock className="w-3 h-3" /> Verify UPI
                        </div>
                      ) : isRejected ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 uppercase">
                          <XCircle className="w-3 h-3" /> Rejected
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 bg-muted/30 border border-border/60 p-3 rounded-lg text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Captain</span> 
                        <span className="font-medium text-foreground">{r.captain_name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Phone</span> 
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{r.phone}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const text = `Hi ${r.captain_name}! Regarding your team registration for *${tournament.name}* (Team: *${r.team_name}*) at Shri Trimurti Sports Arena Akola...`;
                              window.open(getWhatsAppUrl(text, r.phone), '_blank');
                            }}
                            className="p-1 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {r.email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</span> 
                          <span className="font-mono text-emerald-400 truncate max-w-[170px]">{r.email}</span>
                        </div>
                      )}
                      {r.utr_number && (
                        <div className="flex justify-between items-center pt-1 border-t border-border/50">
                          <span className="text-muted-foreground font-semibold">Bank UTR</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(r.utr_number!);
                              toast.success(`Copied UTR: ${r.utr_number}`);
                            }}
                            className="inline-flex items-center gap-1 font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]"
                          >
                            <span>{r.utr_number}</span>
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick Verification Buttons on Mobile */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      {isPending ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Button
                            size="sm"
                            disabled={processingId === r.id}
                            onClick={() => handleVerifyUpi(r.id, 'approve')}
                            className="flex-1 h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                          >
                            {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === r.id}
                            onClick={() => handleOpenReject(r)}
                            className="h-8 px-3 text-xs font-semibold text-destructive border-destructive/30"
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">
                          {isPaid ? "Entry confirmed" : isRejected ? (r.rejection_reason || "Payment rejected") : ""}
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" 
                        onClick={() => handleDeleteRegistration(r.id, r.team_name)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" /> Reject Tournament Registration
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the registration for <strong>{rejectingReg?.team_name}</strong>? Their reserved slot will be released.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for Rejection</label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR not found in bank statement"
              className="bg-background text-sm"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
