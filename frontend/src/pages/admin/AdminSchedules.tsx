import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CalendarDays, Clock } from "lucide-react";
import { formatTime12Hour } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminSchedules() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedTurfId, setSelectedTurfId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [templates, setTemplates] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState({ id: "", startTime: "10:00", endTime: "11:00", price: "800" });

  const fetchFacilities = async () => {
    try {
      const res = await api.get('/facilities');
      setFacilities(res.data);
      if (res.data.length > 0 && !selectedTurfId) {
        setSelectedTurfId(res.data[0].id);
      }
    } catch (e) {
      toast.error('Failed to load facilities');
    }
  };

  const fetchTemplates = async () => {
    if (!selectedTurfId) return;
    try {
      const res = await api.get(`/templates/${selectedTurfId}`);
      setTemplates(res.data);
    } catch (e) {
      toast.error('Failed to load schedule templates');
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [selectedTurfId]);

  const openModal = (mode: "add" | "edit", tmpl?: any) => {
    setModalMode(mode);
    if (tmpl) {
      setFormData({ 
        id: tmpl.id, 
        startTime: tmpl.start_time ? formatTime12Hour(tmpl.start_time) : "10:00 AM", 
        endTime: tmpl.end_time ? formatTime12Hour(tmpl.end_time) : "11:00 AM", 
        price: tmpl.price?.toString() || "800" 
      });
    } else {
      setFormData({ id: "", startTime: "10:00", endTime: "11:00", price: "800" });
    }
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (modalMode === "add") {
        await api.post('/templates', {
          turf_id: selectedTurfId,
          day_of_week: selectedDay,
          start_time: formData.startTime,
          end_time: formData.endTime,
          price: Number(formData.price)
        });
        toast.success("Schedule template added!");
      } else {
        await api.patch(`/templates/${formData.id}`, {
          start_time: formData.startTime,
          end_time: formData.endTime,
          price: Number(formData.price)
        });
        toast.success("Schedule template updated!");
      }
      setIsModalOpen(false);
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save schedule template");
    }
  };

  const deleteTemplate = (id: string) => {
    toast("Are you sure you want to permanently delete this slot from the weekly schedule?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/templates/${id}`);
            setTemplates((prev) => prev.filter((t) => t.id !== id));
            toast.success("Template deleted");
          } catch (e) {
            toast.error("Failed to delete template");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const currentDayTemplates = templates.filter(t => t.day_of_week === selectedDay);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 rounded-xl bg-card border border-border p-4">
        <div className="flex-1 space-y-1.5">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Sports Event</Label>
          <Select value={selectedTurfId} onValueChange={setSelectedTurfId}>
            <SelectTrigger className="w-full h-10 border-border bg-background">
              <SelectValue placeholder="Select a facility" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name} <span className="text-muted-foreground text-xs ml-1">({f.facility_type})</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-[2] space-y-1.5 min-w-0">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Day of Week</Label>
          <div className="flex overflow-x-auto pb-1 gap-2 scrollbar-none snap-x">
            {DAYS.map((day, idx) => (
              <Button 
                key={day} 
                size="sm" 
                variant={selectedDay === idx ? "default" : "outline"}
                onClick={() => setSelectedDay(idx)}
                className={`snap-start shrink-0 ${selectedDay === idx ? "bg-gradient-turf text-primary-foreground" : ""}`}
              >
                {day.substring(0, 3)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg text-foreground">
              {DAYS[selectedDay]} Schedule
            </h3>
          </div>
          <Button size="sm" onClick={() => openModal("add")} className="bg-gradient-turf text-primary-foreground shadow-turf">
            <Plus className="w-4 h-4 mr-2" /> Add Template Slot
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {currentDayTemplates.map(tmpl => (
             <div key={tmpl.id} className="p-4 rounded-xl border border-border bg-background flex flex-col hover:border-primary/40 transition-colors">
               <div className="flex items-center gap-1 mb-2">
                 <Clock className="w-3.5 h-3.5 text-primary" />
                 <span className="text-sm font-semibold text-foreground">
                   {tmpl.start_time ? formatTime12Hour(tmpl.start_time) : ""} – {tmpl.end_time ? formatTime12Hour(tmpl.end_time) : ""}
                 </span>
               </div>
               <p className="text-sm font-bold text-primary mb-3">₹{tmpl.price}</p>
               <div className="mt-auto pt-2 border-t border-border/50 flex items-center justify-end gap-1">
                 <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openModal("edit", tmpl)}>
                   <Edit2 className="w-3.5 h-3.5" />
                 </Button>
                 <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTemplate(tmpl.id)}>
                   <Trash2 className="w-3.5 h-3.5" />
                 </Button>
               </div>
             </div>
          ))}
          {currentDayTemplates.length === 0 && (
            <div className="col-span-full py-10 text-center text-muted-foreground flex flex-col items-center">
              <CalendarDays className="w-8 h-8 opacity-20 mb-2" />
              <p>No slots configured for {DAYS[selectedDay]}.</p>
              <p className="text-xs mt-1">This facility will be closed indefinitely on {DAYS[selectedDay]}s until you add slots.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{modalMode === "add" ? `Add Slot for ${DAYS[selectedDay]}` : "Edit Template Slot"}</DialogTitle>
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
            <Button onClick={handleSaveTemplate} className="bg-gradient-turf text-primary-foreground shadow-turf">
              {modalMode === "add" ? "Create Slot" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
