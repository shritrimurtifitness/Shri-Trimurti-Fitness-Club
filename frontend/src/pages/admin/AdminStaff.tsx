import { useState, useEffect } from "react";
import { UserPlus, Trash2, Edit3, Shield, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

const PERMISSION_GROUPS = [
  {
    category: "Overview",
    tabs: [
      { path: "/admin", label: "Dashboard" },
      { path: "/admin/scan", label: "Scan Entry" },
      { path: "/admin/presence", label: "Live Presence" },

    ]
  },
  {
    category: "Finance",
    tabs: [
      { path: "/admin/analytics", label: "Analytics" },
      { path: "/admin/finance", label: "Finance" },
    ]
  },
  {
    category: "Management",
    tabs: [
      { path: "/admin/calendar", label: "Calendar" },
      { path: "/admin/bookings", label: "Bookings" },
      { path: "/admin/slots", label: "Daily Slots" },
      { path: "/admin/tables", label: "Live Tables" },
      { path: "/admin/schedules", label: "Weekly Schedule" },
      { path: "/admin/pricing", label: "Pricing Plans" },
      { path: "/admin/facilities", label: "Sports Events" },
      { path: "/admin/tournaments", label: "Tournaments" },
    ]
  },
  {
    category: "Marketing",
    tabs: [
      { path: "/admin/gallery", label: "Gallery" },
      { path: "/admin/testimonials", label: "Testimonials" },
      { path: "/admin/ads", label: "Ad Studio" },
    ]
  },
  {
    category: "System",
    tabs: [
      { path: "/admin/audit-logs", label: "Audit Logs" },
      { path: "/admin/settings", label: "Settings Hub" },
    ]
  }
];

const ALL_TABS = PERMISSION_GROUPS.flatMap(g => g.tabs);

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  allowed_tabs: string[];
  created_at: string;
}

export default function AdminStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);

  const fetchStaff = async () => {
    try {
      const res = await api.get("/staff");
      setStaff(res.data);
    } catch { toast.error("Failed to load staff"); }
  };

  useEffect(() => { fetchStaff(); }, []);

  const openAdd = () => {
    setEditingStaff(null);
    setName(""); setEmail(""); setPhone(""); setPassword(""); setPin("");
    setSelectedTabs(["/admin"]);
    setIsDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditingStaff(s);
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone);
    setPassword("");
    setPin("");
    setSelectedTabs(s.allowed_tabs || []);
    setIsDialogOpen(true);
  };

  const toggleTab = (path: string) => {
    if (path === "/admin") return; // Dashboard always on
    setSelectedTabs(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) return toast.error("Name and email are required");
    if (!editingStaff && !password) return toast.error("Password is required for new staff");

    try {
      if (editingStaff) {
        await api.patch(`/staff/${editingStaff.id}`, {
          name, email, phone, allowed_tabs: selectedTabs,
          ...(password ? { password } : {}),
          ...(pin ? { pin } : {})
        });
        toast.success("Staff updated!");
      } else {
        if (!pin) return toast.error("PIN is required for new staff");
        if (!/^\d{6}$/.test(pin)) return toast.error("PIN must be 6 digits");
        await api.post("/staff", { name, email, phone, password, pin, allowed_tabs: selectedTabs });
        toast.success("Staff account created!");
      }
      setIsDialogOpen(false);
      fetchStaff();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save");
    }
  };

  const handleDelete = (id: string, staffName: string) => {
    toast(`Delete staff "${staffName}"? This cannot be undone.`, {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/staff/${id}`);
            toast.success("Staff deleted");
            fetchStaff();
          } catch { toast.error("Failed to delete"); }
        }
      },
      cancel: { label: "Cancel", onClick: () => { } }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Staff Management</h2>
          <p className="text-sm text-muted-foreground">Create staff accounts and manage their dashboard access.</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-turf text-primary-foreground shadow-turf">
          <UserPlus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </div>

      {/* Staff List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map(s => (
          <div key={s.id} className="rounded-xl bg-card border border-border p-5 hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="flex gap-1">
                {(s as any).has_pin && (
                  <Badge variant="outline" className="h-8 px-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] uppercase font-black tracking-tighter">
                    PIN Active
                  </Badge>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(s)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id, s.name)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <h4 className="font-heading font-semibold text-foreground">{s.name}</h4>
            <p className="text-xs text-muted-foreground mb-1">{s.email}</p>
            {s.phone && <p className="text-xs text-muted-foreground font-mono mb-3">{s.phone}</p>}
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
              {(s.allowed_tabs || []).map(tab => {
                const label = ALL_TABS.find(t => t.path === tab)?.label || tab;
                return (
                  <Badge key={tab} variant="outline" className="text-[10px] px-1.5 py-0.5 text-primary border-primary/20">
                    {label}
                  </Badge>
                );
              })}
              {(!s.allowed_tabs || s.allowed_tabs.length === 0) && (
                <span className="text-[10px] text-muted-foreground italic">No tabs assigned</span>
              )}
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No staff accounts yet. Click "Add Staff" to create one.
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff" : "Add New Staff"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@email.com" type="email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {editingStaff ? "New Password (Optional)" : "Password"}
                </Label>
                <div className="relative">
                  <Input value={password} onChange={e => setPassword(e.target.value)} placeholder={editingStaff ? "••••••••" : "Create password"} type={showPassword ? "text" : "password"} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {editingStaff ? "New 6-Digit PIN (Optional)" : "6-Digit PIN"}
                </Label>
                <Input
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={editingStaff ? "••••••" : "123456"}
                  maxLength={6}
                />
              </div>
            </div>

            {/* Tab Permissions Grouped */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Tab Access Permissions</Label>
              </div>
              <div className="space-y-6">
                {PERMISSION_GROUPS.map(group => {
                  const categoryTabs = group.tabs.map(t => t.path);
                  const allSelected = categoryTabs.every(t => selectedTabs.includes(t));
                  const isDashboardGroup = group.category === "Overview";

                  return (
                    <div key={group.category} className="space-y-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black uppercase text-primary/70 tracking-widest">{group.category}</span>
                        {!isDashboardGroup && (
                          <button
                            type="button"
                            onClick={() => {
                              if (allSelected) {
                                setSelectedTabs(prev => prev.filter(t => !categoryTabs.includes(t) || t === "/admin"));
                              } else {
                                setSelectedTabs(prev => [...new Set([...prev, ...categoryTabs])]);
                              }
                            }}
                            className="text-[9px] font-bold text-primary hover:underline"
                          >
                            {allSelected ? "Deselect All" : "Select All"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.tabs.map(tab => {
                          const isSelected = selectedTabs.includes(tab.path);
                          const isDashboard = tab.path === "/admin";
                          return (
                            <button key={tab.path} type="button"
                              onClick={() => toggleTab(tab.path)}
                              disabled={isDashboard}
                              className={`text-left px-3 py-2.5 rounded-lg border text-[11px] font-semibold transition-all group ${isDashboard ? "bg-primary/10 border-primary/30 text-primary cursor-default" :
                                  isSelected ? "bg-primary/20 border-primary/40 text-primary shadow-sm" :
                                    "bg-card border-border text-muted-foreground hover:border-primary/20 hover:bg-secondary/50"
                                }`}>
                              <span className="flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected || isDashboard ? "bg-primary border-primary" : "border-muted-foreground/30 bg-background"
                                  }`}>
                                  {(isSelected || isDashboard) && <span className="text-primary-foreground text-[8px] font-bold">✓</span>}
                                </span>
                                {tab.label}
                                {isDashboard && <span className="text-[8px] opacity-60 ml-auto">Fixed</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} className="flex-1 bg-gradient-turf text-primary-foreground shadow-turf">
              {editingStaff ? "Update Staff" : "Create Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
