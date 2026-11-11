import { useState, useEffect } from "react";
import { format, parse, isAfter, isBefore, differenceInSeconds } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type FacilityType, facilityLabels, getFacilityLabel } from "@/lib/mock-data";
import { Lock, Unlock, Plus, CalendarIcon, User, Phone, CreditCard, Clock, IndianRupee, Banknote, Smartphone, Check } from "lucide-react";
import { formatTime12Hour } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

export default function AdminSlots() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [facility, setFacility] = useState<FacilityType>("");
  const [slots, setSlots] = useState<any[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState(1);
  const [isArenaClosed, setIsArenaClosed] = useState(false);
  const [closureReason, setClosureReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'booked' | 'expired'>('all');

  // Quick Book Dialog State
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookTargetSlot, setBookTargetSlot] = useState<any>(null);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [bookPayMode, setBookPayMode] = useState<"cash" | "upi">("cash");
  const [submittingBooking, setSubmittingBooking] = useState(false);


  // Fetch available facility types and facilities list
  useEffect(() => {
    api.get('/facilities').then(res => {
      setFacilities(res.data);
      const types = [...new Set(res.data.map((f: any) => f.facility_type))] as string[];
      setFacilityTypes(types);
      if (types.length > 0 && !facility) setFacility(types[0]);
    }).catch(() => {});
  }, []);

  const fetchSlots = async (date: Date) => {
    try {
      const response = await api.get(`/slots?date=${format(date, "yyyy-MM-dd")}`);
      
      if (response.data && response.data.is_closed) {
        setIsArenaClosed(true);
        setClosureReason(response.data.reason || "Arena is closed for this date.");
        setSlots([]);
        return;
      }
      
      setIsArenaClosed(false);
      
      if (!Array.isArray(response.data)) {
        console.error("Expected array but got:", response.data);
        setSlots([]);
        return;
      }

      const mapped = response.data
        .filter((s: any) => s.facility_type === facility || !s.facility_type)
        .map((s: any) => ({
          id: s.id,
          turf_id: s.turf_id,
          tableNumber: s.table_number || 1,
          startTime: s.start_time ? formatTime12Hour(s.start_time) : "",
          endTime: s.end_time ? formatTime12Hour(s.end_time) : "",
          isAvailable: s.is_available,
          price: Number(s.price),
          isBooked: s.is_booked,
          userName: s.user_name,
          phone: s.phone,
          paymentStatus: s.payment_status,
          sharedBookingFacility: s.shared_booking_facility
      }));
      setSlots(mapped);
    } catch(e) {
      toast.error('Failed to load slots');
    }
  };

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate, facility]);

  useSocket('booking_updated', () => fetchSlots(selectedDate));
  useSocket('slot_updated', () => fetchSlots(selectedDate));

  // Live Timer Telemetry
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDateChange = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
  };

  const handleFacilityChange = (f: FacilityType) => {
    setFacility(f);
  };

  const toggleSlot = async (id: string) => {
    try {
      const res = await api.patch(`/slots/${id}/toggle`);
      const updatedSlot = res.data;
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, isAvailable: updatedSlot.is_available } : s)));
      toast.success(`Slot successfully ${updatedSlot.is_available ? "unblocked" : "blocked"}`);
    } catch(e) {
      toast.error('Failed to toggle slot');
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState({ id: "", startTime: "10:00", endTime: "11:00", price: "800" });

  const openModal = (mode: "add" | "edit", slot?: any) => {
    setModalMode(mode);
    if (slot) {
      setFormData({ id: slot.id, startTime: slot.startTime, endTime: slot.endTime, price: slot.price.toString() });
    } else {
      setFormData({ id: "", startTime: "10:00", endTime: "11:00", price: "800" });
    }
    setIsModalOpen(true);
  };

  const handleSaveSlot = async () => {
    try {
      if (modalMode === "add") {
        const payload = {
          turf_id: slots[0]?.turf_id, // Safely use the existing active turf context!
          date: format(selectedDate, "yyyy-MM-dd"),
          start_time: formData.startTime,
          end_time: formData.endTime,
          price: Number(formData.price),
          is_available: true
        };
        await api.post('/slots', payload);
        toast.success("Custom slot created!");
      } else {
        await api.patch(`/slots/${formData.id}`, {
          start_time: formData.startTime,
          end_time: formData.endTime,
          price: Number(formData.price)
        });
        toast.success("Slot updated!");
      }
      setIsModalOpen(false);
      fetchSlots(selectedDate);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save slot");
    }
  };

  const deleteSlot = (id: string) => {
    toast("Are you sure you want to permanently delete this slot?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/slots/${id}`);
            setSlots((prev) => prev.filter((s) => s.id !== id));
            toast.success("Slot deleted");
          } catch (e) {
            toast.error("Failed to delete slot");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<any>(null);

  const openBookModal = (slot: any) => {
    setBookTargetSlot(slot);
    setCustName("");
    setCustPhone("");
    setAdvancePaid(slot.price || 0);
    setBookPayMode("cash");
    setBookModalOpen(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTargetSlot) return;
    if (!custName.trim() || !custPhone.trim()) {
      return toast.error("Please enter customer name and phone number");
    }

    setSubmittingBooking(true);
    try {
      await api.post('/bookings', {
        name: custName.trim(),
        phone: custPhone.trim(),
        slot_id: bookTargetSlot.id,
        paid_amount: Number(advancePaid) || 0,
        is_manual: true,
        payment_method: bookPayMode
      });
      toast.success(`Slot successfully booked for ${custName}!`);
      setBookModalOpen(false);
      fetchSlots(selectedDate);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create booking");
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCardClick = (slot: any) => {
    if (slot.isBooked) {
      setInspectTarget(slot);
      setInspectorOpen(true);
      return;
    }

    const endDateTime = parse(`${format(selectedDate, "yyyy-MM-dd")} ${slot.endTime}`, "yyyy-MM-dd hh:mm a", new Date());
    const isPast = isAfter(now, endDateTime);

    if (slot.isAvailable && !isPast) {
      openBookModal(slot);
    }
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const tableSlots = slots.filter(s => s.tableNumber === selectedTable);

  const slotCounts = {
    all: tableSlots.length,
    available: tableSlots.filter(s => {
      const end = parse(`${format(selectedDate, "yyyy-MM-dd")} ${s.endTime}`, "yyyy-MM-dd hh:mm a", new Date());
      return s.isAvailable && !s.isBooked && !isAfter(now, end);
    }).length,
    booked: tableSlots.filter(s => s.isBooked).length,
    expired: tableSlots.filter(s => {
      const end = parse(`${format(selectedDate, "yyyy-MM-dd")} ${s.endTime}`, "yyyy-MM-dd hh:mm a", new Date());
      return !s.isBooked && isAfter(now, end);
    }).length,
  };

  const filteredSlots = tableSlots.filter((slot) => {
    if (statusFilter === 'all') return true;
    const end = parse(`${format(selectedDate, "yyyy-MM-dd")} ${slot.endTime}`, "yyyy-MM-dd hh:mm a", new Date());
    const isPast = isAfter(now, end);

    if (statusFilter === 'available') {
      return slot.isAvailable && !slot.isBooked && !isPast;
    }
    if (statusFilter === 'booked') {
      return slot.isBooked;
    }
    if (statusFilter === 'expired') {
      return !slot.isBooked && isPast;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Facility filter */}
      <div className="flex overflow-x-auto flex-nowrap gap-2 pb-1 scrollbar-hide">
        {facilityTypes.map((f) => (
          <Button key={f} size="sm" variant={facility === f ? "default" : "outline"}
            onClick={() => {
              handleFacilityChange(f);
              setSelectedTable(1);
            }}
            className={facility === f ? "bg-gradient-turf text-primary-foreground" : ""}>
            {getFacilityLabel(f)}
          </Button>
        ))}
      </div>

      {/* Table Selector (if multiple tables) */}
      {(() => {
        const activeFacility = facilities.find(f => f.facility_type === facility);
        const count = activeFacility?.table_count || 1;
        if (count <= 1) return null;
        
        return (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs font-semibold text-muted-foreground mr-2 uppercase tracking-wider">Tables:</span>
            {Array.from({ length: count }).map((_, i) => (
              <Button 
                key={i + 1} 
                size="sm" 
                variant={selectedTable === i + 1 ? "secondary" : "ghost"}
                onClick={() => setSelectedTable(i + 1)}
                className={selectedTable === i + 1 ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted"}
              >
                Table {i + 1}
              </Button>
            ))}
          </div>
        );
      })()}

      <div className="flex flex-col gap-6">
        <div className="flex-1 w-full mt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-lg text-foreground">
                {getFacilityLabel(facility)} Manage Overrides
              </h3>
              <p className="text-sm text-muted-foreground">Select a specific date to manually block slots or add irregular timings.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal w-[240px] bg-card border-border">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border">
                  <Calendar 
                    mode="single" 
                    selected={selectedDate} 
                    onSelect={handleDateChange}
                    className="rounded-xl border border-border pointer-events-auto" 
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button onClick={() => openModal("add")} className="bg-gradient-turf text-primary-foreground shadow-turf h-10 w-full sm:w-auto px-4">
                <Plus className="w-4 h-4 mr-2" /> Custom Slot
              </Button>
            </div>
          </div>

          {/* Status Filter Pills */}
          {!isArenaClosed && tableSlots.length > 0 && (
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { key: 'all', label: 'All', count: slotCounts.all },
                { key: 'available', label: 'Available', count: slotCounts.available },
                { key: 'booked', label: 'Booked', count: slotCounts.booked },
                { key: 'expired', label: 'Expired', count: slotCounts.expired },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-2 ${
                    statusFilter === tab.key
                      ? tab.key === 'available'
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-sm"
                        : tab.key === 'expired'
                          ? "border-amber-500 bg-amber-500/15 text-amber-500 shadow-sm"
                          : tab.key === 'booked'
                            ? "border-primary bg-primary/20 text-primary shadow-sm"
                            : "border-primary bg-primary/20 text-primary shadow-sm"
                      : "border-border/60 bg-card/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    statusFilter === tab.key
                      ? "bg-foreground/15 text-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {isArenaClosed ? (
              <div className="col-span-full py-16 px-4 text-center border-2 border-destructive/20 rounded-3xl bg-destructive/5 flex flex-col items-center">
                <Lock className="w-12 h-12 text-destructive mb-3" />
                <h4 className="font-bold text-foreground text-lg">Arena Globally Closed</h4>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-6">
                  This date is blocked via Dynamic Closures: <br/> 
                  <span className="font-semibold text-foreground italic">"{closureReason}"</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href='/admin/closures'}>
                    Manage Closures
                  </Button>
                </div>
              </div>
            ) : tableSlots.length === 0 ? (
              <div className="col-span-full py-20 text-center border border-dashed border-border rounded-xl">
                 <p className="text-muted-foreground">No slots available for this configuration.</p>
              </div>
            ) : filteredSlots.length === 0 ? (
              <div className="col-span-full py-16 px-4 text-center border border-dashed border-border rounded-2xl bg-card/20">
                <p className="text-muted-foreground text-sm">
                  No <strong className="text-foreground capitalize">{statusFilter}</strong> slots found for this date.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                  className="mt-3 text-primary hover:text-primary/80 text-xs font-bold"
                >
                  View All ({slotCounts.all}) Slots
                </Button>
              </div>
            ) : (
              filteredSlots.map((slot) => {
                // Mathematical Telemetry Logic
                const startDateTime = parse(`${format(selectedDate, "yyyy-MM-dd")} ${slot.startTime}`, "yyyy-MM-dd hh:mm a", new Date());
                const endDateTime = parse(`${format(selectedDate, "yyyy-MM-dd")} ${slot.endTime}`, "yyyy-MM-dd hh:mm a", new Date());
                const isRunning = slot.isBooked && isAfter(now, startDateTime) && isBefore(now, endDateTime);
                const isPast = isAfter(now, endDateTime);
                const remainingSecs = isRunning ? differenceInSeconds(endDateTime, now) : 0;

                return (
                  <div key={slot.id} onClick={() => handleCardClick(slot)}
                    className={`relative p-4 rounded-xl border transition-all duration-300 overflow-hidden flex flex-col ${
                      slot.isBooked && isPast
                        ? "bg-secondary/30 border-border cursor-pointer hover:bg-secondary/50"
                        : slot.isBooked 
                          ? "bg-primary/10 border-primary/40 cursor-pointer hover:border-primary" 
                          : isPast && slot.isAvailable
                            ? "bg-amber-500/5 border-amber-500/20"
                          : slot.isAvailable 
                            ? "bg-card border-border hover:border-primary/50 cursor-pointer hover:shadow-md hover:bg-primary/5 group" 
                            : "bg-destructive/5 border-destructive/20"
                    } ${isRunning ? 'ring-2 ring-green-500/60 ring-offset-2 ring-offset-background' : ''}`}>
                    
                    {isRunning && (
                      <div className="flex items-center gap-1.5 text-green-500 font-bold text-[10px] uppercase tracking-wider mb-3 bg-green-500/10 w-fit px-2 py-1 rounded-md animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></div>
                        Live • {formatCountdown(remainingSecs)}
                      </div>
                    )}

                    <p className={`font-heading font-bold text-lg ${isPast && !isRunning ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {slot.startTime} <span className="text-muted-foreground text-sm font-normal mx-1">to</span> {slot.endTime}
                    </p>
                    <p className="text-sm text-muted-foreground font-medium mb-4 mt-1">₹{slot.price}</p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      {slot.isBooked && isPast ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5 bg-background border border-border/60 shadow-sm px-2.5 py-1 rounded-md">
                          <Lock className="w-3 h-3" /> Completed
                        </span>
                      ) : slot.isBooked ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-primary flex items-center gap-1.5 bg-primary/20 px-2.5 py-1 rounded-md">
                          <Lock className="w-3 h-3" /> Booked
                        </span>
                      ) : (
                        <>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md ${
                            isPast && slot.isAvailable ? "text-amber-500 bg-amber-500/10" 
                            : slot.isAvailable ? "text-emerald-400 bg-emerald-500/10" 
                            : "text-destructive bg-destructive/10"
                          }`}>
                            {isPast && slot.isAvailable ? "Expired" : slot.isAvailable ? "Available" : "Blocked"}
                          </span>
                          {!isPast && (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground z-10 relative" 
                                onClick={(e) => { e.stopPropagation(); toggleSlot(slot.id); }}>
                                {slot.isAvailable ? <><Lock className="w-3.5 h-3.5 mr-1" /> <span className="text-xs">Block</span></> : <><Unlock className="w-3.5 h-3.5 text-foreground mr-1" /> <span className="text-xs">Unblock</span></>}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{modalMode === "add" ? "Add Custom Slot" : "Edit Slot Details"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input type="number" placeholder="Enter amount" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSlot} className="bg-gradient-turf text-primary-foreground shadow-turf">
              {modalMode === "add" ? "Create Slot" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspector Details Dialog */}
      <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Booking Inspector</DialogTitle>
          </DialogHeader>
          {inspectTarget && (
            <div className="grid gap-5 py-4">
              <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border border-border">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Slot Time</p>
                  <p className="font-semibold text-foreground">{inspectTarget.startTime} to {inspectTarget.endTime}</p>
                </div>
              </div>
              
              {inspectTarget.userName ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Booked By</p>
                      <p className="font-medium text-foreground">{inspectTarget.userName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contact Number</p>
                      <p className="font-medium text-foreground">{inspectTarget.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Status</p>
                      <p className="font-medium capitalize text-foreground">
                        {inspectTarget.paymentStatus} 
                        <span className="text-muted-foreground ml-2">(₹{inspectTarget.price})</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : inspectTarget.sharedBookingFacility ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mt-2">
                  <p className="text-amber-500 font-semibold text-sm mb-1">Shared Resource Blocked</p>
                  <p className="text-xs text-muted-foreground">
                    This slot is automatically blocked because the physical area is currently booked for <strong className="text-foreground">{inspectTarget.sharedBookingFacility}</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-secondary/40 border border-border rounded-lg p-4 mt-2">
                  <p className="text-muted-foreground text-sm">Booking details unavailable.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setInspectorOpen(false)} className="w-full bg-primary text-primary-foreground">Close Inspector</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Book Slot Modal */}
      <Dialog open={bookModalOpen} onOpenChange={setBookModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-heading">
              <CalendarIcon className="w-5 h-5 text-primary" /> Book Slot for Customer
            </DialogTitle>
          </DialogHeader>
          {bookTargetSlot && (
            <form onSubmit={handleConfirmBooking} className="space-y-4 py-2">
              {/* Slot Summary Card */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Sport / Facility:</span>
                  <span className="font-bold text-primary uppercase">{getFacilityLabel(facility)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Date & Time:</span>
                  <span className="font-bold text-foreground">
                    {format(selectedDate, "EEE, MMM d, yyyy")} • {bookTargetSlot.startTime} – {bookTargetSlot.endTime}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-primary/10 pt-2">
                  <span className="text-muted-foreground font-semibold">Total Slot Price:</span>
                  <span className="text-sm font-black text-foreground">₹{bookTargetSlot.price}</span>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      required
                      placeholder="e.g. Harshvardhan Patil"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="pl-9 bg-background"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      required
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Advance Amount Paid (₹)
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      max={bookTargetSlot.price}
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(Number(e.target.value))}
                      className="pl-9 bg-background font-bold text-sm"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>Balance Due: <strong className="text-amber-500">₹{Math.max(0, bookTargetSlot.price - advancePaid)}</strong></span>
                    <button
                      type="button"
                      onClick={() => setAdvancePaid(bookTargetSlot.price)}
                      className="text-primary hover:underline font-semibold"
                    >
                      Set Full (₹{bookTargetSlot.price})
                    </button>
                  </div>
                </div>

                {Number(advancePaid) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Payment Mode
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBookPayMode("cash")}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                          bookPayMode === "cash"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span className="text-sm">Cash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookPayMode("upi")}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-all ${
                          bookPayMode === "upi"
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border bg-transparent text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span className="text-sm">UPI</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setBookModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingBooking}
                  className="flex-1 bg-gradient-turf text-primary-foreground font-bold shadow-turf"
                >
                  {submittingBooking ? "Booking..." : "Confirm Booking"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
