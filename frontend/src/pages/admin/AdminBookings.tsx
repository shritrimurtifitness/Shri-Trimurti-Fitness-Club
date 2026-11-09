import { useState, useEffect } from "react";
import { getFacilityLabel } from "@/lib/mock-data";
import api from "@/lib/api";
import { DatePicker } from "@/components/ui/date-picker";
import { useSocket } from "@/hooks/useSocket";
import { format, parse, isAfter, isSameDay, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, XCircle, Plus, CheckCircle2, IndianRupee, Smartphone, Wallet, Banknote, ArrowUp, ArrowDown, Filter, User, Calendar, Check, Copy, AlertCircle, Clock, MessageSquare } from "lucide-react";
import { formatTime12Hour } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import AdminWhatsAppModal from "@/components/AdminWhatsAppModal";

export default function AdminBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [whatsAppBooking, setWhatsAppBooking] = useState<any | null>(null);
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  
  // Advanced Filters
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'needs_review' | 'paid' | 'pending'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount' | 'customer'; direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' });

  useEffect(() => {
    api.get('/facilities').then(res => {
      const active = res.data.filter((f: any) => f.is_active !== false);
      const types = [...new Set(active.map((f: any) => f.facility_type))] as string[];
      setFacilityTypes(types);
      if (types.length > 0 && !types.includes(bFacility)) {
        setBFacility(types[0]);
      }
    }).catch(() => {});
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [bName, setBName] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bFacility, setBFacility] = useState("cricket");
  const [bDate, setBDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bSlots, setBSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bPaidAmount, setBPaidAmount] = useState<number>(0);
  const [bPayMode, setBPayMode] = useState<"upi" | "cash">("cash");

  // Mark as Paid Dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payMode, setPayMode] = useState<"upi" | "cash">("cash");

  // Reject Dialog & Verify Status
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("Payment not received in arena UPI account / Invalid UTR");
  const [processingVerify, setProcessingVerify] = useState(false);

  useEffect(() => {
    if (!showModal || !bDate) return;
    setSelectedSlot("");
    const loadSlots = async () => {
      try {
        const res = await api.get(`/slots?date=${bDate}&facility_type=${bFacility}`);
        if (!Array.isArray(res.data)) {
          setBSlots([]);
          return;
        }

        const now = new Date();
        const available = res.data.filter((s: any) => {
          if (!s.is_available || s.is_booked) return false;

          try {
            const slotTimeStr = s.start_time ? s.start_time.substring(0, 5) : "00:00";
            const slotDateTime = parse(`${bDate} ${slotTimeStr}`, "yyyy-MM-dd HH:mm", new Date());
            return isAfter(slotDateTime, now);
          } catch {
            return false;
          }
        });

        setBSlots(available);
      } catch (e) {
        toast.error('Failed to load slots for selected date/facility');
      }
    };
    loadSlots();
  }, [bDate, bFacility, showModal]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !bName || !bPhone) return toast.error("Fill all fields");
    try {
      await api.post('/bookings', {
        name: bName,
        phone: bPhone,
        slot_id: selectedSlot,
        paid_amount: Number(bPaidAmount) || 0,
        is_manual: true,
        payment_method: bPayMode
      });
      toast.success("Booking created!");
      setShowModal(false);
      setBPaidAmount(0); // Reset
      setBName(""); setBPhone(""); setSelectedSlot(""); // Full reset
      fetchBookings();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to create booking");
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings');
      const mapped = res.data.map((b: any) => ({
        id: b.id,
        customerName: b.customer_name,
        phone: b.phone,
        facility: b.facility_type || "cricket",
        date: format(new Date(b.date), 'yyyy-MM-dd'),
        startTime: b.start_time ? formatTime12Hour(b.start_time) : "",
        endTime: b.end_time ? formatTime12Hour(b.end_time) : "",
        rawStatus: b.status,
        paymentStatus: b.payment_status,
        amount: Number(b.total_amount),
        paidAmount: Number(b.paid_amount || 0),
        remainingAmount: Number(b.remaining_amount || 0),
        paymentMode: b.payment_mode,
        utrNumber: b.utr_number,
        isManual: !!b.is_manual,
        get status() {
          if (this.rawStatus === 'cancelled') return 'cancelled';
          if (this.rawStatus === 'rejected') return 'rejected';
          if (this.rawStatus === 'pending_verification') return 'pending_verification';
          try {
            const slotEnd = parse(`${this.date} ${this.endTime}`, 'yyyy-MM-dd h:mm a', new Date());
            if (isAfter(new Date(), slotEnd)) return 'completed';
          } catch (e) {}
          return this.rawStatus;
        }
      }));
      setBookings(mapped);
    } catch (e) {
      toast.error('Failed to load bookings');
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useSocket('booking_updated', fetchBookings);

  const pendingApprovalCount = bookings.filter(b => b.rawStatus === 'pending_verification').length;

  const handleSort = (key: 'date' | 'amount' | 'customer') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : 'desc'
    }));
  };

  const filtered = bookings
    .filter((b) => {
      const matchesSearch = b.customerName.toLowerCase().includes(search.toLowerCase()) || 
                           b.id.toLowerCase().includes(search.toLowerCase()) || 
                           b.phone.includes(search) ||
                           (b.utrNumber && b.utrNumber.toLowerCase().includes(search.toLowerCase()));
      
      const matchesFacility = facilityFilter === "all" || b.facility === facilityFilter;
      
      const bDate = startOfDay(new Date(b.date));
      const today = startOfDay(new Date());
      
      const matchesTimeline = timelineFilter === 'all' || 
                             (timelineFilter === 'today' && isSameDay(bDate, today)) ||
                             (timelineFilter === 'upcoming' && isAfter(bDate, today)) ||
                             (timelineFilter === 'past' && b.status === "completed");

      const matchesPayment = paymentFilter === 'all' ||
                             (paymentFilter === 'needs_review' && b.rawStatus === 'pending_verification') ||
                             (paymentFilter === 'paid' && b.paymentStatus === 'paid') ||
                             (paymentFilter === 'pending' && b.paymentStatus === 'pending' && b.rawStatus !== 'pending_verification');

      return matchesSearch && matchesFacility && matchesTimeline && matchesPayment;
    })
    .sort((a, b) => {
      if (!sortConfig.direction) return 0;
      
      let valA, valB;
      if (sortConfig.key === 'date') {
        const timeA = parse(`${a.date} ${a.startTime}`, 'yyyy-MM-dd h:mm a', new Date());
        const timeB = parse(`${b.date} ${b.startTime}`, 'yyyy-MM-dd h:mm a', new Date());
        valA = timeA.getTime();
        valB = timeB.getTime();
      } else if (sortConfig.key === 'amount') {
        valA = a.amount;
        valB = b.amount;
      } else {
        valA = a.customerName.toLowerCase();
        valB = b.customerName.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleCancel = async (id: string) => {
    try {
      await api.patch(`/bookings/${id}/cancel`);
      toast.success(`Booking ${id.substring(0, 8)} cancelled`);
      fetchBookings();
    } catch (e) {
      toast.error('Failed to cancel booking');
    }
  };

  const handleVerifyUpi = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingVerify(true);
    try {
      await api.post(`/bookings/${id}/verify-upi`, { action, reason });
      toast.success(action === 'approve' ? 'Booking & UPI payment approved! Confirmation email sent.' : 'Booking rejected. Customer notified via email.');
      if (action === 'reject') setRejectOpen(false);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update booking status');
    } finally {
      setProcessingVerify(false);
    }
  };

  const handleCompletePayment = async () => {
    if (!payTarget) return;
    try {
      await api.patch(`/bookings/${payTarget.id}/pay`, {
        payment_mode: payMode
      });
      toast.success(`Booking ${payTarget.id.substring(0, 8)} marked as paid via ${payMode.toUpperCase()}`);
      setPayOpen(false);
      fetchBookings();
    } catch {
      toast.error('Failed to complete payment');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {pendingApprovalCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-500">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {pendingApprovalCount} UPI Payment{pendingApprovalCount > 1 ? 's' : ''} Awaiting Admin Approval
                </p>
                <p className="text-xs text-muted-foreground">
                  Customer submitted 12-digit UTR reference. Verify against your bank/UPI app and approve.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setPaymentFilter('needs_review')}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 self-end sm:self-auto"
            >
              Review Pending ({pendingApprovalCount})
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative flex-1 sm:w-64 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, UTR, ID..." className="pl-10 bg-card border-border" />
          </div>
          <Button onClick={() => setShowModal(true)} className="bg-gradient-turf text-primary-foreground shadow-turf shrink-0">
            <Plus className="w-4 h-4 mr-2" /> Book Slot
          </Button>
        </div>

        {/* Row 2: Advanced Filters (Refined) */}
        <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/50">
            {/* Timeline Tabs */}
            <div className="p-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {['all', 'today', 'upcoming', 'past'].map((t: any) => (
                  <button key={t} onClick={() => setTimelineFilter(t)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      timelineFilter === t 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-transparent bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Filter */}
            <div className="p-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {[
                  { key: 'all', label: 'All Payments' },
                  { key: 'needs_review', label: pendingApprovalCount > 0 ? `Verify UPI (${pendingApprovalCount})` : 'Verify UPI' },
                  { key: 'paid', label: 'Paid' },
                  { key: 'pending', label: 'Balance Due' }
                ].map((p: any) => (
                  <button key={p.key} onClick={() => setPaymentFilter(p.key as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      paymentFilter === p.key 
                        ? p.key === 'needs_review' 
                          ? "border-amber-500 bg-amber-500/10 text-amber-500 font-bold" 
                          : "border-primary bg-primary/10 text-primary" 
                        : "border-transparent bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Facility Filter */}
            <div className="p-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {["all", ...facilityTypes].map((f) => (
                  <button key={f} onClick={() => setFacilityFilter(f)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      facilityFilter === f 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-transparent bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    {f === "all" ? "All Sports" : getFacilityLabel(f)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:block rounded-xl bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="text-left px-5 py-3 text-muted-foreground font-medium">ID</th>
              <th className="text-left px-5 py-3 text-muted-foreground font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('customer')}>
                <div className="flex items-center gap-2">
                   Customer {sortConfig.key === 'customer' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left px-5 py-3 text-muted-foreground font-medium text-center">Event</th>
              <th className="text-left px-5 py-3 text-muted-foreground font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-2">
                   Schedule {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left px-5 py-3 text-muted-foreground font-medium">Status</th>
              <th className="text-left px-5 py-3 text-muted-foreground font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('amount')}>
                <div className="flex items-center gap-2">
                   Payment Details {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="text-left px-5 py-3 text-muted-foreground font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase">{b.id.substring(0, 8)}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-col">
                    <p className="font-medium text-foreground">{b.customerName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{b.phone}</p>
                      {b.isManual ? (
                        <Badge variant="outline" className="text-[9px] h-4 py-0 bg-slate-500/5 text-slate-500 border-slate-500/20 font-bold">MANUAL</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 py-0 bg-blue-500/5 text-blue-500 border-blue-500/20 font-bold">ONLINE</Badge>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  <Badge variant="outline" className="text-primary border-primary/20">{getFacilityLabel(b.facility)}</Badge>
                </td>
                <td className="px-5 py-3">
                   <p className="text-foreground font-bold">{b.date}</p>
                   <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">{b.startTime}–{b.endTime}</p>
                </td>
                <td className="px-5 py-3">
                  {b.rawStatus === 'pending_verification' ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold animate-pulse inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Verify UPI
                    </Badge>
                  ) : b.status === "rejected" ? (
                    <Badge variant="destructive" className="font-bold">
                      ✕ Rejected
                    </Badge>
                  ) : (
                    <Badge variant={b.status === "completed" ? "default" : b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}
                      className={b.status === "completed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : b.status === "confirmed" ? "bg-primary/10 text-primary border-primary/20" : ""}>
                      {b.status === "completed" ? "✓ Completed" : b.status === "confirmed" ? "✓ Confirmed" : b.status}
                    </Badge>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={b.paymentStatus === "paid" ? "text-primary border-primary/20 bg-primary/5" : "text-amber-500 border-amber-500/20 bg-amber-500/5 text-[10px]"}>
                        {b.paymentStatus === 'paid' ? 'Full Payment' : 'Partial / Pending'}
                      </Badge>
                      {b.paymentMode && (
                        <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">{b.paymentMode}</Badge>
                      )}
                    </div>
                    <div className="flex flex-col text-[11px]">
                      <span className="text-foreground">Total: ₹{b.amount}</span>
                      <span className="text-emerald-500 font-medium">Paid: ₹{b.paidAmount}</span>
                      {b.remainingAmount > 0 && (
                        <span className="text-amber-500 font-bold">Balance: ₹{b.remainingAmount}</span>
                      )}
                    </div>
                    {b.utrNumber && (
                      <div className="mt-1 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground w-fit">
                        <span className="text-[9px] uppercase font-bold text-amber-500">UTR:</span>
                        <span className="font-semibold text-foreground select-all">{b.utrNumber}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(b.utrNumber); toast.success('UTR copied to clipboard'); }}
                          className="text-amber-500 hover:text-amber-400 ml-0.5"
                          title="Copy UTR"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => setWhatsAppBooking(b)}
                      title="WhatsApp Quick Actions (Confirmation / Reminder / Request UTR)"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                    {b.rawStatus === 'pending_verification' ? (
                      <>
                        <Button
                          size="sm"
                          disabled={processingVerify}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-2.5 text-xs font-bold shadow-sm inline-flex items-center gap-1"
                          onClick={() => handleVerifyUpi(b.id, 'approve')}
                          title="Approve UPI payment and confirm booking"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingVerify}
                          className="text-destructive border-destructive/20 hover:bg-destructive/10 h-8 px-2 text-xs font-semibold"
                          onClick={() => { setRejectTarget(b); setRejectOpen(true); }}
                          title="Reject booking and release slot"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {b.paymentStatus === 'pending' && b.status !== 'cancelled' && b.status !== 'rejected' && (
                          <Button size="sm" className="bg-primary/10 text-primary hover:bg-primary/20 h-8 px-3 text-xs font-semibold border border-primary/20"
                            onClick={() => { setPayTarget(b); setPayOpen(true); }}>
                            Mark Paid
                          </Button>
                        )}
                        {b.status === "completed" ? (
                          <span className="inline-flex items-center text-xs text-emerald-500 font-medium">
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Done
                          </span>
                        ) : b.status === "cancelled" || b.status === "rejected" ? (
                          <span className="text-xs text-muted-foreground block">-</span>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2" onClick={() => handleCancel(b.id)}>
                            <XCircle className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">No bookings found</p>}
      </div>

      <div className="lg:hidden grid gap-4">
        {filtered.map((b) => (
          <div key={b.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
            {/* Header: Customer & Status */}
            <div className="p-4 flex justify-between items-start bg-secondary/10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                   </div>
                   <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-foreground leading-tight">{b.customerName}</p>
                        {b.isManual ? (
                          <Badge variant="outline" className="text-[8px] h-3.5 py-0 bg-slate-500/5 text-slate-500 border-slate-500/20 font-black">MANUAL</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] h-3.5 py-0 bg-blue-500/5 text-blue-500 border-blue-500/20 font-black">ONLINE</Badge>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-70 tracking-tighter">ID: {b.id.substring(0, 8)}</p>
                   </div>
                </div>
              </div>
              {b.rawStatus === 'pending_verification' ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-bold animate-pulse inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> VERIFY UPI
                </Badge>
              ) : b.status === "rejected" ? (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  ✕ REJECTED
                </Badge>
              ) : (
                <Badge variant={b.status === "completed" ? "default" : b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}
                  className={`${b.status === "completed" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : b.status === "confirmed" ? "bg-primary/10 text-primary border-primary/20" : ""} text-[10px] font-bold`}>
                  {b.status === "completed" ? "✓ Done" : b.status.toUpperCase()}
                </Badge>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Schedule
                  </p>
                  <p className="text-sm font-bold text-foreground">{b.date}</p>
                  <p className="text-xs font-medium text-muted-foreground">{b.startTime} - {b.endTime}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center justify-end gap-1">
                    <IndianRupee className="w-3 h-3" /> Financials
                  </p>
                  <p className="text-lg font-black text-foreground">₹{b.amount}</p>
                  <Badge variant="outline" className={`text-[10px] font-bold ${b.paymentStatus === "paid" ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : "text-amber-500 border-amber-500/20 bg-amber-500/5"}`}>
                    {b.paymentStatus === 'paid' ? 'FULLY PAID' : `DUE: ₹${b.remainingAmount}`}
                  </Badge>
                </div>
              </div>

              {b.utrNumber && (
                <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-500">UTR No:</span>
                    <span className="font-mono font-bold text-foreground tracking-wider select-all">{b.utrNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(b.utrNumber); toast.success('UTR copied'); }}
                    className="text-amber-500 hover:text-amber-400 p-1"
                    title="Copy UTR"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Meta & Actions */}
              <div className="pt-4 border-t border-border/50 flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5 uppercase font-bold py-0.5">
                          {getFacilityLabel(b.facility)}
                       </Badge>
                       {b.paymentMode && (
                          <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground bg-secondary/20">
                             {b.paymentMode}
                          </Badge>
                       )}
                    </div>
                    <div className="flex items-center gap-1.5">
                       <button
                         type="button"
                         onClick={() => setWhatsAppBooking(b)}
                         className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                         title="WhatsApp Customer"
                       >
                         <MessageSquare className="w-4 h-4" />
                       </button>
                       <a href={`tel:${b.phone}`} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors border border-border" title="Call Customer">
                          <Smartphone className="w-4 h-4" />
                       </a>
                    </div>
                 </div>

                 <div className="flex items-center gap-2">
                    {b.rawStatus === 'pending_verification' ? (
                      <>
                        <Button
                          size="sm"
                          disabled={processingVerify}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-9 text-xs font-bold shadow-sm inline-flex items-center justify-center gap-1.5"
                          onClick={() => handleVerifyUpi(b.id, 'approve')}
                        >
                          <Check className="w-4 h-4" /> Approve Payment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingVerify}
                          className="text-destructive border-destructive/20 hover:bg-destructive/10 h-9 px-3 text-xs font-bold"
                          onClick={() => { setRejectTarget(b); setRejectOpen(true); }}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </>
                    ) : (
                      <>
                        {b.paymentStatus === 'pending' && b.status !== 'cancelled' && b.status !== 'rejected' && (
                          <Button size="sm" className="flex-1 bg-primary text-primary-foreground h-9 text-xs font-bold shadow-sm"
                            onClick={() => { setPayTarget(b); setPayOpen(true); }}>
                            Mark as Paid
                          </Button>
                        )}
                        
                        {b.status === "completed" ? (
                          <div className="flex-1 h-9 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center text-xs text-emerald-500 font-bold gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Session Verified
                          </div>
                        ) : b.status === "cancelled" || b.status === "rejected" ? (
                          <div className="flex-1 h-9 rounded-lg border border-border bg-secondary/20 flex items-center justify-center text-xs text-muted-foreground font-bold">
                            {b.status === "rejected" ? "Booking Rejected" : "Booking Cancelled"}
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/10 h-9 text-xs font-bold" onClick={() => handleCancel(b.id)}>
                            <XCircle className="w-4 h-4 mr-1.5" /> Cancel
                          </Button>
                        )}
                      </>
                    )}
                 </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">No bookings found</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-turf">
            <h3 className="font-heading font-semibold text-lg text-foreground mb-4">Create Manual Booking</h3>
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Customer Name</label>
                <Input value={bName} onChange={e => setBName(e.target.value)} required className="bg-background" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Phone Number</label>
                <Input value={bPhone} onChange={e => setBPhone(e.target.value)} required className="bg-background" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground block mb-1">Event Type</label>
                  <select value={bFacility} onChange={e => setBFacility(e.target.value)} className="w-full border border-border bg-background rounded-md h-10 px-3 text-sm">
                    {facilityTypes.map(ft => (
                      <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground block mb-1">Date</label>
                  <DatePicker 
                    date={bDate} 
                    setDate={(d) => setBDate(d ? format(d, 'yyyy-MM-dd') : '')}
                    className="bg-background h-10 w-full"
                    placeholder="Booking Date"
                    fromDate={startOfDay(new Date())}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Available Slot</label>
                <select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} required className="w-full border border-border bg-background rounded-md h-10 px-3 text-sm">
                  <option value="">Select a slot...</option>
                  {bSlots.map(s => (
                    <option key={s.id} value={s.id}>
                      {formatTime12Hour(s.start_time)} - {formatTime12Hour(s.end_time)} {s.facility_name ? `(${s.facility_name})` : ''}
                    </option>
                  ))}
                </select>
                {bSlots.length === 0 && <p className="text-[10px] text-destructive mt-1">No slots available for this date/facility.</p>}
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">Advance Amount Paid (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="number" value={bPaidAmount} onChange={e => setBPaidAmount(Number(e.target.value))} className="w-full h-10 pl-10 bg-background border border-border rounded-md text-sm" placeholder="0.00" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 italic">Balance will be calculated automatically.</p>
              </div>

              {Number(bPaidAmount) > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setBPayMode("cash")}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${bPayMode === "cash"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}>
                      <Banknote className="w-4 h-4" />
                      <span className="font-semibold text-sm">Cash</span>
                    </button>
                    <button type="button" onClick={() => setBPayMode("upi")}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${bPayMode === "upi"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}>
                      <Smartphone className="w-4 h-4" />
                      <span className="font-semibold text-sm">UPI</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-gradient-turf text-primary-foreground font-semibold">Confirm Booking</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Settle Remaining Balance</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Booking ID</span>
                  <span className="text-foreground font-mono uppercase text-xs">{payTarget.id.substring(0, 8)}</span>
                </div>
                <div className="flex justify-between text-sm text-amber-500 font-bold">
                  <span>Balance Due</span>
                  <span>₹{payTarget.remainingAmount}</span>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Payment Mode</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPayMode("cash")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${payMode === "cash"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}>
                      <Banknote className="w-4 h-4" />
                      <span className="font-semibold text-sm">Cash</span>
                    </button>
                    <button onClick={() => setPayMode("upi")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${payMode === "upi"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}>
                      <Smartphone className="w-4 h-4" />
                      <span className="font-semibold text-sm">UPI</span>
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground text-center italic">
                Marking this as paid will confirm the full payment of ₹{payTarget.remainingAmount} via {payMode.toUpperCase()}
              </p>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setPayOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCompletePayment} className="flex-1 bg-gradient-turf text-primary-foreground shadow-turf">
              Settle & Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject UPI Booking Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Reject UPI Booking
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-3">
              <p className="text-xs text-muted-foreground">
                Rejecting this booking will release slot <span className="text-foreground font-bold">{rejectTarget.startTime}–{rejectTarget.endTime} ({rejectTarget.date})</span> so other players can book it, and automatically send an email notification to <span className="text-foreground font-bold">{rejectTarget.customerName}</span>.
              </p>
              <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold">{rejectTarget.customerName} ({rejectTarget.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted UTR:</span>
                  <span className="font-mono font-bold text-amber-500">{rejectTarget.utrNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold">₹{rejectTarget.amount}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason for Rejection</Label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Payment not credited in bank, invalid UTR"
                  className="text-xs bg-background"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} className="flex-1">Cancel</Button>
            <Button
              variant="destructive"
              disabled={processingVerify}
              onClick={() => rejectTarget && handleVerifyUpi(rejectTarget.id, 'reject', rejectReason)}
              className="flex-1 font-bold shadow-sm"
            >
              {processingVerify ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin WhatsApp Quick Action Modal */}
      <AdminWhatsAppModal
        isOpen={!!whatsAppBooking}
        onClose={() => setWhatsAppBooking(null)}
        booking={whatsAppBooking ? {
          id: whatsAppBooking.id,
          customerName: whatsAppBooking.customerName,
          customerPhone: whatsAppBooking.phone,
          facilityName: getFacilityLabel(whatsAppBooking.facility),
          date: whatsAppBooking.date,
          timeSlot: `${whatsAppBooking.startTime} - ${whatsAppBooking.endTime}`,
          amount: whatsAppBooking.amount,
          paidAmount: whatsAppBooking.paidAmount,
          rawStatus: whatsAppBooking.rawStatus,
        } : null}
      />
    </div>
  );
}
