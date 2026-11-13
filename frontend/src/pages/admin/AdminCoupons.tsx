import { useState, useEffect, useMemo } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  Users,
  Gift,
  Search,
  Loader2,
  Percent,
  Calendar,
  Eye,
  TrendingDown,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { toast } from "sonner";
import api from "@/lib/api";
import { format } from "date-fns";

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "flat" | "percent";
  discount_value: string | number;
  max_discount: string | number | null;
  min_booking_amount: string | number;
  is_first_booking_only: boolean;
  total_usage_limit: number | null;
  used_count: number;
  per_user_limit: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  total_redemptions?: number;
  total_discount_given?: string | number;
}

interface Redemption {
  id: string;
  customer_phone: string;
  customer_name?: string;
  booking_id: string;
  discount_amount: number;
  final_paid_amount: number;
  redeemed_at: string;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "welcome">("all");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Redemptions modal
  const [isRedemptionsOpen, setIsRedemptionsOpen] = useState(false);
  const [selectedCouponForRedemptions, setSelectedCouponForRedemptions] = useState<Coupon | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    discount_type: "flat" as "flat" | "percent",
    discount_value: "100",
    max_discount: "",
    min_booking_amount: "600",
    is_first_booking_only: false,
    total_usage_limit: "",
    per_user_limit: "1",
    valid_until: "",
    is_active: true,
  });

  const fetchCoupons = async () => {
    try {
      const res = await api.get('/coupons');
      setCoupons(res.data);
    } catch (err) {
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      title: "",
      description: "",
      discount_type: "flat",
      discount_value: "100",
      max_discount: "",
      min_booking_amount: "600",
      is_first_booking_only: false,
      total_usage_limit: "",
      per_user_limit: "1",
      valid_until: "",
      is_active: true,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      max_discount: coupon.max_discount ? String(coupon.max_discount) : "",
      min_booking_amount: String(coupon.min_booking_amount || 0),
      is_first_booking_only: Boolean(coupon.is_first_booking_only),
      total_usage_limit: coupon.total_usage_limit ? String(coupon.total_usage_limit) : "",
      per_user_limit: String(coupon.per_user_limit || 1),
      valid_until: coupon.valid_until ? coupon.valid_until.substring(0, 10) : "",
      is_active: coupon.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.title.trim() || !formData.discount_value) {
      toast.error("Code, title, and discount value are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value),
        max_discount: formData.max_discount ? Number(formData.max_discount) : null,
        min_booking_amount: Number(formData.min_booking_amount) || 0,
        is_first_booking_only: formData.is_first_booking_only,
        total_usage_limit: formData.total_usage_limit ? parseInt(formData.total_usage_limit, 10) : null,
        per_user_limit: parseInt(formData.per_user_limit, 10) || 1,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        await api.patch(`/coupons/${editingCoupon.id}`, payload);
        toast.success("Coupon updated successfully");
      } else {
        await api.post('/coupons', payload);
        toast.success(`Coupon ${payload.code} created successfully`);
      }

      setIsFormOpen(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save coupon");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      // Optimistic update
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
      await api.patch(`/coupons/${coupon.id}/toggle`);
      toast.success(`${coupon.code} is now ${!coupon.is_active ? 'Active' : 'Inactive'}`);
    } catch (err) {
      toast.error("Failed to toggle coupon status");
      fetchCoupons();
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Are you sure you want to delete coupon '${coupon.code}'? Existing redemptions will be preserved.`)) {
      return;
    }

    try {
      await api.delete(`/coupons/${coupon.id}`);
      toast.success(`Coupon ${coupon.code} deleted`);
      fetchCoupons();
    } catch (err) {
      toast.error("Failed to delete coupon");
    }
  };

  const openRedemptionsModal = async (coupon: Coupon) => {
    setSelectedCouponForRedemptions(coupon);
    setIsRedemptionsOpen(true);
    setLoadingRedemptions(true);
    try {
      const res = await api.get(`/coupons/${coupon.id}/redemptions`);
      setRedemptions(res.data);
    } catch (err) {
      toast.error("Failed to load redemptions");
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success(`Code ${text} copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter(c => c.is_active).length;
    const welcome = coupons.find(c => c.is_first_booking_only && c.is_active);
    const redemptionsCount = coupons.reduce((acc, c) => acc + (Number(c.total_redemptions) || c.used_count || 0), 0);
    const totalDiscount = coupons.reduce((acc, c) => acc + (Number(c.total_discount_given) || 0), 0);

    return { total, active, welcome, redemptionsCount, totalDiscount };
  }, [coupons]);

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter(c => {
      const matchesSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterType === "active") return c.is_active;
      if (filterType === "welcome") return c.is_first_booking_only;
      return true;
    });
  }, [coupons, searchQuery, filterType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Tag className="w-8 h-8 text-primary" /> Coupons & Offers Hub
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure mobile-verified first-time welcome offers and launch festival promo campaigns.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-gradient-turf text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Coupon
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Active Coupons</CardDescription>
            <CardTitle className="text-2xl font-black text-foreground flex items-center justify-between">
              {stats.active} <span className="text-xs font-medium text-muted-foreground">of {stats.total} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Available across web checkout
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Welcome Offer</CardDescription>
            <CardTitle className="text-2xl font-black text-[#39FF14] flex items-center justify-between">
              {stats.welcome ? `₹${Number(stats.welcome.discount_value)} OFF` : "Disabled"}
              <Gift className="w-5 h-5 text-[#39FF14]" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {stats.welcome ? `Code: ${stats.welcome.code} (1st match)` : "No active 1st match offer"}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Total Redemptions</CardDescription>
            <CardTitle className="text-2xl font-black text-foreground flex items-center justify-between">
              {stats.redemptionsCount}
              <Users className="w-5 h-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Player match reservations
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Player Savings Given</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-400 flex items-center justify-between">
              ₹{Number(stats.totalDiscount).toLocaleString('en-IN')}
              <TrendingDown className="w-5 h-5 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Total marketing discount subsidy
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coupon code or title..."
            className="pl-9 bg-card border-border h-9 text-xs"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
            className="text-xs font-semibold h-8"
          >
            All ({coupons.length})
          </Button>
          <Button
            size="sm"
            variant={filterType === "active" ? "default" : "outline"}
            onClick={() => setFilterType("active")}
            className="text-xs font-semibold h-8"
          >
            Active ({stats.active})
          </Button>
          <Button
            size="sm"
            variant={filterType === "welcome" ? "default" : "outline"}
            onClick={() => setFilterType("welcome")}
            className="text-xs font-semibold h-8"
          >
            Welcome Only
          </Button>
        </div>
      </div>

      {/* Coupons List Table */}
      <Card className="border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Coupon Code</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Offer Title</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Discount Value</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Rules & Eligibility</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Usage / Limit</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Loading coupons...</p>
                  </TableCell>
                </TableRow>
              ) : filteredCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-foreground">No coupons found</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first promo code or adjust your search.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCoupons.map((coupon) => (
                  <TableRow key={coupon.id} className="hover:bg-secondary/10 transition-colors">
                    {/* Code */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 tracking-wider">
                          {coupon.code}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(coupon.code)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Copy Code"
                        >
                          {copiedCode === coupon.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </TableCell>

                    {/* Title & Description */}
                    <TableCell>
                      <div>
                        <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          {coupon.title}
                          {coupon.is_first_booking_only && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold">
                              1st Match
                            </Badge>
                          )}
                        </p>
                        {coupon.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{coupon.description}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Discount Value */}
                    <TableCell>
                      <span className="font-bold text-sm text-foreground">
                        {coupon.discount_type === 'flat'
                          ? `₹${Number(coupon.discount_value)} OFF`
                          : `${Number(coupon.discount_value)}% OFF`}
                      </span>
                      {coupon.discount_type === 'percent' && coupon.max_discount && (
                        <p className="text-[10px] text-muted-foreground">Max ₹{Number(coupon.max_discount)}</p>
                      )}
                    </TableCell>

                    {/* Rules */}
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <p className="text-muted-foreground text-[11px]">
                          Min: <strong className="text-foreground">₹{Number(coupon.min_booking_amount)}</strong>
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          Per mobile: <strong className="text-foreground">{coupon.per_user_limit}x</strong>
                        </p>
                      </div>
                    </TableCell>

                    {/* Usage */}
                    <TableCell>
                      <div className="text-xs">
                        <span className="font-bold text-foreground">{coupon.used_count || coupon.total_redemptions || 0}</span>
                        <span className="text-muted-foreground">
                          {coupon.total_usage_limit ? ` / ${coupon.total_usage_limit}` : " used"}
                        </span>
                        {coupon.total_usage_limit && (
                          <div className="w-20 h-1.5 bg-secondary rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(100, ((coupon.used_count || 0) / coupon.total_usage_limit) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={coupon.is_active}
                          onCheckedChange={() => handleToggleActive(coupon)}
                        />
                        <span className={`text-[11px] font-bold ${coupon.is_active ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openRedemptionsModal(coupon)}
                          title="View Redemptions"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditModal(coupon)}
                          title="Edit Coupon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(coupon)}
                          title="Delete Coupon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create / Edit Coupon Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create New Coupon Code"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure promo codes, welcome discounts, and redemption limitations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCoupon} className="space-y-4 py-2">
            {/* Code & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Coupon Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                  placeholder="e.g. DIWALI100"
                  disabled={!!editingCoupon}
                  maxLength={25}
                  required
                  className="font-mono uppercase font-bold text-sm bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Offer Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Diwali Dhamaka Offer"
                  required
                  className="text-xs bg-background border-border"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief explanation shown on checkout..."
                rows={2}
                className="text-xs bg-background border-border resize-none"
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Type *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(val: "flat" | "percent") => setFormData({ ...formData, discount_type: val })}
                >
                  <SelectTrigger className="text-xs bg-background border-border h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat ₹ (Rupees)</SelectItem>
                    <SelectItem value="percent">Percentage %</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">
                  {formData.discount_type === 'flat' ? 'Discount (₹) *' : 'Discount (%) *'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={formData.discount_type === 'percent' ? 90 : 2000}
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  required
                  className="text-xs font-bold bg-background border-border h-9"
                />
              </div>

              {formData.discount_type === 'percent' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider">Max Cap (₹)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.max_discount}
                    onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                    placeholder="e.g. 200"
                    className="text-xs bg-background border-border h-9"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Min Booking (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={formData.min_booking_amount}
                  onChange={(e) => setFormData({ ...formData, min_booking_amount: e.target.value })}
                  placeholder="e.g. 600"
                  className="text-xs bg-background border-border h-9"
                />
              </div>
            </div>

            {/* Limits & First-Time Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Total Usage Limit</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.total_usage_limit}
                  onChange={(e) => setFormData({ ...formData, total_usage_limit: e.target.value })}
                  placeholder="Blank for unlimited"
                  className="text-xs bg-background border-border h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Per User Limit</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.per_user_limit}
                  onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
                  placeholder="1 per mobile number"
                  className="text-xs bg-background border-border h-9"
                />
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Valid Until (Optional)</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                className="text-xs bg-background border-border h-9"
              />
            </div>

            {/* Checkbox: First Booking Only */}
            <div className="p-3 rounded-xl bg-secondary/30 border border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#39FF14]" /> First-Time Booking Only
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Valid only for new players with 0 prior turf bookings (tied strictly to mobile number).
                </p>
              </div>
              <Switch
                checked={formData.is_first_booking_only}
                onCheckedChange={(checked) => setFormData({ ...formData, is_first_booking_only: checked })}
              />
            </div>

            {/* Checkbox: Active */}
            <div className="p-3 rounded-xl bg-secondary/30 border border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Active Status</p>
                <p className="text-[11px] text-muted-foreground">Allow players to redeem this coupon immediately.</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-turf text-primary-foreground font-bold text-xs"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editingCoupon ? "Save Changes" : "Create Coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Redemptions History Dialog */}
      <Dialog open={isRedemptionsOpen} onOpenChange={setIsRedemptionsOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Redemptions for: <span className="font-mono text-primary">{selectedCouponForRedemptions?.code}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              History of all players who applied this coupon code at checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {loadingRedemptions ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-muted-foreground mt-2">Loading redemption history...</p>
              </div>
            ) : redemptions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold">No redemptions yet</p>
                <p className="text-[11px] mt-1">This code has not been redeemed by any players yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase font-bold">Player Mobile</TableHead>
                    <TableHead className="text-xs uppercase font-bold">Customer</TableHead>
                    <TableHead className="text-xs uppercase font-bold">Discount</TableHead>
                    <TableHead className="text-xs uppercase font-bold">Paid</TableHead>
                    <TableHead className="text-xs uppercase font-bold text-right">Redeemed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-bold text-xs text-foreground">
                        {r.customer_phone}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.customer_name || "Guest Player"}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-emerald-400">
                        -₹{Number(r.discount_amount)}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-foreground">
                        ₹{Number(r.final_paid_amount)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.redeemed_at ? format(new Date(r.redeemed_at), "dd MMM yyyy, hh:mm a") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedemptionsOpen(false)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
