import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Users, Trophy, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import { format } from "date-fns";
import AdminTournamentForm from "./AdminTournamentForm";
import AdminTournamentRegistrations from "./AdminTournamentRegistrations";

export interface Tournament {
  id: string;
  name: string;
  sport_type: string;
  description: string;
  rules: string;
  entry_fee: number;
  prize: string;
  start_date: string;
  end_date: string;
  max_teams: number;
  banner_image: string;
  is_featured: boolean;
  show_on_homepage: boolean;
  display_priority: number;
  display_start_date: string;
  display_end_date: string;
  is_active: boolean;
}

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingData, setEditingData] = useState<Tournament | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewRegistrations, setViewRegistrations] = useState<Tournament | null>(null);

  const fetchTournaments = async () => {
    try {
      const res = await api.get('/tournaments/admin');
      setTournaments(res.data);
    } catch {
      toast.error("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTournaments(); }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/tournaments/${deleteConfirm}`);
      toast.success("Tournament deleted");
      fetchTournaments();
    } catch {
      toast.error("Failed to delete tournament");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openEdit = (t: Tournament) => {
    setEditingData(t);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingData(null);
    fetchTournaments();
  };

  if (viewRegistrations) {
    return (
      <AdminTournamentRegistrations
        tournament={viewRegistrations}
        onBack={() => setViewRegistrations(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" /> Tournament Manager
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and promote upcoming sports events
          </p>
        </div>

        <Button
          onClick={() => { setEditingData(null); setFormOpen(true); }}
          className="gap-2 font-bold shadow-lg w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Create Tournament
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No tournaments created yet.</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold">
                  <tr>
                    <th className="px-6 py-4">Promo</th>
                    <th className="px-6 py-4">Name & Sport</th>
                    <th className="px-6 py-4">Dates</th>
                    <th className="px-6 py-4">Fee / Max Teams</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        {t.banner_image ? (
                          <div className="w-20 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                            <img src={t.banner_image} className="w-full h-full object-cover" alt="Banner" />
                          </div>
                        ) : (
                          <div className="w-20 h-12 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground border border-border/50 border-dashed">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-base">{t.name}</div>
                        <div className="text-xs text-muted-foreground uppercase">{t.sport_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-foreground">{format(new Date(t.start_date), "MMM d, yyyy")}</div>
                        <div className="text-muted-foreground text-xs">to {format(new Date(t.end_date), "MMM d, yyyy")}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-emerald-500">₹{t.entry_fee}</div>
                        <div className="text-xs text-muted-foreground">{t.max_teams} Teams limit</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {t.is_active ?
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-500">Active</span>
                            : <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-destructive/10 text-destructive">Inactive</span>}
                          {t.show_on_homepage && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-primary/10 text-primary">On Homepage</span>}
                          {t.is_featured && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-500 flex gap-1 items-center">Featured</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setViewRegistrations(t)}>
                            <Users className="w-3.5 h-3.5" /> Teams
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(t)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteConfirm(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="flex flex-col gap-4 p-4 md:hidden">
              {tournaments.map((t) => (
                <div key={t.id} className="border border-border rounded-xl p-4 space-y-4 bg-muted/20">
                  <div className="flex gap-4">
                    {t.banner_image ? (
                      <div className="w-20 h-20 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                        <img src={t.banner_image} className="w-full h-full object-cover" alt="Banner" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground border border-border/50 border-dashed">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base line-clamp-1">{t.name}</div>
                      <div className="text-xs text-muted-foreground uppercase mb-1">{t.sport_type}</div>
                      <div className="text-xs font-medium text-emerald-500">₹{t.entry_fee} <span className="text-muted-foreground font-normal">• {t.max_teams} Teams Max</span></div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(t.start_date), "MMM d")} - {format(new Date(t.end_date), "MMM d")}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {t.is_active ?
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-500">Active</span>
                      : <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-destructive/10 text-destructive">Inactive</span>}
                    {t.show_on_homepage && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-primary/10 text-primary">On Homepage</span>}
                    {t.is_featured && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-500">Featured</span>}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button variant="outline" size="sm" className="flex-1 h-8 gap-1.5" onClick={() => setViewRegistrations(t)}>
                      <Users className="w-3.5 h-3.5" /> Teams
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5" onClick={() => openEdit(t)}>
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-10 p-0 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteConfirm(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingData ? "Edit Tournament" : "Create New Tournament"}</DialogTitle>
          </DialogHeader>
          <AdminTournamentForm initialData={editingData} onSuccess={handleClose} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will delete the tournament and ALL its active team registrations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
