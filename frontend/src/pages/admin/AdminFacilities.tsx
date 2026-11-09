import { useState, useEffect } from "react";
import { Plus, Trash2, Layers, Minus, Clock, ChevronDown, ChevronUp, UploadCloud, Loader2, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

export default function AdminFacilities() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [pricingModel, setPricingModel] = useState<"slot" | "hourly">("slot");
  const [desc, setDesc] = useState("");
  const [weekdayDayPrice, setWeekdayDayPrice] = useState("800");
  const [weekdayNightPrice, setWeekdayNightPrice] = useState("1000");
  const [weekendDayPrice, setWeekendDayPrice] = useState("1000");
  const [weekendNightPrice, setWeekendNightPrice] = useState("1200");
  const [hourlyPrice, setHourlyPrice] = useState("150");
  const [tableCount, setTableCount] = useState("1");
  const [openingHour, setOpeningHour] = useState("8");
  const [closingHour, setClosingHour] = useState("23");
  const [minBookingAmount, setMinBookingAmount] = useState("0");
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDescVal, setEditingDescVal] = useState("");

  const handleImageUpload = async (facilityId: string, file: File) => {
    setUploadingImageId(facilityId);
    const body = new FormData();
    body.append('image', file);
    try {
      const uploadRes = await api.post('/facilities/upload', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (uploadRes.data?.secure_url) {
        await api.patch(`/facilities/${facilityId}/image`, { image_url: uploadRes.data.secure_url });
        toast.success('Image updated!');
        fetchFacilities();
      }
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploadingImageId(null);
    }
  };

  const isHourlySettings = pricingModel === "hourly";

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pricingTarget, setPricingTarget] = useState<any>(null);
  const [editPrices, setEditPrices] = useState({ wd_day: "", wd_night: "", we_day: "", we_night: "", min_booking_amount: "" });

  const fetchFacilities = async () => {
    try {
      const res = await api.get('/facilities?all=true');
      setFacilities(res.data);
    } catch (e) {
      toast.error('Failed to load facilities');
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  useSocket('facility_updated', fetchFacilities);

  const handleToggleActive = async (facilityId: string, currentStatus: boolean, facilityName: string) => {
    setTogglingId(facilityId);
    try {
      await api.patch(`/facilities/${facilityId}/toggle`, {});
      const newStatus = !currentStatus;
      toast.success(`${facilityName} is now ${newStatus ? 'enabled and visible to customers' : 'disabled and hidden from landing page'}`);
      fetchFacilities();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update facility status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/facilities', {
        facility_type: type,
        description: desc,
        location: 'Dynamic Arena',
        pricing_model: pricingModel,
        weekday_day_price: Number(isHourlySettings ? hourlyPrice : weekdayDayPrice),
        weekday_night_price: Number(isHourlySettings ? hourlyPrice : weekdayNightPrice),
        weekend_day_price: Number(isHourlySettings ? hourlyPrice : weekendDayPrice),
        weekend_night_price: Number(isHourlySettings ? hourlyPrice : weekendNightPrice),
        table_count: isHourlySettings ? Number(tableCount) : 1,
        opening_hour: Number(openingHour),
        closing_hour: Number(closingHour),
        min_booking_amount: Number(minBookingAmount)
      });
      // Upload image if selected
      if (createImageFile && res.data?.id) {
        const body = new FormData();
        body.append('image', createImageFile);
        try {
          const uploadRes = await api.post('/facilities/upload', body, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (uploadRes.data?.secure_url) {
            await api.patch(`/facilities/${res.data.id}/image`, { image_url: uploadRes.data.secure_url });
          }
        } catch { /* image upload is optional */ }
      }
      toast.success('Sports Event added & Slots autonomously synced!');
      setDesc('');
      setCreateImageFile(null);
      setWeekdayDayPrice('800');
      setWeekdayNightPrice('1000');
      setWeekendDayPrice('1000');
      setWeekendNightPrice('1200');
      setHourlyPrice('150');
      setTableCount('1');
      setOpeningHour('8');
      setClosingHour('23');
      setMinBookingAmount('0');
      fetchFacilities();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to add sports event');
    }
  };

  const handleDelete = (id: string) => {
    toast("Are you sure you want to delete this event? All related slots will be broken if not handled!", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/facilities/${id}`);
            toast.success('Sports Event deleted');
            fetchFacilities();
          } catch (e) {
            toast.error('Failed to delete event');
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => { } }
    });
  };

  const openPricingModal = (facility: any) => {
    setPricingTarget(facility);
    setEditPrices({
      wd_day: facility.weekday_day_price || "800",
      wd_night: facility.weekday_night_price || "1000",
      we_day: facility.weekend_day_price || "1000",
      we_night: facility.weekend_night_price || "1200",
      min_booking_amount: facility.min_booking_amount || "0",
    });
    setIsPricingModalOpen(true);
  };

  const handleSavePricing = async () => {
    try {
      const isHourlyPatch = pricingTarget?.pricing_model === "hourly";
      await api.patch(`/facilities/${pricingTarget.id}/pricing`, {
        weekday_day_price: Number(isHourlyPatch ? editPrices.wd_day : editPrices.wd_day), // Using wd_day as the absolute hourly rate if snooker
        weekday_night_price: Number(isHourlyPatch ? editPrices.wd_day : editPrices.wd_night),
        weekend_day_price: Number(isHourlyPatch ? editPrices.wd_day : editPrices.we_day),
        weekend_night_price: Number(isHourlyPatch ? editPrices.wd_day : editPrices.we_night),
        min_booking_amount: Number(editPrices.min_booking_amount)
      });
      toast.success("Pricing meticulously updated and retroactively applied!");
      setIsPricingModalOpen(false);
      fetchFacilities();
    } catch (e) {
      toast.error("Failed to update pricing matrix");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors"
        >
          <h3 className="font-heading font-semibold text-foreground">Add New Sports Event</h3>
          <div className="p-1 rounded-md bg-secondary text-muted-foreground">
            {isFormExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isFormExpanded && (
        <div className="p-4 sm:p-5 pt-0 sm:pt-0 border-t border-border/50">
          <form onSubmit={handleAdd} className="flex flex-col gap-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Sport</Label>
                <Input placeholder="e.g. cricket, badminton, football..." value={type} onChange={e => setType(e.target.value.toLowerCase())} className="h-10" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Pricing Model</Label>
                <Select value={pricingModel} onValueChange={(v: "slot" | "hourly") => setPricingModel(v)}>
                  <SelectTrigger className="w-full bg-card border-border h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slot">Slot-Based (Day/Night tiers)</SelectItem>
                    <SelectItem value="hourly">Hourly (flat rate + tables)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Short Description</Label>
                <Input placeholder="Visual context for players..." value={desc} onChange={e => setDesc(e.target.value)} className="h-10" />
              </div>
            </div>

            {isHourlySettings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Hourly Rate (₹)</Label>
                  <Input type="number" placeholder="250" value={hourlyPrice} onChange={e => setHourlyPrice(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Table Count</Label>
                  <Input type="number" min="1" placeholder="1" value={tableCount} onChange={e => setTableCount(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Min Booking Deposit (₹)</Label>
                  <Input type="number" placeholder="0" value={minBookingAmount} onChange={e => setMinBookingAmount(e.target.value)} className="h-10" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Wkday Day</Label>
                  <Input type="number" placeholder="800" value={weekdayDayPrice} onChange={e => setWeekdayDayPrice(e.target.value)} className="h-10 px-2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Wkday Night</Label>
                  <Input type="number" placeholder="1000" value={weekdayNightPrice} onChange={e => setWeekdayNightPrice(e.target.value)} className="h-10 px-2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Wkend Day</Label>
                  <Input type="number" placeholder="1000" value={weekendDayPrice} onChange={e => setWeekendDayPrice(e.target.value)} className="h-10 px-2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Wkend Night</Label>
                  <Input type="number" placeholder="1200" value={weekendNightPrice} onChange={e => setWeekendNightPrice(e.target.value)} className="h-10 px-2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Deposit (₹)</Label>
                  <Input type="number" placeholder="0" value={minBookingAmount} onChange={e => setMinBookingAmount(e.target.value)} className="h-10 px-2" />
                </div>
              </div>
            )}
            {/* Opening / Closing Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Opening</Label>
                <Select value={openingHour} onValueChange={setOpeningHour}>
                  <SelectTrigger className="w-full bg-card border-border h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Closing</Label>
                <Select value={closingHour} onValueChange={setClosingHour}>
                  <SelectTrigger className="w-full bg-card border-border h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i + 1).filter(h => h > Number(openingHour)).map(h => (
                      <SelectItem key={h} value={String(h)}>{h === 24 ? '12 AM (midnight)' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Image Upload */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Cover Image (optional)</Label>
              <label className="flex items-center gap-2 border border-dashed border-border rounded-lg px-4 py-2.5 cursor-pointer hover:border-primary/40 transition-colors">
                <UploadCloud className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">{createImageFile ? createImageFile.name : 'Choose image...'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setCreateImageFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" className="w-full sm:w-auto bg-gradient-turf text-primary-foreground font-bold shadow-turf h-11 px-8">
                <Plus className="w-5 h-5 mr-2" /> Add Selection
              </Button>
            </div>
          </form>
        </div>
      )}
      </div>

      {/* Facilities Header & Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="font-heading font-semibold text-lg text-foreground">Sports & Facilities</h3>
          <p className="text-xs text-muted-foreground">Manage active status, pricing, and operating rules.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/50 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              filterStatus === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({facilities.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("active")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              filterStatus === "active" ? "bg-background text-emerald-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active ({facilities.filter(f => f.is_active !== false).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("disabled")}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              filterStatus === "disabled" ? "bg-background text-zinc-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            Disabled ({facilities.filter(f => f.is_active === false).length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {facilities
          .filter((f) => {
            if (filterStatus === "active") return f.is_active !== false;
            if (filterStatus === "disabled") return f.is_active === false;
            return true;
          })
          .map((f) => {
            const isActive = f.is_active !== false;
            return (
              <div 
                key={f.id} 
                className={`rounded-xl bg-card border overflow-hidden flex flex-col transition-all duration-200 ${
                  isActive ? 'border-border hover:border-primary/40 shadow-sm' : 'border-zinc-800/80 bg-card/60 opacity-85'
                }`}
              >
                {/* Image Section */}
                <div className="relative h-36 bg-muted/30 overflow-hidden group">
                  {/* Status Overlay Badge */}
                  <div className="absolute top-2.5 left-2.5 z-10">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-emerald-500/40 text-[10px] font-bold text-emerald-400 shadow-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live on Site
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-zinc-700 text-[10px] font-bold text-zinc-400 shadow-lg">
                        Hidden from Public
                      </span>
                    )}
                  </div>

                  {f.image_url ? (
                    <img src={f.image_url} alt={f.name} className={`w-full h-full object-cover transition-transform duration-500 ${!isActive ? 'grayscale-[40%]' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layers className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                    {uploadingImageId === f.id ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2 text-white text-xs font-semibold">
                        <UploadCloud className="w-4 h-4" /> Change Image
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingImageId === f.id}
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(f.id, file); }} />
                  </label>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0 hover:bg-destructive/10" onClick={() => handleDelete(f.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-heading font-semibold text-lg text-foreground truncate">{f.name}</h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {f.facility_type}
                    </span>
                  </div>

                  {/* Active / Inactive Status Switcher Bar */}
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border my-3 transition-colors ${
                    isActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/40 border-border/60'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold leading-tight ${isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {isActive ? 'Enabled (Visible)' : 'Disabled (Hidden)'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isActive ? 'Visible on landing page & booking' : 'Hidden from customers'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pl-2">
                      <Switch
                        checked={isActive}
                        disabled={togglingId === f.id}
                        onCheckedChange={() => handleToggleActive(f.id, isActive, f.name)}
                        aria-label={`Toggle ${f.name} visibility`}
                      />
                    </div>
                  </div>

                  {editingDescId === f.id ? (
                    <input
                      autoFocus
                      className="text-xs text-muted-foreground mb-4 w-full bg-transparent border-b border-primary/40 outline-none py-1"
                      value={editingDescVal}
                      onChange={e => setEditingDescVal(e.target.value)}
                      onBlur={async () => {
                        if (editingDescVal !== f.description) {
                          try {
                            await api.patch(`/facilities/${f.id}`, { description: editingDescVal });
                            toast.success('Description updated!');
                            fetchFacilities();
                          } catch { toast.error('Failed to update'); }
                        }
                        setEditingDescId(null);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 cursor-pointer hover:text-foreground transition-colors group/desc flex items-start gap-1"
                      onClick={() => { setEditingDescId(f.id); setEditingDescVal(f.description || ''); }}>
                      {f.description || <span className="italic">Click to add description...</span>}
                      <Pencil className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
                    </p>
                  )}
            {/* Operating Hours Row */}
            <div className="bg-muted/20 border border-border/50 px-3 py-2 rounded-md mb-3 flex items-center justify-between">
              <span className="text-muted-foreground font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5"><Clock className="w-3 h-3" /> Hours</span>
              <div className="flex items-center gap-1">
                <select className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground font-medium w-[70px]"
                  value={f.opening_hour ?? 6}
                  onChange={async (e) => {
                    try {
                      await api.patch(`/facilities/${f.id}/hours`, { opening_hour: Number(e.target.value), closing_hour: f.closing_hour ?? 23 });
                      toast.success('Opening hour updated & slots synced!');
                      fetchFacilities();
                    } catch { toast.error('Failed to update'); }
                  }}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i} className="bg-card text-foreground">{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                  ))}
                </select>
                <span className="text-muted-foreground text-xs">→</span>
                <select className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground font-medium w-[70px]"
                  value={f.closing_hour ?? 23}
                  onChange={async (e) => {
                    try {
                      await api.patch(`/facilities/${f.id}/hours`, { opening_hour: f.opening_hour ?? 6, closing_hour: Number(e.target.value) });
                      toast.success('Closing hour updated & slots synced!');
                      fetchFacilities();
                    } catch { toast.error('Failed to update'); }
                  }}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).filter(h => h > (f.opening_hour ?? 6)).map(h => (
                    <option key={h} value={h} className="bg-card text-foreground">{h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-border flex flex-col gap-3">
              {f.pricing_model === 'hourly' ? (
                <>
                  <div className="bg-primary/5 border border-primary/20 px-3 py-2 rounded-md mb-2 flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold text-xs tracking-wider uppercase">Flat Hourly Engine</span>
                    <span className="font-bold text-primary">₹{f.weekday_day_price} / hr</span>
                  </div>
                  <div className="bg-muted/30 px-3 py-2 rounded-md mb-2 flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold text-xs tracking-wider uppercase">Physical Tables</span>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          const newCount = Math.max(1, (f.table_count || 1) - 1);
                          await api.patch(`/facilities/${f.id}/tables`, { table_count: newCount });
                          toast.success(`Table count updated to ${newCount}`);
                          fetchFacilities();
                        }}>
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span className="font-bold text-foreground text-sm min-w-[20px] text-center">{f.table_count || 1}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={async () => {
                          const newCount = (f.table_count || 1) + 1;
                          await api.patch(`/facilities/${f.id}/tables`, { table_count: newCount });
                          toast.success(`Table count updated to ${newCount}`);
                          fetchFacilities();
                        }}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-x-1 gap-y-1.5 text-[11px] mb-2">
                  <div className="flex justify-between items-center bg-muted/30 px-2 py-1 rounded-md">
                    <span className="text-muted-foreground">Wkday Day</span>
                    <span className="font-semibold text-foreground">₹{f.weekday_day_price}</span>
                  </div>
                  <div className="flex justify-between items-center bg-muted/30 px-2 py-1 rounded-md">
                    <span className="text-muted-foreground">Wkday Night</span>
                    <span className="font-semibold text-foreground">₹{f.weekday_night_price}</span>
                  </div>
                  <div className="flex justify-between items-center bg-muted/30 px-2 py-1 rounded-md">
                    <span className="text-muted-foreground">Wkend Day</span>
                    <span className="font-semibold text-foreground">₹{f.weekend_day_price}</span>
                  </div>
                  <div className="flex justify-between items-center bg-muted/30 px-2 py-1 rounded-md">
                    <span className="text-muted-foreground">Wkend Night</span>
                    <span className="font-semibold text-foreground">₹{f.weekend_night_price}</span>
                  </div>
                </div>
              )}
              <div className="bg-primary/5 border border-primary/10 px-3 py-1.5 rounded-lg mb-2 flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Min Online Deposit</span>
                <span className="text-sm font-bold text-primary">₹{f.min_booking_amount || 0}</span>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => openPricingModal(f)}>Update Global Pricing</Button>
            </div>
            </div>
          </div>
            );
          })}
        {facilities.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">No sports events found. Create one above!</div>
        )}
      </div>

      <Dialog open={isPricingModalOpen} onOpenChange={setIsPricingModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Update Split Pricing Grid</DialogTitle>
          </DialogHeader>
          {pricingTarget?.pricing_model === 'hourly' ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">Changing this global hourly rate will autonomously recalculate all future templates and free slots for <b>{pricingTarget?.name}</b>.</p>
              <div className="space-y-2 mb-4">
                <Label>Flat Hourly Engine Rate (₹)</Label>
                <Input type="number" value={editPrices.wd_day} onChange={(e) => setEditPrices({ ...editPrices, wd_day: e.target.value })} />
              </div>
              <div className="space-y-2 mb-4">
                <Label>Booking Deposit Amount (₹)</Label>
                <Input type="number" value={editPrices.min_booking_amount} onChange={(e) => setEditPrices({ ...editPrices, min_booking_amount: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">Changing these prices will instantly recalculate all future unbooked slots & weekly templates for <b>{pricingTarget?.name}</b>. Night starts dynamically at 18:00 (6 PM).</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Weekday Day (₹)</Label>
                  <Input type="number" value={editPrices.wd_day} onChange={(e) => setEditPrices({ ...editPrices, wd_day: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Weekday Night (₹)</Label>
                  <Input type="number" value={editPrices.wd_night} onChange={(e) => setEditPrices({ ...editPrices, wd_night: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Weekend Day (₹)</Label>
                  <Input type="number" value={editPrices.we_day} onChange={(e) => setEditPrices({ ...editPrices, we_day: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Weekend Night (₹)</Label>
                  <Input type="number" value={editPrices.we_night} onChange={(e) => setEditPrices({ ...editPrices, we_night: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Default Online Booking Deposit (₹)</Label>
                  <Input type="number" value={editPrices.min_booking_amount} onChange={(e) => setEditPrices({ ...editPrices, min_booking_amount: e.target.value })} />
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPricingModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePricing} className="bg-gradient-turf text-primary-foreground shadow-turf">Sync Updates</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
