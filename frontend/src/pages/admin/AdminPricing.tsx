import { useState, useEffect } from "react";
import { Plus, Trash2, Star, Pencil, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  unit: string;
  features: string[];
  popular: boolean;
  facility: string;
  sort_order: number;
}

export default function AdminPricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  // Form state
  const [fName, setFName] = useState("");
  const [fSubtitle, setFSubtitle] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fUnit, setFUnit] = useState("/hour");
  const [fFacility, setFFacility] = useState("");
  const [fFeatures, setFFeatures] = useState<string[]>([""]);
  const [fOrder, setFOrder] = useState("0");
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);

  const fetchPlans = async () => {
    try {
      const res = await api.get("/pricing");
      setPlans(res.data);
    } catch { toast.error("Failed to load plans"); }
  };

  useEffect(() => { fetchPlans(); }, []);

  useEffect(() => {
    api.get('/facilities').then(res => {
      const types = [...new Set(res.data.map((f: any) => f.facility_type))] as string[];
      setFacilityTypes(types);
    }).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFName(""); setFSubtitle(""); setFPrice(""); setFUnit("/hour"); setFFacility(""); setFFeatures([""]); setFOrder("0");
    setIsOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setFName(plan.name);
    setFSubtitle(plan.subtitle);
    setFPrice(plan.price);
    setFUnit(plan.unit);
    setFFacility(plan.facility);
    setFFeatures(plan.features.length > 0 ? [...plan.features] : [""]);
    setFOrder(String(plan.sort_order));
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!fName || !fPrice) return toast.error("Name and price are required");
    const features = fFeatures.filter(f => f.trim());
    try {
      if (editing) {
        await api.patch(`/pricing/${editing.id}`, { name: fName, subtitle: fSubtitle, price: fPrice, unit: fUnit, facility: fFacility, features, sort_order: Number(fOrder) });
        toast.success("Plan updated!");
      } else {
        await api.post("/pricing", { name: fName, subtitle: fSubtitle, price: fPrice, unit: fUnit, facility: fFacility, features, sort_order: Number(fOrder) });
        toast.success("Plan created!");
      }
      setIsOpen(false);
      fetchPlans();
    } catch { toast.error("Failed to save plan"); }
  };

  const handleDelete = (id: string) => {
    toast("Delete this pricing plan?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/pricing/${id}`);
            toast.success("Plan deleted");
            fetchPlans();
          } catch {
            toast.error("Failed to delete");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const handlePopular = async (id: string) => {
    try {
      await api.patch(`/pricing/${id}/popular`);
      toast.success("Marked as Most Popular!");
      fetchPlans();
    } catch { toast.error("Failed to update"); }
  };

  const addFeature = () => setFFeatures([...fFeatures, ""]);
  const updateFeature = (i: number, val: string) => { const f = [...fFeatures]; f[i] = val; setFFeatures(f); };
  const removeFeature = (i: number) => { const f = fFeatures.filter((_, idx) => idx !== i); setFFeatures(f.length ? f : [""]); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Pricing Plans</h2>
          <p className="text-sm text-muted-foreground">Manage plans shown on the landing page</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-turf text-primary-foreground shadow-turf">
          <Plus className="w-4 h-4 mr-2" /> Add Plan
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p.id} className={`relative rounded-xl border p-5 transition-all ${
            p.popular ? "bg-card border-primary/50 shadow-turf" : "bg-card border-border hover:border-primary/20"
          }`}>
            {p.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 bg-gradient-turf text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
                  <Star className="w-3 h-3" /> Most Popular
                </span>
              </div>
            )}
            <div className="flex justify-between items-start mb-3 mt-1">
              <div>
                <h4 className="font-heading font-semibold text-foreground">{p.name}</h4>
                <p className="text-xs text-muted-foreground">{p.subtitle}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={() => openEdit(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {!p.popular && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-yellow-500" onClick={() => handlePopular(p.id)} title="Mark as Most Popular">
                    <Star className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="mb-3">
              <span className="font-heading text-2xl font-bold text-foreground">{p.price}</span>
              <span className="text-muted-foreground text-xs">{p.unit}</span>
            </div>
            <ul className="space-y-1.5">
              {p.features.map((f, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
            {p.facility && (
              <p className="text-[10px] text-muted-foreground/60 mt-3 uppercase tracking-wider">Links to: {p.facility}</p>
            )}
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">No pricing plans. Add one above!</div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "Create New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plan Name *</Label>
                <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Cricket Turf" />
              </div>
              <div className="space-y-1.5">
                <Label>Subtitle</Label>
                <Input value={fSubtitle} onChange={e => setFSubtitle(e.target.value)} placeholder="e.g. Per lane, per hour" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Price *</Label>
                <Input value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="₹1,200" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={fUnit} onChange={e => setFUnit(e.target.value)} placeholder="/hour" />
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input type="number" value={fOrder} onChange={e => setFOrder(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Facility Link</Label>
              <select value={fFacility} onChange={e => setFFacility(e.target.value)} className="w-full border border-border bg-background rounded-md h-10 px-3 text-sm">
                <option value="">None</option>
                {facilityTypes.map(ft => (
                  <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Features / Highlights</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addFeature} className="text-primary text-xs h-6 px-2">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              {fFeatures.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={f} onChange={e => updateFeature(i, e.target.value)} placeholder={`Feature ${i + 1}`} className="flex-1" />
                  <Button type="button" size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeFeature(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-gradient-turf text-primary-foreground shadow-turf">
              {editing ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
