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
  AlertCircle,
  Lock,
  Globe,
  UserCheck,
  UserPlus,
  MessageCircle,
  ShieldCheck
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
  is_private?: boolean;
  whitelisted_count?: number;
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

interface WhitelistMember {
  id: string;
  coupon_id: string;
  phone: string;
  member_name: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
  updated_at?: string;
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
  const [filterType, setFilterType] = useState<"all" | "public" | "private" | "active" | "welcome">("all");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Redemptions modal
  const [isRedemptionsOpen, setIsRedemptionsOpen] = useState(false);
  const [selectedCouponForRedemptions, setSelectedCouponForRedemptions] = useState<Coupon | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Whitelist modal & management
  const [isWhitelistOpen, setIsWhitelistOpen] = useState(false);
  const [selectedCouponForWhitelist, setSelectedCouponForWhitelist] = useState<Coupon | null>(null);
  const [whitelistMembers, setWhitelistMembers] = useState<WhitelistMember[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberMaxUses, setNewMemberMaxUses] = useState("1");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState("");

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
    is_private: false,
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
      is_private: false,
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
      is_private: Boolean(coupon.is_private),
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
        is_private: formData.is_private,
        total_usage_limit: formData.total_usage_limit ? parseInt(formData.total_usage_limit, 10) : null,
        per_user_limit: parseInt(formData.per_user_limit, 10) || 1,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        await api.patch(`/coupons/${editingCoupon.id}`, payload);
        toast.success("Coupon updated successfully");
      } else {
        const res = await api.post('/coupons', payload);
        toast.success(`Coupon ${payload.code} created successfully`);
        if (payload.is_private && res.data?.id) {
          // Offer immediate prompt to manage whitelist for newly created private coupon
          openWhitelistModal(res.data);
        }
      }

      setIsFormOpen(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save coupon");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Whitelist Management Handlers
  const openWhitelistModal = async (coupon: Coupon) => {
    setSelectedCouponForWhitelist(coupon);
    setIsWhitelistOpen(true);
    setLoadingWhitelist(true);
    setNewMemberPhone("");
    setNewMemberName("");
    setNewMemberMaxUses("1");
    setEditingPhone(null);
    try {
      const res = await api.get(`/coupons/${coupon.id}/whitelist`);
      setWhitelistMembers(res.data);
    } catch (err) {
      toast.error("Failed to load coupon whitelist");
    } finally {
      setLoadingWhitelist(false);
    }
  };

  const handleAddWhitelistMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCouponForWhitelist) return;

    const cleanPhone = newMemberPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    const limitVal = newMemberMaxUses.trim() === "" ? null : parseInt(newMemberMaxUses, 10);
    if (limitVal !== null && (isNaN(limitVal) || limitVal < 1)) {
      toast.error("Limit must be at least 1 or left blank for unlimited");
      return;
    }

    setIsAddingMember(true);
    try {
      await api.post(`/coupons/${selectedCouponForWhitelist.id}/whitelist`, {
        phone: cleanPhone,
        member_name: newMemberName.trim() || null,
        max_uses: limitVal,
      });
      toast.success(`+91 ${cleanPhone} added to whitelist!`);
      setNewMemberPhone("");
      setNewMemberName("");
      setNewMemberMaxUses("1");

      const res = await api.get(`/coupons/${selectedCouponForWhitelist.id}/whitelist`);
      setWhitelistMembers(res.data);
      setCoupons(prev => prev.map(c => c.id === selectedCouponForWhitelist.id ? { ...c, is_private: true, whitelisted_count: res.data.length } : c));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add member to whitelist");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveWhitelistMember = async (phone: string) => {
    if (!selectedCouponForWhitelist) return;
    try {
      await api.delete(`/coupons/${selectedCouponForWhitelist.id}/whitelist/${phone}`);
      toast.success(`Removed +91 ${phone} from whitelist`);
      setWhitelistMembers(prev => prev.filter(m => m.phone !== phone));
      setCoupons(prev => prev.map(c => c.id === selectedCouponForWhitelist.id ? { ...c, whitelisted_count: Math.max(0, (c.whitelisted_count || 1) - 1) } : c));
    } catch (err) {
      toast.error("Failed to remove member from whitelist");
    }
  };

  const handleSaveMemberLimit = async (phone: string) => {
    if (!selectedCouponForWhitelist) return;
    const limitVal = editLimitValue.trim() === "" ? null : parseInt(editLimitValue, 10);
    if (limitVal !== null && (isNaN(limitVal) || limitVal < 1)) {
      toast.error("Limit must be at least 1 or left blank for unlimited");
      return;
    }

    try {
      const res = await api.patch(`/coupons/${selectedCouponForWhitelist.id}/whitelist/${phone}`, {
        max_uses: limitVal,
      });
      toast.success(`Limit updated for +91 ${phone}`);
      setWhitelistMembers(prev => prev.map(m => m.phone === phone ? { ...m, max_uses: res.data.max_uses } : m));
      setEditingPhone(null);
    } catch (err) {
      toast.error("Failed to update redemption limit");
    }
  };

  const getWhatsAppShareLink = (coupon: Coupon, member: WhitelistMember) => {
    const discountText = coupon.discount_type === 'flat' ? `Flat ₹${Number(coupon.discount_value)} OFF` : `${Number(coupon.discount_value)}% OFF`;
    const nameGreeting = member.member_name ? `Hey ${member.member_name}!` : "Hey Captain!";
    const text = `${nameGreeting} 🏏 Here is your exclusive private coupon: *${coupon.code}* for ${discountText} on Cricket Turf / Football Turf at Shri Trimurti Fitness Club.\n\n🔒 *Note:* This secret code is valid exclusively for your mobile number (${member.phone}). Book your slot now!`;
    return `https://api.whatsapp.com/send?phone=91${member.phone}&text=${encodeURIComponent(text)}`;
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
    const publicCount = coupons.filter(c => !c.is_private).length;
    const privateCount = coupons.filter(c => c.is_private).length;
    const welcome = coupons.find(c => c.is_first_booking_only && c.is_active && !c.is_private);
    const redemptionsCount = coupons.reduce((acc, c) => acc + (Number(c.total_redemptions) || c.used_count || 0), 0);
    const totalDiscount = coupons.reduce((acc, c) => acc + (Number(c.total_discount_given) || 0), 0);

    return { total, active, publicCount, privateCount, welcome, redemptionsCount, totalDiscount };
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
      if (filterType === "public") return !c.is_private;
      if (filterType === "private") return Boolean(c.is_private);
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

        <div className="flex flex-wrap gap-2 w-full sm:w-auto overflow-x-auto pb-1 scrollbar-none">
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
            variant={filterType === "public" ? "default" : "outline"}
            onClick={() => setFilterType("public")}
            className="text-xs font-semibold h-8 gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" /> Public ({stats.publicCount})
          </Button>
          <Button
            size="sm"
            variant={filterType === "private" ? "default" : "outline"}
            onClick={() => setFilterType("private")}
            className="text-xs font-semibold h-8 gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-purple-400" /> Private VIP ({stats.privateCount})
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

      {/* Coupons List */}
      <Card className="border-border/60 bg-card overflow-hidden">
        {/* Mobile View: Responsive Cards */}
        <div className="md:hidden divide-y divide-border/50">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground mt-2">Loading coupons...</p>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground p-4">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-foreground">No coupons found</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first promo code or adjust your search.</p>
            </div>
          ) : (
            filteredCoupons.map((coupon) => (
              <div key={coupon.id} className="p-4 space-y-3 bg-card hover:bg-secondary/10 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-extrabold text-sm px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 tracking-wider">
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

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {coupon.is_private ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/40 text-purple-300 bg-purple-500/10 font-bold flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-purple-400" /> Private VIP
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-300 bg-blue-500/10 font-bold flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5 text-blue-400" /> Public
                        </Badge>
                      )}
                      {coupon.is_first_booking_only && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold">
                          1st Match
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={() => handleToggleActive(coupon)}
                    />
                    <span className={`text-[11px] font-bold ${coupon.is_active ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {coupon.is_active ? 'Active' : 'Off'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-foreground">{coupon.title}</h4>
                  {coupon.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{coupon.description}</p>
                  )}
                </div>

                {/* Value & Rules Pill */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Discount</span>
                    <span className="font-extrabold text-sm text-foreground">
                      {coupon.discount_type === 'flat' ? `₹${Number(coupon.discount_value)} OFF` : `${Number(coupon.discount_value)}% OFF`}
                    </span>
                    {coupon.discount_type === 'percent' && coupon.max_discount && (
                      <span className="text-[10px] text-muted-foreground block">Max ₹{Number(coupon.max_discount)}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Usage & Min Order</span>
                    <span className="font-medium text-foreground block">
                      Min: <strong className="text-foreground">₹{Number(coupon.min_booking_amount)}</strong>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Used: <strong className="text-foreground">{coupon.used_count || 0}</strong>
                      {coupon.total_usage_limit ? ` / ${coupon.total_usage_limit}` : ''}
                    </span>
                  </div>
                </div>

                {/* Whitelist pill if private */}
                {coupon.is_private && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openWhitelistModal(coupon)}
                    className="w-full h-8 text-xs font-bold border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 gap-1.5 rounded-lg"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                    Manage Whitelist ({coupon.whitelisted_count || 0} Members)
                  </Button>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openRedemptionsModal(coupon)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-primary gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Redemptions
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(coupon)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(coupon)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-red-400 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
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
                      <div className="space-y-1.5">
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
                        <div>
                          {coupon.is_private ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/40 text-purple-300 bg-purple-500/10 font-bold flex items-center gap-1 w-fit">
                              <Lock className="w-2.5 h-2.5 text-purple-400" /> Private VIP
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-300 bg-blue-500/10 font-bold flex items-center gap-1 w-fit">
                              <Globe className="w-2.5 h-2.5 text-blue-400" /> Public
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Title & Description */}
                    <TableCell>
                      <div>
                        <p className="font-bold text-xs text-foreground flex items-center gap-1.5 flex-wrap">
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
                        {coupon.is_private && (
                          <div className="mt-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openWhitelistModal(coupon)}
                              className="h-6 px-2 text-[10px] font-bold border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 gap-1 rounded-md"
                            >
                              <UserCheck className="w-3 h-3 text-purple-400" />
                              {coupon.whitelisted_count || 0} Whitelisted Members
                            </Button>
                          </div>
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
                        {coupon.is_private && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openWhitelistModal(coupon)}
                            title="Manage Whitelist & WhatsApp Invites"
                            className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] flex flex-col p-4 sm:p-6 bg-card border-border overflow-hidden rounded-2xl">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">{editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create New Coupon Code"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure promo codes, welcome discounts, and redemption limitations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCoupon} className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-3.5 py-2 scrollbar-thin">
              {/* Code & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Coupon Code *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                    placeholder="e.g. DIWALI100"
                    disabled={!!editingCoupon}
                    maxLength={25}
                    required
                    className="font-mono uppercase font-bold text-xs bg-background border-border h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Offer Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Diwali Dhamaka Offer"
                    required
                    className="text-xs bg-background border-border h-9"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider">Description (Optional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief explanation shown on checkout..."
                  rows={2}
                  className="text-xs bg-background border-border resize-none"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Type *</Label>
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

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
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
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold uppercase tracking-wider">Max Cap (₹)</Label>
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

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Min Booking (₹)</Label>
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

              {/* Limits */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Total Usage Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.total_usage_limit}
                    onChange={(e) => setFormData({ ...formData, total_usage_limit: e.target.value })}
                    placeholder="Blank for unlimited"
                    className="text-xs bg-background border-border h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Per User Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.per_user_limit}
                    onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
                    placeholder="1 per number"
                    className="text-xs bg-background border-border h-9"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider">Valid Until (Optional)</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="text-xs bg-background border-border h-9"
                />
              </div>

              {/* Checkbox: First Booking Only */}
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-[#39FF14]" /> First-Time Booking Only
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Valid only for new players with 0 prior turf bookings.
                  </p>
                </div>
                <Switch
                  checked={formData.is_first_booking_only}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_first_booking_only: checked })}
                />
              </div>

              {/* Checkbox: Active */}
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-foreground">Active Status</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Allow players to redeem this coupon immediately.</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              {/* Checkbox: Private VIP / Closed-Group Only */}
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-400" /> Private VIP (Closed-Group Only)
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Hidden from public UI and website offers. Only authorized whitelisted mobile numbers can redeem.
                  </p>
                </div>
                <Switch
                  checked={formData.is_private}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
                />
              </div>

              {formData.is_private && (
                <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-purple-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs">Stealth Whitelist Gating</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Outsiders who attempt this code receive a generic &apos;Invalid coupon code&apos; rejection. Authorized phone numbers and per-member limits can be managed anytime via the Whitelist button.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-border/50 shrink-0 flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="text-xs h-9">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-turf text-primary-foreground font-bold text-xs h-9 px-4"
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6 bg-card border-border overflow-hidden rounded-2xl">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">Redemptions for: <span className="font-mono text-primary">{selectedCouponForRedemptions?.code}</span></span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              History of all players who applied this coupon code at checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
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

      {/* Whitelist Management Dialog */}
      <Dialog open={isWhitelistOpen} onOpenChange={setIsWhitelistOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] flex flex-col p-4 sm:p-6 bg-card border-border overflow-hidden rounded-2xl">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-400 shrink-0" />
              <span className="truncate">Whitelist for: <span className="font-mono text-primary">{selectedCouponForWhitelist?.code}</span></span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Only phone numbers added here can redeem this private coupon. Outsiders get a stealth &apos;Invalid coupon code&apos; error.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 py-2 scrollbar-thin">
            {/* Add Member Form */}
            <form onSubmit={handleAddWhitelistMember} className="p-3 rounded-xl bg-secondary/30 border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-primary" /> Whitelist a Closed-One / VIP
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">10-Digit Mobile *</Label>
                  <Input
                    type="tel"
                    maxLength={10}
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    required
                    className="h-8 text-xs font-mono font-bold bg-background border-border"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Name / Nickname</Label>
                  <Input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="e.g. Rahul (Brother)"
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Redemption Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newMemberMaxUses}
                    onChange={(e) => setNewMemberMaxUses(e.target.value)}
                    placeholder="1 (or blank for ∞)"
                    className="h-8 text-xs bg-background border-border"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAddingMember || newMemberPhone.length !== 10}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 px-4 gap-1.5"
                >
                  {isAddingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Add to Whitelist
                </Button>
              </div>
            </form>

            {/* Whitelisted Members Roster */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Authorized Members ({whitelistMembers.length})
                </h4>
              </div>

              {loadingWhitelist ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground mt-2">Loading whitelist...</p>
                </div>
              ) : whitelistMembers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400" />
                  <p className="text-xs font-semibold">No whitelisted numbers yet</p>
                  <p className="text-[11px] mt-1">Add mobile numbers above so your closed ones can redeem this coupon.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {whitelistMembers.map((member) => (
                    <div
                      key={member.phone}
                      className="p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-foreground">+91 {member.phone}</span>
                            {member.member_name && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground font-semibold">
                                {member.member_name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>
                              Used: <strong className="text-foreground">{member.used_count}</strong> / {member.max_uses ? `${member.max_uses}x max` : "∞ Unlimited"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 justify-end shrink-0">
                        {/* Edit Limit Inline */}
                        {editingPhone === member.phone ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              value={editLimitValue}
                              onChange={(e) => setEditLimitValue(e.target.value)}
                              placeholder="Limit"
                              className="w-16 h-7 text-xs bg-background p-1 text-center"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveMemberLimit(member.phone)}
                              className="h-7 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingPhone(null)}
                              className="h-7 px-1.5 text-xs text-muted-foreground"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingPhone(member.phone);
                              setEditLimitValue(member.max_uses ? String(member.max_uses) : "");
                            }}
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            title="Edit Redemption Limit"
                          >
                            Edit Limit
                          </Button>
                        )}

                        {/* WhatsApp 1-Tap Share */}
                        {selectedCouponForWhitelist && (
                          <a
                            href={getWhatsAppShareLink(selectedCouponForWhitelist, member)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 text-xs font-semibold transition-colors"
                            title="Send Private Code via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px]">WhatsApp</span>
                          </a>
                        )}

                        {/* Delete Member */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveWhitelistMember(member.phone)}
                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          title="Remove from Whitelist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/50 shrink-0">
            <Button type="button" variant="outline" onClick={() => setIsWhitelistOpen(false)} className="text-xs h-9 w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
