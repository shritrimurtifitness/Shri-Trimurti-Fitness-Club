import { useState, useEffect, useRef } from "react";
import { User, Mail, Lock, ShieldAlert, Download, LogOut, ShieldCheck, Trash2, AlertTriangle, KeyRound, MapPin, Phone, Clock, Globe, MessageSquare, QrCode, IndianRupee, Check, Sparkles, Upload, Loader2, CheckCircle2, Coins, Award, Trophy, Search, Gift, RefreshCw, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SettingsTab = "account" | "website" | "financials" | "loyalty" | "system";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User className="w-4 h-4" /> },
  { id: "website", label: "Website", icon: <Globe className="w-4 h-4" /> },
  { id: "financials", label: "Financials", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "loyalty", label: "Loyalty & Coins", icon: <Coins className="w-4 h-4 text-amber-400" /> },
  { id: "system", label: "System", icon: <ShieldAlert className="w-4 h-4" /> },
];

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [purging, setPurging] = useState(false);
  const [saving, setSaving] = useState(false);

  // Contact Settings
  const [contactAddress, setContactAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactHours, setContactHours] = useState("");
  const [contactFacebook, setContactFacebook] = useState("");
  const [contactInstagram, setContactInstagram] = useState("");
  const [contactTwitter, setContactTwitter] = useState("");
  const [contactMapUrl, setContactMapUrl] = useState("https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3821.6516423908665!2d74.120735!3d16.6943068!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc1adfbed242d0d%3A0x78d9a54fdca8460e!2sShri%20Trimurti%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1794397156504!5m2!1sen!2sin");

  // Financial Settings
  const [gatewayPercent, setGatewayPercent] = useState("2.0");
  const [gstPercent, setGstPercent] = useState("18.0");
  const [upiId, setUpiId] = useState("harshvardhanp@slc");
  const [upiQrUrl, setUpiQrUrl] = useState("https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png");
  const [uploadingQr, setUploadingQr] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  const [showTestimonials, setShowTestimonials] = useState(false);
  const [togglingTestimonials, setTogglingTestimonials] = useState(false);

  const [savingContact, setSavingContact] = useState(false);

  // Loyalty Settings State
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [loyaltyCoinsPerSlot, setLoyaltyCoinsPerSlot] = useState(10);
  const [loyaltyMilestoneTarget, setLoyaltyMilestoneTarget] = useState(20);
  const [loyaltyCoinValueInr, setLoyaltyCoinValueInr] = useState(1.0);
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [loyaltyOverview, setLoyaltyOverview] = useState<any>(null);
  const [loyaltyWallets, setLoyaltyWallets] = useState<any[]>([]);
  const [walletSearch, setWalletSearch] = useState("");
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [adjustingPhone, setAdjustingPhone] = useState<string | null>(null);
  const [adjustCoins, setAdjustCoins] = useState("");
  const [adjustType, setAdjustType] = useState<"admin_bonus" | "admin_deduct">("admin_bonus");
  const [adjustReason, setAdjustReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const loadSettings = () => {
    api.get('/settings/contact').then(res => {
      setContactAddress(res.data.address || "");
      setContactPhone(res.data.phone || "");
      setContactEmail(res.data.email || "");
      setContactHours(res.data.working_hours || "");
      setContactFacebook(res.data.facebook_url || "");
      setContactInstagram(res.data.instagram_url || "");
      setContactTwitter(res.data.twitter_url || "");
      setContactMapUrl(res.data.map_embed_url || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3821.6516423908665!2d74.120735!3d16.6943068!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc1adfbed242d0d%3A0x78d9a54fdca8460e!2sShri%20Trimurti%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1794397156504!5m2!1sen!2sin");
      setGatewayPercent(res.data.gateway_percent?.toString() || "2.0");
      setGstPercent(res.data.gst_percent?.toString() || "18.0");
      setUpiId(res.data.upi_id || "harshvardhanp@slc");
      setUpiQrUrl(res.data.upi_qr_url || "https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png");
      setShowTestimonials(res.data.show_testimonials === true);
      setLoyaltyEnabled(res.data.loyalty_enabled ?? true);
      setLoyaltyCoinsPerSlot(Number(res.data.loyalty_coins_per_slot) || 10);
      setLoyaltyMilestoneTarget(Number(res.data.loyalty_milestone_target) || 20);
      setLoyaltyCoinValueInr(Number(res.data.loyalty_coin_value_inr) || 1.0);
    }).catch(() => { });
  };

  const loadLoyaltyData = async () => {
    try {
      setLoadingWallets(true);
      const [overviewRes, walletsRes] = await Promise.all([
        api.get('/loyalty/admin/overview').catch(() => null),
        api.get(`/loyalty/admin/wallets${walletSearch ? `?search=${encodeURIComponent(walletSearch)}` : ''}`).catch(() => null),
      ]);
      if (overviewRes?.data) setLoyaltyOverview(overviewRes.data);
      if (walletsRes?.data) setLoyaltyWallets(walletsRes.data);
    } catch (err) {
      console.error("Failed to load loyalty data", err);
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    if (activeTab === "loyalty") {
      loadLoyaltyData();
    }
  }, [activeTab]);

  const handleSaveLoyalty = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSavingLoyalty(true);
    try {
      await api.put('/settings/loyalty', {
        loyalty_enabled: loyaltyEnabled,
        loyalty_coins_per_slot: Number(loyaltyCoinsPerSlot),
        loyalty_milestone_target: Number(loyaltyMilestoneTarget),
        loyalty_coin_value_inr: Number(loyaltyCoinValueInr),
      });
      toast.success("Loyalty settings updated successfully!");
      loadLoyaltyData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update loyalty settings");
    } finally {
      setSavingLoyalty(false);
    }
  };

  const handleManualAdjust = async () => {
    if (!adjustingPhone || !adjustCoins) return;
    setSavingAdjust(true);
    try {
      await api.post('/loyalty/admin/adjust', {
        phone: adjustingPhone,
        coins: Number(adjustCoins),
        type: adjustType,
        reason: adjustReason,
      });
      toast.success(`Successfully ${adjustType === 'admin_bonus' ? 'granted' : 'deducted'} ${adjustCoins} coins!`);
      setAdjustingPhone(null);
      setAdjustCoins("");
      setAdjustReason("");
      loadLoyaltyData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Adjustment failed");
    } finally {
      setSavingAdjust(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setName(payload.name || "System Admin");
        setEmail(payload.email || "");
      } catch (e) {
        console.error("Token decode failed", e);
      }
    }
    loadSettings();
  }, []);

  useSocket('settings_updated', loadSettings);

  const handleToggleTestimonials = async (val: boolean) => {
    setTogglingTestimonials(true);
    try {
      const res = await api.patch('/settings/toggle-testimonials', { show_testimonials: val });
      const newStatus = typeof res.data?.show_testimonials === 'boolean' ? res.data.show_testimonials : val;
      setShowTestimonials(newStatus);
      toast.success(newStatus ? "Testimonials section enabled on landing page!" : "Testimonials section hidden from landing page.");
    } catch {
      toast.error("Failed to update testimonials visibility");
    } finally {
      setTogglingTestimonials(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', { name, email });
      toast.success("Profile updated! Please login again if you changed your email.");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("New passwords do not match");
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      toast.success("Password updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed; check current password");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) return toast.error("PINs do not match");
    if (!/^\d{4}$/.test(newPin)) return toast.error("PIN must be exactly 4 digits");
    setSaving(true);
    try {
      await api.put('/auth/pin', { currentPassword, newPin });
      toast.success("Login PIN updated successfully!");
      setNewPin(""); setConfirmPin(""); setCurrentPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed; check current password");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      toast.success("Logged out from all devices. Logging you out now...");
      setTimeout(() => { localStorage.removeItem("adminToken"); window.location.href = "/admin/login"; }, 2000);
    } catch { toast.error("Failed to perform global logout"); }
  };

  const handleExportData = async () => {
    try {
      const response = await api.get('/settings/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `shritrimurti_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      toast.success("Database export successful!");
    } catch { toast.error("Failed to export database"); }
  };

  const handleResetData = async () => {
    if (resetConfirmText !== "DELETE ALL DATA") return toast.error("Please type the confirmation text correctly");
    try {
      await api.post('/settings/reset-data');
      toast.success("Platform data has been completely reset.");
      setResetConfirmText("");
      setTimeout(() => window.location.reload(), 2000);
    } catch { toast.error("Data reset failed"); }
  };

  const handlePurgeTestData = async () => {
    if (purgeConfirmText !== "RESET BOOKINGS") {
      return toast.error("Please type RESET BOOKINGS to confirm");
    }
    setPurging(true);
    const toastId = toast.loading("Purging test bookings and customer records...");
    try {
      const res = await api.post('/settings/purge-test-data');
      toast.success(res.data?.message || "Test data purged successfully!", { id: toastId });
      setPurgeConfirmText("");
      setTimeout(() => window.location.reload(), 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to purge test data", { id: toastId });
    } finally {
      setPurging(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      await api.put('/settings/contact', {
        address: contactAddress, phone: contactPhone, email: contactEmail,
        working_hours: contactHours, facebook_url: contactFacebook,
        instagram_url: contactInstagram, twitter_url: contactTwitter,
        map_embed_url: contactMapUrl,
        gateway_percent: parseFloat(gatewayPercent) || 0,
        gst_percent: parseFloat(gstPercent) || 0,
        upi_id: upiId,
        upi_qr_url: upiQrUrl
      });
      toast.success("Settings updated!");
    } catch { toast.error("Failed to update settings"); }
    finally { setSavingContact(false); }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (PNG, JPG, or WEBP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    const formData = new FormData();
    formData.append('qr_image', file);

    setUploadingQr(true);
    const toastId = toast.loading("Uploading QR code to Cloudinary...");
    try {
      const res = await api.post('/settings/upload-qr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.secure_url) {
        setUpiQrUrl(res.data.secure_url);
        toast.success("New UPI QR code uploaded to Cloudinary and saved!", { id: toastId });
      }
    } catch (err: any) {
      console.error("QR upload failed:", err);
      toast.error(err.response?.data?.error || "Failed to upload QR code to Cloudinary", { id: toastId });
    } finally {
      setUploadingQr(false);
      if (qrFileInputRef.current) qrFileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Profile Sidebar - sticky on desktop, horizontal card on mobile */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-turf flex items-center justify-center mx-auto mb-3 text-primary-foreground text-2xl font-bold">
                {name[0]}
              </div>
              <h3 className="font-heading font-bold text-lg">{name}</h3>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              <div className="mt-3 flex justify-center">
                <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider rounded-full border border-primary/20">
                  System Admin
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-2xl p-3 space-y-1.5">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9" onClick={handleExportData}>
                <Download className="w-3.5 h-3.5 text-emerald-500" /> Export Database
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9 text-destructive hover:bg-destructive/5" onClick={handleLogoutAll}>
                <LogOut className="w-3.5 h-3.5" /> Terminate Sessions
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">

          {/* Tabs Navigation - horizontally scrollable on mobile */}
          <div className="mb-6 -mx-1">
            <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto scrollbar-none">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${activeTab === tab.id
                      ? "bg-card text-primary shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ============ ACCOUNT TAB ============ */}
          {activeTab === "account" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Profile Details */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-lg">Profile Details</h3>
                </div>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Username</label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Admin Name" className="bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@example.com" className="bg-background" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="bg-primary/10 text-primary hover:bg-primary hover:text-white border-primary/20 transition-all font-bold">
                      {saving ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </form>
              </section>

              {/* Account Security */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-lg">Account Security</h3>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="pl-10 bg-background" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 border-t border-border/50 pt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New Password</label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" className="bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirm New</label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm New" className="bg-background" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="bg-primary/10 text-primary hover:bg-primary hover:text-white border-primary/20 transition-all font-bold">
                      Update Password
                    </Button>
                  </div>
                </form>
              </section>

              {/* PIN Management */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-lg">Login PIN Management</h3>
                </div>
                <form onSubmit={handleUpdatePin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirm Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="pl-10 bg-background" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 border-t border-border/50 pt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New 4-Digit PIN</label>
                      <Input type="password" maxLength={4} value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, "").substring(0, 4))}
                        placeholder="0000" className="bg-background text-center tracking-[0.5em] font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirm New PIN</label>
                      <Input type="password" maxLength={4} value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, "").substring(0, 4))}
                        placeholder="0000" className="bg-background text-center tracking-[0.5em] font-bold" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="bg-primary/10 text-primary hover:bg-primary hover:text-white border-primary/20 transition-all font-bold">
                      Update Login PIN
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* ============ WEBSITE TAB ============ */}
          {activeTab === "website" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-lg">Website Contact Info</h3>
                </div>
                <p className="text-xs text-muted-foreground">These details are shown publicly on the landing page footer.</p>
                <form onSubmit={handleSaveContact} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} placeholder="123 Sports Complex, Green Park, Mumbai" className="pl-10 bg-background" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 98765 43210" className="pl-10 bg-background" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@example.com" className="pl-10 bg-background" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Working Hours</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={contactHours} onChange={(e) => setContactHours(e.target.value)} placeholder="Mon–Sun: 6:00 AM – 12:00 AM" className="pl-10 bg-background" />
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-4">
                    <p className="text-xs text-muted-foreground mb-3 uppercase font-bold tracking-wider">Social Media Links (optional)</p>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Facebook</label>
                        <Input value={contactFacebook} onChange={(e) => setContactFacebook(e.target.value)} placeholder="https://facebook.com/..." className="bg-background text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instagram</label>
                        <Input value={contactInstagram} onChange={(e) => setContactInstagram(e.target.value)} placeholder="https://instagram.com/..." className="bg-background text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Twitter / X</label>
                        <Input value={contactTwitter} onChange={(e) => setContactTwitter(e.target.value)} placeholder="https://twitter.com/..." className="bg-background text-xs" />
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border/50 pt-4 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Google Maps Embed (optional)</label>
                    <Input value={contactMapUrl} onChange={(e) => setContactMapUrl(e.target.value)} placeholder='Paste full <iframe ...> OR just the src URL' className="bg-background text-xs" />
                    <p className="text-[11px] text-muted-foreground">Google Maps → Share → Embed a map → copy. You can paste the entire <code>&lt;iframe&gt;</code> snippet OR just the URL. If empty, we'll auto-generate from the address.</p>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingContact} className="bg-primary/10 text-primary hover:bg-primary hover:text-white border-primary/20 transition-all font-bold">
                      {savingContact ? "Saving..." : "Save Contact Info"}
                    </Button>
                  </div>
                </form>
              </section>

              {/* Landing Page Testimonials Visibility */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      showTestimonials ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading font-bold text-sm sm:text-base text-foreground">Landing Page Testimonials</h4>
                        {showTestimonials ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-400">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Control whether customer reviews & Google trust score are visible to visitors on the landing page</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                      {showTestimonials ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={showTestimonials}
                      disabled={togglingTestimonials}
                      onCheckedChange={handleToggleTestimonials}
                      aria-label="Toggle testimonials section visibility"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ============ FINANCIALS TAB ============ */}
          {activeTab === "financials" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Arena Direct UPI (0% Commission) */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-bold text-lg">Arena Direct UPI (0% Commission)</h3>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          <Sparkles className="w-3 h-3" /> 100% Direct to Bank
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Advance payments go straight to your bank account with zero payment gateway fees. Verified via Brevo Email OTP & last 4 digits of UPI Ref ID approval.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <IndianRupee className="w-3.5 h-3.5 text-primary" /> Arena UPI ID / VPA
                      </label>
                      <Input
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value.trim())}
                        placeholder="e.g. harshvardhanp@slc"
                        className="bg-background font-mono font-bold text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Customer will see this ID to copy with 1-click or tap on mobile to open Google Pay, PhonePe, or Paytm.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>UPI QR Code Asset URL</span>
                        {upiQrUrl?.includes('cloudinary') && (
                          <span className="text-[10px] text-emerald-400 font-mono font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Cloudinary CDN
                          </span>
                        )}
                      </label>
                      <Input
                        value={upiQrUrl}
                        onChange={(e) => setUpiQrUrl(e.target.value.trim())}
                        placeholder="https://res.cloudinary.com/..."
                        className="bg-background font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Auto-updated when you upload a new image, or paste an external image link manually.
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-2">
                      <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Zero Gateway Fee Workflow
                      </p>
                      <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                        <li>Customer verifies email via Brevo OTP before checkout.</li>
                        <li>Customer scans your Arena QR code or pays via UPI ID.</li>
                        <li>Customer submits the last 4 digits of UPI Ref ID.</li>
                        <li>Admin verifies funds in bank app and approves with one click in Bookings.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-secondary/20 border border-border/60 text-center space-y-3.5">
                    <div className="flex items-center justify-between w-full">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Checkout QR Card Preview</p>
                      {upiQrUrl?.includes('cloudinary') ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Cloudinary CDN
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          Local Asset
                        </span>
                      )}
                    </div>

                    <div className="relative bg-white p-3 rounded-2xl shadow-xl border border-zinc-200 inline-block overflow-hidden group">
                      <img
                        src={upiQrUrl || "https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png"}
                        alt="Arena UPI QR Preview"
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                      {uploadingQr && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-2">
                          <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-1.5" />
                          <span className="text-xs font-semibold">Uploading...</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-mono font-bold text-foreground">{upiId || 'harshvardhanp@slc'}</p>
                      <p className="text-[10px] text-muted-foreground">SHRI TRIMURTI FITNESS CLUB</p>
                    </div>

                    <div className="w-full pt-1 space-y-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => qrFileInputRef.current?.click()}
                        disabled={uploadingQr}
                        className="w-full gap-2 text-xs font-semibold border-primary/30 hover:border-primary hover:bg-primary/5 shadow-sm"
                      >
                        {uploadingQr ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            Uploading to Cloudinary...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-primary" />
                            Upload New QR Image
                          </>
                        )}
                      </Button>
                      <input
                        ref={qrFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleQrUpload}
                        className="hidden"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Uploads instantly to Cloudinary & auto-updates checkout QR.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/50">
                  <Button
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="bg-gradient-turf text-primary-foreground font-bold shadow-turf px-6"
                  >
                    {savingContact ? "Saving..." : "Save UPI Settings"}
                  </Button>
                </div>
              </section>

              {/* Legacy / Optional Gateway Platform Fees */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-lg">Financial Configuration (Tax & Fees)</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure the tax and platform fees charged for reporting or optional online gateway processing.
                </p>

                <form onSubmit={handleSaveContact} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gateway Surcharge (%)</label>
                      <div className="relative">
                        <Input
                          type="text"
                          value={gatewayPercent}
                          onChange={(e) => setGatewayPercent(e.target.value.replace(/[^0-9.]/g, ""))}
                          className="bg-background font-bold text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">Usually 2.0% for third-party payment gateways.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">GST on Surcharge (%)</label>
                      <div className="relative">
                        <Input
                          type="text"
                          value={gstPercent}
                          onChange={(e) => setGstPercent(e.target.value.replace(/[^0-9.]/g, ""))}
                          className="bg-background font-bold text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">Standard GST is 18.0% in India.</p>
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Total Platform Surcharge</p>
                      <p className="text-[11px] text-muted-foreground">Effective rate applied to user bookings</p>
                    </div>
                    <div className="text-3xl font-black text-primary">
                      {(parseFloat(gatewayPercent || "0") * (1 + parseFloat(gstPercent || "0") / 100)).toFixed(2)}%
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingContact} className="bg-primary hover:bg-primary/90 text-white transition-all font-bold px-8">
                      {savingContact ? "Saving..." : "Save Financial Settings"}
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* ============ LOYALTY TAB ============ */}
          {activeTab === "loyalty" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Program Overview Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-card border border-border rounded-xl p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Wallets</span>
                  <p className="text-2xl font-black text-foreground mt-1">{loyaltyOverview?.stats?.total_wallets || 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total registered players</p>
                </div>
                <div className="bg-card border border-amber-500/30 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Locked in Vaults</span>
                  <p className="text-2xl font-black text-amber-300 mt-1 font-mono">{Math.round(loyaltyOverview?.stats?.total_coins_in_vaults || 0)} TC</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pre-milestone locked</p>
                </div>
                <div className="bg-card border border-emerald-500/30 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Spendable Coins</span>
                  <p className="text-2xl font-black text-emerald-300 mt-1 font-mono">{Math.round(loyaltyOverview?.stats?.total_spendable_coins || 0)} TC</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ready for redemption</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Redeemed</span>
                  <p className="text-2xl font-black text-foreground mt-1 font-mono">₹{Math.round(loyaltyOverview?.stats?.total_coins_redeemed || 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Lifetime discount given</p>
                </div>
                <div className="bg-card border border-primary/30 rounded-xl p-4 col-span-2 lg:col-span-1">
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Milestone VIPs</span>
                  <p className="text-2xl font-black text-primary mt-1">{loyaltyOverview?.stats?.milestone_achievers || 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Completed 20+ matches</p>
                </div>
              </div>

              {/* Main Loyalty Settings Form */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-heading font-bold text-lg">Trimurti Coins & Milestone Rules</h3>
                      <p className="text-xs text-muted-foreground">Configure the reward rate, milestone unlock threshold, and coin values across Web & WhatsApp.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">Program Status:</span>
                    <Switch
                      checked={loyaltyEnabled}
                      onCheckedChange={(val) => setLoyaltyEnabled(val)}
                    />
                  </div>
                </div>

                <form onSubmit={handleSaveLoyalty} className="space-y-6">
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Coins Per Slot Booking</label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={loyaltyCoinsPerSlot}
                          onChange={(e) => setLoyaltyCoinsPerSlot(parseInt(e.target.value) || 0)}
                          className="bg-background font-bold text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">TC</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Default: 10 Coins awarded into vault for each confirmed match.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Milestone Unlock Target</label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={loyaltyMilestoneTarget}
                          onChange={(e) => setLoyaltyMilestoneTarget(parseInt(e.target.value) || 0)}
                          className="bg-background font-bold text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">Matches</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Default: 20 matches. Coins remain locked in vault until threshold is reached.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Coin Conversion Value (INR)</label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.1"
                          min={0.1}
                          max={10}
                          value={loyaltyCoinValueInr}
                          onChange={(e) => setLoyaltyCoinValueInr(parseFloat(e.target.value) || 1.0)}
                          className="bg-background font-bold text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹/Coin</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Default: ₹1.00 per Trimurti Coin redeemed.</p>
                    </div>
                  </div>

                  {/* Gamification Cycle Formula Explainer */}
                  <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-400" /> Milestone Reward Cycle Calculation
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Completing <strong className="text-foreground">{loyaltyMilestoneTarget} matches</strong> unlocks <strong className="text-emerald-400 font-mono">{loyaltyMilestoneTarget * loyaltyCoinsPerSlot} Trimurti Coins</strong> (Worth <strong className="text-emerald-400">₹{loyaltyMilestoneTarget * loyaltyCoinsPerSlot * loyaltyCoinValueInr}</strong> discount)!
                      </p>
                    </div>
                    <Button type="submit" disabled={savingLoyalty} className="bg-primary hover:bg-primary/90 text-white font-bold px-6 shrink-0">
                      {savingLoyalty ? "Saving..." : "Save Loyalty Settings"}
                    </Button>
                  </div>
                </form>
              </section>

              {/* Player Loyalty Explorer */}
              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-lg">Customer Loyalty Wallets</h3>
                    <p className="text-xs text-muted-foreground">Search and inspect any player's vault progress, spendable balance, and completed milestone cycles.</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by phone or name..."
                        value={walletSearch}
                        onChange={(e) => setWalletSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') loadLoyaltyData(); }}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                    <Button size="sm" onClick={() => loadLoyaltyData()} variant="outline" className="h-9 text-xs">
                      Search
                    </Button>
                  </div>
                </div>

                {/* Mobile View: Vertical Cards (< md) */}
                <div className="md:hidden space-y-3">
                  {loadingWallets ? (
                    <div className="py-8 text-center text-muted-foreground bg-card rounded-xl border border-border">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading player wallets...
                    </div>
                  ) : loyaltyWallets.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-xs bg-secondary/20 rounded-xl border border-dashed border-border p-6">
                      No player loyalty wallets found.
                    </div>
                  ) : (
                    loyaltyWallets.map((w) => {
                      const progressPct = loyaltyMilestoneTarget > 0 
                        ? Math.min(100, Math.round((w.current_cycle_bookings / loyaltyMilestoneTarget) * 100))
                        : 100;

                      return (
                        <div key={w.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm text-left">
                          {/* Top Row: Player Info + Milestones Tag */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{w.customer_name || 'Arena Player'}</h4>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">+91 {w.phone}</p>
                            </div>
                            {w.completed_milestones > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                🏆 {w.completed_milestones} Milestone{w.completed_milestones === 1 ? '' : 's'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border shrink-0">
                                In Progress
                              </span>
                            )}
                          </div>

                          {/* Middle Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 bg-secondary/40 rounded-lg p-2.5 text-center">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Matches</span>
                              <p className="text-sm font-bold text-foreground">{w.lifetime_bookings_count}</p>
                            </div>
                            <div className="space-y-0.5 border-x border-border/50">
                              <span className="text-[10px] text-amber-400 uppercase font-semibold">Locked Vault</span>
                              <p className="text-sm font-bold text-amber-300 font-mono">{Math.round(w.vault_balance)} TC</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Spendable</span>
                              <p className="text-sm font-bold text-emerald-300 font-mono">{Math.round(w.spendable_balance)} TC</p>
                            </div>
                          </div>

                          {/* Progress Bar in Current Cycle */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-muted-foreground">Cycle Progress</span>
                              <span className="font-mono font-bold text-amber-400">
                                {w.current_cycle_bookings} / {loyaltyMilestoneTarget} Matches ({progressPct}%)
                              </span>
                            </div>
                            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="pt-2 border-t border-border/40">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAdjustingPhone(w.phone);
                                setAdjustCoins("50");
                                setAdjustType("admin_bonus");
                                setAdjustReason("");
                              }}
                              className="w-full h-8 text-xs font-semibold gap-1.5"
                            >
                              <Gift className="w-3.5 h-3.5 text-amber-400" /> Gift / Adjust Coins
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop View: Full Table (>= md) */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/50 uppercase text-[10px] text-muted-foreground tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4">Player</th>
                        <th className="py-3 px-4">Lifetime Matches</th>
                        <th className="py-3 px-4">Current Cycle</th>
                        <th className="py-3 px-4">Locked Vault</th>
                        <th className="py-3 px-4">Spendable Coins</th>
                        <th className="py-3 px-4">Milestones</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loadingWallets ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading player wallets...
                          </td>
                        </tr>
                      ) : loyaltyWallets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No player loyalty wallets found.
                          </td>
                        </tr>
                      ) : (
                        loyaltyWallets.map((w) => (
                          <tr key={w.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-bold text-foreground">{w.customer_name || 'Arena Player'}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">+91 {w.phone}</p>
                            </td>
                            <td className="py-3 px-4 font-bold text-foreground">
                              {w.lifetime_bookings_count}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-amber-400">
                                {w.current_cycle_bookings} / {loyaltyMilestoneTarget}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-amber-300">
                              {Math.round(w.vault_balance)} TC
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              {Math.round(w.spendable_balance)} TC
                            </td>
                            <td className="py-3 px-4">
                              {w.completed_milestones > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  🏆 {w.completed_milestones} Done
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">In Progress</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAdjustingPhone(w.phone);
                                  setAdjustCoins("50");
                                  setAdjustType("admin_bonus");
                                  setAdjustReason("");
                                }}
                                className="h-7 text-[11px] gap-1 px-2.5"
                              >
                                <Gift className="w-3 h-3 text-amber-400" /> Gift / Adjust
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Adjust Modal / Drawer */}
              {adjustingPhone && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-amber-400" />
                        <h4 className="font-heading font-bold text-lg">Adjust Player Coins</h4>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setAdjustingPhone(null)} className="h-7 w-7 p-0">✕</Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">Player Mobile</label>
                        <Input value={`+91 ${adjustingPhone}`} disabled className="bg-secondary/50 font-mono mt-1" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">Adjustment Type</label>
                          <select
                            value={adjustType}
                            onChange={(e) => setAdjustType(e.target.value as any)}
                            className="w-full h-10 px-3 rounded-lg bg-background border border-border text-xs font-semibold mt-1"
                          >
                            <option value="admin_bonus">🎁 Grant Bonus</option>
                            <option value="admin_deduct">🔻 Deduct Coins</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">Coins</label>
                          <Input
                            type="number"
                            min={1}
                            value={adjustCoins}
                            onChange={(e) => setAdjustCoins(e.target.value)}
                            className="mt-1 font-bold font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">Reason / Note</label>
                        <Input
                          placeholder="e.g. Tournament winner bonus, courtesy credit"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          className="mt-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-border">
                      <Button variant="ghost" onClick={() => setAdjustingPhone(null)} className="text-xs">Cancel</Button>
                      <Button
                        onClick={handleManualAdjust}
                        disabled={savingAdjust || !adjustCoins}
                        className="bg-primary hover:bg-primary/90 text-white font-bold text-xs"
                      >
                        {savingAdjust ? "Processing..." : `Confirm ${adjustType === 'admin_bonus' ? 'Grant' : 'Deduction'}`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ SYSTEM TAB ============ */}
          {activeTab === "system" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Danger Zone */}
              <section className="border-2 border-destructive/20 bg-destructive/5 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6 text-destructive" />
                  <div>
                    <h3 className="font-heading font-bold text-lg text-destructive">Danger Zone & Production Reset</h3>
                    <p className="text-xs text-muted-foreground">Destructive actions for platform maintenance. Use with extreme caution.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Option 1: Purge Test Bookings & Customer Data */}
                  <div className="bg-card border-2 border-amber-500/30 dark:border-amber-500/20 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-amber-500/50 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Recommended for Launch
                        </span>
                        <CalendarX className="w-5 h-5 text-amber-500" />
                      </div>
                      <h4 className="font-heading font-bold text-base text-foreground">Purge Test Bookings & Customer Data</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Cleans out all test bookings, payment logs, revenue statistics, loyalty wallets, and customer accounts (<span className="font-mono text-[11px] text-foreground">role = user</span>).
                      </p>
                      <div className="pt-2 border-t border-border/50 text-[11px] space-y-1 text-muted-foreground">
                        <div className="text-emerald-500 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Preserves Turfs (Cricket & Football), Slots, Pricing, Tournaments & Admin/Staff</span>
                        </div>
                        <div className="text-amber-500 font-semibold flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                          <span>Instantly resets all time slots to unbooked & ready for live public bookings</span>
                        </div>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-white dark:hover:text-black gap-2 mt-2"
                        >
                          <RefreshCw className="w-4 h-4" /> Purge Test Data & Reset Slots
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border border max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="w-5 h-5" /> Reset Test Data for Fresh Launch?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed space-y-2">
                            <span>This action will permanently delete all test bookings, payments, customer activity logs, and customer user accounts.</span>
                            <div className="bg-secondary/40 border border-border/50 rounded-lg p-3 my-2 space-y-1.5 text-foreground">
                              <p className="font-semibold text-xs text-emerald-500">✅ Strictly Preserved:</p>
                              <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5 ml-1">
                                <li>All Turfs (Cricket Turf & Football Turf facilities)</li>
                                <li>Time Slots & Slot generation templates</li>
                                <li>Pricing plans & weekend tariffs</li>
                                <li>Admin & Staff user accounts with credentials</li>
                                <li>Tournaments, Gallery images, and Testimonials</li>
                                <li>Site contact info, UPI QR, & settings</li>
                              </ul>
                              <p className="font-semibold text-xs text-destructive pt-1">❌ Wiped / Purged:</p>
                              <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5 ml-1">
                                <li>All bookings, payments, and revenue statistics</li>
                                <li>Customer accounts (<code className="text-destructive font-mono">role = user</code>)</li>
                                <li>Trimurti Coins wallets & loyalty logs</li>
                                <li>Bank SMS match logs, WhatsApp logs, and OTP records</li>
                              </ul>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="p-4 bg-muted/80 rounded-xl space-y-2 border border-border/50">
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Type <span className="text-amber-500 font-mono">RESET BOOKINGS</span> to confirm
                          </p>
                          <Input
                            value={purgeConfirmText}
                            onChange={(e) => setPurgeConfirmText(e.target.value)}
                            placeholder="RESET BOOKINGS"
                            className="bg-background border-amber-500/30 focus-visible:ring-amber-500 font-mono uppercase"
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-secondary" onClick={() => setPurgeConfirmText("")}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handlePurgeTestData}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
                            disabled={purgeConfirmText !== "RESET BOOKINGS" || purging}
                          >
                            {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Confirm Purge & Reset Slots
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Option 2: Full Factory Reset */}
                  <div className="bg-card border-2 border-destructive/20 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-destructive/40 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20">
                          Total Wipe
                        </span>
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </div>
                      <h4 className="font-heading font-bold text-base text-destructive">Full Factory Reset</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Total wipe that clears turfs, pricing plans, slot templates, gallery images, testimonials, bookings, and all customer data back to empty factory state.
                      </p>
                      <div className="pt-2 border-t border-border/50 text-[11px] space-y-1 text-muted-foreground">
                        <div className="text-destructive font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Deletes turfs, slot templates, gallery & testimonials</span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Preserves Admin account only</span>
                        </div>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full font-bold gap-2 mt-2">
                          <Trash2 className="w-4 h-4" /> Full Factory Reset
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border border max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" /> Execute Complete Factory Reset?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed">
                            This will delete EVERYTHING: turfs, slots, pricing plans, slot templates, gallery photos, testimonials, and all customer bookings. Only your admin credentials will remain.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="p-4 bg-muted/80 rounded-xl space-y-2 border border-border/50">
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Type <span className="text-destructive font-mono">DELETE ALL DATA</span> to confirm
                          </p>
                          <Input
                            value={resetConfirmText}
                            onChange={(e) => setResetConfirmText(e.target.value)}
                            placeholder="DELETE ALL DATA"
                            className="bg-background border-destructive/30 focus-visible:ring-destructive font-mono uppercase"
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-secondary" onClick={() => setResetConfirmText("")}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleResetData}
                            className="bg-destructive text-white hover:bg-destructive/90 font-bold"
                            disabled={resetConfirmText !== "DELETE ALL DATA"}
                          >
                            Process Factory Reset
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
