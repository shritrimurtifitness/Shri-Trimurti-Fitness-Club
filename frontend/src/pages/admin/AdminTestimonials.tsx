import { useState, useEffect } from "react";
import { Trash2, CheckCircle, XCircle, Star, MessageSquare, Plus, Globe, ShieldCheck, Save, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  status: 'pending' | 'approved';
  is_featured: boolean;
  created_at: string;
  source: 'internal' | 'google';
}

export default function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Landing Page Section Visibility
  const [showTestimonials, setShowTestimonials] = useState<boolean>(true);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<boolean>(false);

  // Form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newText, setNewText] = useState("");
  const [newRating, setNewRating] = useState("5");
  const [newSource, setNewSource] = useState("google");

  // Google Trust state
  const [googleRating, setGoogleRating] = useState("4.6");
  const [googleCount, setGoogleCount] = useState("150");
  const [googleUrl, setGoogleUrl] = useState("");
  const [isUpdatingTrust, setIsUpdatingTrust] = useState(false);

  const fetchTestimonials = async () => {
    try {
      const testRes = await api.get("/testimonials/admin");
      setTestimonials(testRes.data);
    } catch { toast.error("Failed to load testimonials"); }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings/contact");
      setGoogleRating(res.data.google_rating?.toString() || "4.6");
      setGoogleCount(res.data.google_reviews_count?.toString() || "150");
      setGoogleUrl(res.data.google_maps_url || "https://maps.app.goo.gl/XCxniFWMMtnfw2MJA");
      if (typeof res.data.show_testimonials === "boolean") {
        setShowTestimonials(res.data.show_testimonials);
      }
    } catch { console.error("Failed to load trust settings"); }
  };

  useEffect(() => { 
    fetchTestimonials(); 
    fetchSettings();
  }, []);

  useSocket('settings_updated', fetchSettings);

  const handleToggleVisibility = async (newVal?: boolean) => {
    setIsTogglingVisibility(true);
    const targetStatus = typeof newVal === 'boolean' ? newVal : !showTestimonials;
    try {
      const res = await api.patch('/settings/toggle-testimonials', { show_testimonials: targetStatus });
      const newStatus = typeof res.data?.show_testimonials === 'boolean'
        ? res.data.show_testimonials
        : targetStatus;
      setShowTestimonials(newStatus);
      toast.success(newStatus
        ? "Testimonials section is now enabled on the landing page!"
        : "Testimonials section is now hidden from the landing page.");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to update visibility");
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleStatus = async (id: string, status: 'approved' | 'pending') => {
    try {
      await api.patch(`/testimonials/${id}/status`, { status });
      toast.success(status === 'approved' ? "Review approved!" : "Moved to pending");
      fetchTestimonials();
    } catch { toast.error("Failed to update status"); }
  };

  const handleToggleFeature = async (id: string) => {
    try {
      await api.patch(`/testimonials/${id}/feature`);
      toast.success("Featured status toggled");
      fetchTestimonials();
    } catch { toast.error("Failed to toggle feature status"); }
  };

  const handleAddReview = async () => {
    if (!newName || !newText) return toast.error("Please fill Name and Review text");
    setIsSubmitting(true);
    try {
      await api.post("/testimonials/admin", {
        name: newName,
        role: newRole,
        text: newText,
        rating: Number(newRating),
        source: newSource,
        status: 'approved'
      });
      toast.success("Review added successfully!");
      setIsOpen(false);
      resetForm();
      fetchTestimonials();
    } catch { toast.error("Failed to add review"); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateTrust = async () => {
    setIsUpdatingTrust(true);
    try {
      await api.put("/settings/contact", {
        google_rating: Number(googleRating),
        google_reviews_count: Number(googleCount),
        google_maps_url: googleUrl
      });
      toast.success("Google Trust data updated!");
    } catch {
      toast.error("Failed to update trust data");
    } finally {
      setIsUpdatingTrust(false);
    }
  };

  const resetForm = () => {
    setNewName(""); setNewRole(""); setNewText(""); setNewRating("5"); setNewSource("google");
  };

  const handleDelete = (id: string) => {
    toast("Delete this review permanently?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/testimonials/${id}`);
            toast.success("Review deleted");
            fetchTestimonials();
          } catch {
            toast.error("Failed to delete review");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const filtered = testimonials.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Testimonials Management</h2>
          <p className="text-sm text-muted-foreground">Approve internal reviews or sync Google reviews</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="bg-gradient-turf text-primary-foreground shadow-turf">
          <Plus className="w-4 h-4 mr-2" /> Add Review
        </Button>
      </div>

      {/* Landing Page Testimonials Visibility Toggle */}
      <div className={`p-4 sm:p-5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        showTestimonials 
          ? 'bg-emerald-500/5 border-emerald-500/20 shadow-sm' 
          : 'bg-zinc-900/40 border-zinc-800'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${
            showTestimonials 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}>
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                Landing Page Testimonials Section
              </h3>
              {showTestimonials ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live on Landing Page
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  Hidden from Landing Page
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control whether the entire Testimonials section (customer reviews & Google trust score) is visible to visitors on the landing page.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center shrink-0 pl-2">
          <span className="text-xs font-semibold text-muted-foreground hidden md:inline">
            {showTestimonials ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={showTestimonials}
            disabled={isTogglingVisibility}
            onCheckedChange={handleToggleVisibility}
            aria-label="Toggle testimonials section visibility on landing page"
          />
        </div>
      </div>

      {/* Google Trust Score Manager */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <Globe className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Google Trust Banner Data</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground italic">Manage your public Google Maps rating and links</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Rating (e.g. 4.9)</Label>
            <Input 
              type="number" step="0.1" max="5" min="0"
              value={googleRating} 
              onChange={e => setGoogleRating(e.target.value)}
              className="bg-background h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Reviews</Label>
            <Input 
              type="number"
              value={googleCount} 
              onChange={e => setGoogleCount(e.target.value)}
              className="bg-background h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Google Maps URL</Label>
            <div className="relative">
              <Input 
                value={googleUrl} 
                onChange={e => setGoogleUrl(e.target.value)}
                className="bg-background pr-10 h-9"
                placeholder="https://maps.app.goo.gl/XCxniFWMMtnfw2MJA"
              />
              <a href={googleUrl} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t border-blue-500/10">
          <Button 
            disabled={isUpdatingTrust}
            onClick={handleUpdateTrust}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 px-6 h-9"
          >
            {isUpdatingTrust ? (
              "Updating..."
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Trust Data
              </span>
            )}
          </Button>
        </div>
      </div>
        <div className="flex bg-secondary/50 p-1 rounded-lg w-full sm:w-auto overflow-x-auto scrollbar-none">
          {(['all', 'pending', 'approved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>


      <div className="grid gap-4">
        {filtered.map((t) => (
          <div key={t.id} className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row gap-5 items-start">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-turf flex items-center justify-center text-primary-foreground font-bold">
                {t.name[0]}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    {t.name}
                    {t.is_featured && (
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20 py-0 text-[10px]">
                        <Star className="w-2.5 h-2.5 mr-1 fill-yellow-500" /> Featured
                      </Badge>
                    )}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t.role || "Player"} • {new Date(t.created_at).toLocaleDateString()}
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase transition-colors inline-flex items-center gap-1 ${
                      t.source === 'google' 
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                        : 'bg-green-500/10 text-green-500 border border-green-500/20'
                    }`}>
                      {t.source === 'google' ? <Globe className="w-2 h-2" /> : <ShieldCheck className="w-2 h-2" />}
                      {t.source || 'internal'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < t.rating ? "text-accent fill-accent" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted-foreground italic">"{t.text}"</p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {t.status === 'pending' ? (
                  <Button size="sm" onClick={() => handleStatus(t.id, 'approved')} className="h-8 bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 px-3">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> <span className="text-xs">Approve</span>
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => handleStatus(t.id, 'pending')} className="h-8 text-muted-foreground px-3">
                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> <span className="text-xs">Pending</span>
                  </Button>
                )}
                
                <Button size="sm" variant="ghost" onClick={() => handleToggleFeature(t.id)} className={`h-8 px-3 ${t.is_featured ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  <Star className={`w-3.5 h-3.5 mr-1.5 ${t.is_featured ? 'fill-yellow-500' : ''}`} /> 
                  <span className="text-xs">{t.is_featured ? 'Unfeature' : 'Feature'}</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="h-8 text-destructive hover:bg-destructive/10 px-3 ml-auto sm:ml-0">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> <span className="text-xs">Delete</span>
                </Button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-xl bg-card/50">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20 text-muted-foreground" />
            <p className="text-muted-foreground">No {filter !== 'all' ? filter : ''} testimonials found.</p>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Add Manual Review</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Rahul S." />
              </div>
              <div className="space-y-1.5">
                <Label>Role / Sport</Label>
                <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g. Cricket Player" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={newSource} onValueChange={setNewSource}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Direct Website</SelectItem>
                  <SelectItem value="google">Google Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Star Rating</Label>
              <Select value={newRating} onValueChange={setNewRating}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5,4,3,2,1].map(s => <SelectItem key={s} value={s.toString()}>{s} Stars</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Review Text *</Label>
              <textarea 
                value={newText} 
                onChange={e => setNewText(e.target.value)} 
                className="w-full min-h-[100px] bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                placeholder="Paste the Google review here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleAddReview} disabled={isSubmitting} className="bg-gradient-turf text-primary-foreground shadow-turf">
              {isSubmitting ? "Adding..." : "Add Approved Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
