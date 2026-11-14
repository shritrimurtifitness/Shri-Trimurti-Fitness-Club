import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud, Clock } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { format } from "date-fns";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Tournament } from "./AdminTournaments";

interface Props {
  initialData: Tournament | null;
  onSuccess: () => void;
}

export default function AdminTournamentForm({ initialData, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const formatDateForInput = (isoDate?: string | null) => {
    if (!isoDate) return "";
    try {
      return format(new Date(isoDate), "yyyy-MM-dd'T'HH:mm");
    } catch {
      return "";
    }
  };

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    sport_type: initialData?.sport_type || "football",
    description: initialData?.description || "",
    rules: initialData?.rules || "",
    entry_fee: initialData?.entry_fee || "",
    prize: initialData?.prize || "",
    start_date: formatDateForInput(initialData?.start_date),
    end_date: formatDateForInput(initialData?.end_date),
    max_teams: initialData?.max_teams || 16,
    banner_image: initialData?.banner_image || "",
    is_featured: initialData?.is_featured ?? false,
    show_on_homepage: initialData?.show_on_homepage ?? true,
    display_priority: initialData?.display_priority || 0,
    display_start_date: formatDateForInput(initialData?.display_start_date),
    display_end_date: formatDateForInput(initialData?.display_end_date),
    is_active: initialData?.is_active ?? true,
    is_full_day: initialData?.is_full_day ?? false,
    daily_start_time: initialData?.daily_start_time || "18:00",
    daily_end_time: initialData?.daily_end_time || "23:00",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const body = new FormData();
    body.append("image", file);

    try {
      const res = await api.post("/tournaments/upload", body, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data?.secure_url) {
        setFormData(prev => ({ ...prev, banner_image: res.data.secure_url }));
        toast.success("Image uploaded!");
      }
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        display_start_date: formData.display_start_date ? new Date(formData.display_start_date).toISOString() : null,
        display_end_date: formData.display_end_date ? new Date(formData.display_end_date).toISOString() : null,
      };

      if (initialData?.id) {
        await api.put(`/tournaments/${initialData.id}`, payload);
        toast.success("Tournament updated!");
      } else {
        await api.post('/tournaments', payload);
        toast.success("Tournament created!");
      }
      onSuccess();
    } catch {
      toast.error("Failed to save tournament");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      {/* Banner Upload */}
      <div className="space-y-2">
        <Label>Promotional Banner</Label>
        <div className="flex items-center gap-4">
          <div className="h-32 w-48 shrink-0 bg-muted rounded-xl flex items-center justify-center overflow-hidden border border-dashed border-border">
            {formData.banner_image ? (
              <img src={formData.banner_image} className="w-full h-full object-cover" alt="Banner preview" />
            ) : (
              <span className="text-muted-foreground text-xs">No image chosen</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 bg-secondary text-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg transition-colors border border-border w-fit font-semibold text-sm">
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploadingImage ? "Uploading..." : "Upload New Image"}
              </div>
            </Label>
            <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            <p className="text-xs text-muted-foreground">Upload a vibrant 16:9 image to attract teams. (Uses Cloudinary)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tournament Name</Label>
          <Input name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Summer Cup 2026" />
        </div>
        <div className="space-y-2">
          <Label>Sport Type</Label>
          <Input name="sport_type" value={formData.sport_type} onChange={handleChange} required placeholder="e.g. Football" />
        </div>

        <div className="space-y-2">
          <Label>Event Start Date</Label>
          <DateTimePicker 
            date={formData.start_date} 
            onChange={(d) => setFormData(prev => ({ ...prev, start_date: d }))} 
            placeholder="Select start date & time"
          />
        </div>
        <div className="space-y-2">
          <Label>Event End Date</Label>
          <DateTimePicker 
            date={formData.end_date} 
            onChange={(d) => setFormData(prev => ({ ...prev, end_date: d }))} 
            placeholder="Select end date & time"
          />
        </div>

        <div className="space-y-2">
          <Label>Entry Fee (₹)</Label>
          <Input type="number" name="entry_fee" value={formData.entry_fee} onChange={handleChange} required min={0} />
        </div>
        <div className="space-y-2">
          <Label>Max Teams Allowed</Label>
          <Input type="number" name="max_teams" value={formData.max_teams} onChange={handleChange} required min={2} />
        </div>
      </div>

      {/* Turf Slot Booking & Daily Schedule */}
      <div className="bg-muted/40 p-4 sm:p-5 rounded-xl border border-border space-y-4">
        <div>
          <Label className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Clock className="w-4 h-4 text-primary" /> Turf Slot Booking & Daily Schedule
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Decide whether this tournament closes the turf completely all day, or only reserves specific hours (e.g. evening).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => setFormData(prev => ({ ...prev, is_full_day: false }))}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              !formData.is_full_day
                ? "bg-primary/10 border-primary shadow-sm"
                : "bg-background border-border hover:border-border/80 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-foreground">Specific Daily Hours</span>
              <span className={`w-3 h-3 rounded-full flex items-center justify-center ${!formData.is_full_day ? "bg-primary" : "border border-muted-foreground"}`} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Reserves only matching hours (e.g. 6 PM – 11 PM). Other morning/afternoon slots stay open for public bookings!
            </p>
          </div>

          <div
            onClick={() => setFormData(prev => ({ ...prev, is_full_day: true }))}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              formData.is_full_day
                ? "bg-primary/10 border-primary shadow-sm"
                : "bg-background border-border hover:border-border/80 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-foreground">Full Day Lockdown</span>
              <span className={`w-3 h-3 rounded-full flex items-center justify-center ${formData.is_full_day ? "bg-primary" : "border border-muted-foreground"}`} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Entire turf is locked down 24 hours every day of the tournament. No public bookings allowed.
            </p>
          </div>
        </div>

        {!formData.is_full_day && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Quick Presets:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, daily_start_time: "18:00", daily_end_time: "23:00" }))}
                className="h-7 text-xs px-2.5 font-medium"
              >
                Night (6 PM – 11 PM)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, daily_start_time: "06:00", daily_end_time: "12:00" }))}
                className="h-7 text-xs px-2.5 font-medium"
              >
                Morning (6 AM – 12 PM)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, daily_start_time: "16:00", daily_end_time: "22:00" }))}
                className="h-7 text-xs px-2.5 font-medium"
              >
                Evening (4 PM – 10 PM)
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Daily Start Time</Label>
                <Input
                  type="time"
                  name="daily_start_time"
                  value={formData.daily_start_time}
                  onChange={handleChange}
                  required={!formData.is_full_day}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Daily End Time</Label>
                <Input
                  type="time"
                  name="daily_end_time"
                  value={formData.daily_end_time}
                  onChange={handleChange}
                  required={!formData.is_full_day}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Prize Highlights</Label>
        <Input name="prize" value={formData.prize} onChange={handleChange} required placeholder="e.g. ₹50,000 + Trophy" />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Engaging description of the tournament..." />
      </div>

      <div className="space-y-2">
        <Label>Rules & Guidelines</Label>
        <Textarea name="rules" value={formData.rules} onChange={handleChange} rows={4} placeholder="1. 5v5 matches
2. Knockout style..." />
      </div>

      <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
        <h4 className="font-heading font-semibold text-sm">Marketing & Display Controls</h4>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <Switch checked={formData.show_on_homepage} onCheckedChange={(c) => handleSwitchChange("show_on_homepage", c)} />
            <Label>Show on Homepage</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={formData.is_featured} onCheckedChange={(c) => handleSwitchChange("is_featured", c)} />
            <Label className="text-amber-500">Highlight as Featured</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={formData.is_active} onCheckedChange={(c) => handleSwitchChange("is_active", c)} />
            <Label className="text-emerald-500">Currently Active</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Carousel Start Date (Optional)</Label>
            <DateTimePicker 
              date={formData.display_start_date} 
              onChange={(d) => setFormData(prev => ({ ...prev, display_start_date: d }))} 
              placeholder="Start showing on slider"
            />
          </div>
          <div className="space-y-2">
            <Label>Carousel End Date (Optional)</Label>
            <DateTimePicker 
              date={formData.display_end_date} 
              onChange={(d) => setFormData(prev => ({ ...prev, display_end_date: d }))} 
              placeholder="End showing on slider"
            />
          </div>
          <div className="space-y-2">
            <Label>Display Priority Score</Label>
            <Input type="number" name="display_priority" value={formData.display_priority} onChange={handleChange} placeholder="0 = normal, 10 = first" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="submit" disabled={saving || uploadingImage} className="w-full sm:w-auto font-bold px-8">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Tournament"}
        </Button>
      </div>
    </form>
  );
}
