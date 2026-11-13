import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, addDays, startOfDay, parse, isAfter } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock, User, Phone, ArrowRight, CheckCircle2, ArrowLeft, Loader2, Trophy, ShieldCheck, Lock, Mail, QrCode, Copy, Check, AlertCircle, ExternalLink, MessageCircle, Tag, Sparkles, Gift, X } from "lucide-react";
import { formatTime12Hour } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { type Slot, type FacilityType, getFacilityLabel } from "@/lib/mock-data";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/landing/FooterSection";
import { toast } from "sonner";
import cricketImg from "@/assets/cricket-turf.jpg";
import footballImg from "@/assets/football-turf.jpg";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { Download, Share2, MessageSquare } from "lucide-react";
import TeamSplitModal from "@/components/TeamSplitModal";
import confetti from "canvas-confetti";

/** Fallback images for known sport types */
const knownImages: Record<string, string> = {
  cricket: cricketImg,
  football: footballImg,
};
const defaultImage = "https://images.unsplash.com/photo-1461896836934-bd45ba8bf8bd?q=80&w=2000&auto=format&fit=crop";

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12AM";
  if (h === 12) return "12PM";
  return h > 12 ? `${h - 12}PM` : `${h}AM`;
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("facility") as FacilityType | null;

  const [step, setStep] = useState<string>(preselected ? "date" : "facility");
  const [facility, setFacility] = useState<FacilityType>(preselected || "");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [groupedSlots, setGroupedSlots] = useState<{ time: string, price: number, slots: any[], availableSlots: any[], isAvailable: boolean }[]>([]);
  const [selectedSlotGroup, setSelectedSlotGroup] = useState<any | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [verificationChannel, setVerificationChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [verifiedChannel, setVerifiedChannel] = useState<'whatsapp' | 'email' | null>(null);
  const [waLink, setWaLink] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiSettings, setUpiSettings] = useState({
    upi_id: "harshvardhanp@slc",
    upi_qr_url: "https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [feeSettings, setFeeSettings] = useState({ gateway: 0.0, gst: 0.0 });
  const [isArenaClosed, setIsArenaClosed] = useState(false);
  const [closureReason, setClosureReason] = useState("");
  const [showTeamSplit, setShowTeamSplit] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [firstTimeOffer, setFirstTimeOffer] = useState<any | null>(null);
  const [checkingFirstTime, setCheckingFirstTime] = useState(false);

  const loadUpiAndFeeSettings = () => {
    api.get('/settings/contact').then(res => {
      setFeeSettings({
        gateway: Number(res.data.gateway_percent) || 0,
        gst: Number(res.data.gst_percent) || 0
      });
      if (res.data?.upi_id || res.data?.upi_qr_url) {
        setUpiSettings({
          upi_id: res.data.upi_id || "harshvardhanp@slc",
          upi_qr_url: res.data.upi_qr_url || "https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png"
        });
      }
    }).catch(err => console.error("Failed to fetch settings", err));
  };

  // Fetch settings for dynamic fee calculation and UPI
  useEffect(() => {
    loadUpiAndFeeSettings();
  }, []);

  useSocket('settings_updated', loadUpiAndFeeSettings);
 
  const effectiveRate = (feeSettings.gateway / 100) * (1 + feeSettings.gst / 100);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  // Table-based state for snooker/pool
  const [allFacilities, setAllFacilities] = useState<any[]>([]);
  const facilityData = allFacilities.find((f: any) => f.facility_type === facility);
  /** Get the display name for the selected facility */
  const facilityName = allFacilities.find((f: any) => f.facility_type === facility)?.name || getFacilityLabel(facility);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [tableStatus, setTableStatus] = useState<any[]>([]);
  const [selectedTableSlot, setSelectedTableSlot] = useState<any | null>(null);

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [blockingTournament, setBlockingTournament] = useState<any | null>(null);

  const loadFacilities = () => {
    api.get('/facilities').then(res => setAllFacilities(res.data.filter((f: any) => f.is_active !== false))).catch(() => { });
  };

  // Fetch all facilities and tournaments on mount
  useEffect(() => {
    api.get('/tournaments').then(res => setTournaments(res.data)).catch(() => { });
    loadFacilities();
  }, []);

  useSocket('facility_updated', loadFacilities);

  const isTableSport = facilityData?.pricing_model === "hourly";

  const handleFacilitySelect = async (f: FacilityType) => {
    setFacility(f);
    setStep("date");
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const currentTurf = allFacilities.find(f => f.facility_type === facility);

      const activeTournament = tournaments.find(t => {
        const tStart = format(new Date(t.start_date), "yyyy-MM-dd");
        const tEnd = format(new Date(t.end_date), "yyyy-MM-dd");
        
        // 1. Direct match with current sport
        const isDirectMatch = t.sport_type.toLowerCase() === facility.toLowerCase();
        
        // 2. Shared physical resource match
        // If current sport shares a turf with the sport that has a tournament
        const isSharedMatch = currentTurf?.physical_resource_id != null && 
          allFacilities.some(f => 
            f.physical_resource_id === currentTurf.physical_resource_id && 
            f.facility_type.toLowerCase() === t.sport_type.toLowerCase()
          );

        return (isDirectMatch || isSharedMatch) && formattedDate >= tStart && formattedDate <= tEnd;
      });

      if (activeTournament) {
        setBlockingTournament(activeTournament);
        setGroupedSlots([]);
        setSelectedSlotGroup(null);
        setSelectedSlot(null);
        setStep("slot");
        return;
      }
      setBlockingTournament(null);

      const response = await api.get(`/slots?date=${formattedDate}&facility_type=${facility}`);

      if (response.data && response.data.is_closed) {
        setIsArenaClosed(true);
        setClosureReason(response.data.reason || "Arena is closed for administrative reasons.");
        setGroupedSlots([]);
        setSelectedSlotGroup(null);
        setSelectedSlot(null);
        setStep("slot");
        return;
      }
      
      setIsArenaClosed(false);
      
      if (!Array.isArray(response.data)) {
        console.error("Expected slot array but received:", response.data);
        throw new Error("Invalid response format from server");
      }

      const groups: Record<string, any[]> = {};
      response.data.forEach((s: any) => {
        const time = formatTime12Hour(s.start_time) + " – " + formatTime12Hour(s.end_time);
        if (!groups[time]) groups[time] = [];
        groups[time].push(s);
      });

      const mappedGroups = Object.entries(groups).map(([time, arr]) => {
        let availableSlots = arr.filter(s => s.is_available);

        const now = new Date();
        availableSlots = availableSlots.filter(s => {
          const slotDateTime = parse(`${formattedDate} ${s.start_time.substring(0, 5)}`, "yyyy-MM-dd HH:mm", new Date());
          return isAfter(slotDateTime, now);
        });

        return {
          time,
          price: Number(arr[0].price),
          slots: arr,
          availableSlots,
          isAvailable: availableSlots.length > 0
        };
      });

      setGroupedSlots(mappedGroups);
      setSelectedSlotGroup(null);
      setSelectedSlot(null);
      setStep("slot");
    } catch (error) {
      console.error("Booking page error:", error);
      toast.error("Failed to load slots. Please check your connection or try again.");
    }
  };

  useSocket('booking_updated', () => {
    if (selectedDate && step === "slot") handleDateSelect(selectedDate);
  });

  useSocket('slot_updated', () => {
    if (selectedDate && step === "slot") handleDateSelect(selectedDate);
  });

  useSocket('otp_verified', (data?: any) => {
    if (!data) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanEmail = email.trim().toLowerCase();
    const phoneMatched =
      data.channel === 'whatsapp' &&
      cleanPhone &&
      (data.phone === cleanPhone ||
       data.phone === '91' + cleanPhone ||
       data.phone10 === cleanPhone ||
       data.phoneNo91 === cleanPhone);
    const emailMatched =
      data.channel === 'email' && cleanEmail && data.email === cleanEmail;

    if (phoneMatched || emailMatched) {
      setIsOtpVerified(true);
      setVerifiedChannel(data.channel || 'whatsapp');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      toast.success(
        data.channel === 'whatsapp'
          ? "🎉 WhatsApp Mobile Verified Successfully!"
          : "🎉 Email Verified Successfully!"
      );
    }
  });

  const handleGroupSelect = (group: any) => {
    setSelectedSlotGroup(group);
    setSelectedSlot(group.availableSlots[0]);
    setStep("details");
  };

  const handleTableSelect = async (facility_id: string, tableName: string, hourlyRate: number) => {
    // For snooker/pool: user picks an available table, we find/create a slot for it
    const today = format(new Date(), "yyyy-MM-dd");
    try {
      const slotsRes = await api.get(`/slots?date=${today}&turf_id=${facility_id}`);
      const availableSlot = slotsRes.data.find((s: any) => s.is_available);
      if (availableSlot) {
        setSelectedSlot(availableSlot);
        setSelectedTableSlot({ name: tableName, rate: hourlyRate });
        setSelectedDate(new Date());
        setSelectedSlotGroup({ time: 'Walk-in Session', price: hourlyRate });
        setStep("details");
      } else {
        toast.error("No available booking slots for this table today.");
      }
    } catch {
      toast.error("Failed to book this table.");
    }
  };

  const handleSendOtp = async (channelOverride?: 'whatsapp' | 'email') => {
    const channelToUse = channelOverride || verificationChannel;
    if (!name.trim()) {
      toast.error("Please enter your name first");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanEmail = email.trim();

    if (channelToUse === 'whatsapp') {
      if (cleanPhone.length !== 10) {
        toast.error("Please enter a valid 10-digit mobile number for WhatsApp verification");
        return;
      }
    } else {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        toast.error("Please enter a valid email address for email verification");
        return;
      }
    }

    setOtpSending(true);
    try {
      const res = await api.post('/bookings/send-otp', {
        name: name.trim(),
        channel: channelToUse,
        phone: cleanPhone,
        email: cleanEmail,
      });
      setOtpSent(true);
      setVerificationChannel(channelToUse);
      if (res.data.verificationLink) {
        setWaLink(res.data.verificationLink);
        // Automatically open WhatsApp in a new tab for 1-tap verification
        try {
          window.open(res.data.verificationLink, '_blank', 'noopener,noreferrer');
        } catch {}
      }
      toast.success(res.data.message || "OTP verification initiated!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      toast.error("Please enter the 4-digit verification code");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await api.post('/bookings/verify-otp', {
        channel: verificationChannel,
        phone: phone.replace(/\D/g, ''),
        email: email.trim(),
        otp: otp.trim(),
      });
      setIsOtpVerified(true);
      setVerifiedChannel(res.data.channel || verificationChannel);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      toast.success(res.data.message || "Verified successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid or expired OTP");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanEmail = email.trim();

    if (!cleanPhone && !cleanEmail) {
      toast.error("Please enter either a mobile number or email address");
      return;
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (cleanEmail && !cleanEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!isOtpVerified) {
      toast.error(
        verificationChannel === 'whatsapp'
          ? "Please verify your mobile number with WhatsApp OTP first"
          : "Please verify your email with the OTP code first"
      );
      return;
    }
    if (cleanPhone) {
      checkFirstTimeEligibility(cleanPhone);
    }
    setStep("confirm");
  };

  const checkFirstTimeEligibility = async (phoneNumber: string) => {
    const clean = phoneNumber.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) return;
    try {
      setCheckingFirstTime(true);
      const res = await api.get(`/coupons/check-first-time?phone=${clean}`);
      if (res.data?.eligible && res.data?.coupon) {
        setFirstTimeOffer(res.data.coupon);
      } else {
        setFirstTimeOffer(null);
      }
    } catch (err) {
      console.error("Failed to check first-time offer", err);
    } finally {
      setCheckingFirstTime(false);
    }
  };

  const applyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a promo code");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      toast.error("Valid 10-digit mobile number required to apply promo");
      return;
    }
    const basePrice = selectedSlotGroup?.price || 0;
    if (basePrice <= 0) return;

    setIsApplyingCoupon(true);
    try {
      const res = await api.post('/coupons/validate', {
        code,
        phone: cleanPhone,
        amount: basePrice,
      });

      if (res.data?.valid) {
        setAppliedCoupon(res.data.coupon);
        setCouponDiscount(res.data.discount_amount);
        setCouponCode(res.data.coupon.code);
        toast.success(`🎉 Offer ${res.data.coupon.code} applied! Saved ₹${res.data.discount_amount}`);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Invalid coupon code";
      toast.error(errMsg);
      setAppliedCoupon(null);
      setCouponDiscount(0);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
    toast.info("Coupon removed");
  };

  const handleConfirmUpiBooking = async () => {
    if (!selectedSlot) return;
    if (!utrNumber || utrNumber.trim().length < 6) {
      toast.error("Please enter the 12-digit UPI Ref ID from your payment app");
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await api.post('/bookings/submit-upi', {
        name,
        phone,
        email,
        slot_id: selectedSlot.id,
        utr_number: utrNumber.trim(),
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
      });

      if (res.data.success) {
        const booked = res.data.bookings ? res.data.bookings[0] : res.data.booking;
        setConfirmedBooking(booked);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#39FF14', '#10b981', '#34d399']
        });
        toast.success("Booking submitted! Payment verification is underway.");
        setStep("pending_approval");
      }
    } catch (err: any) {
      console.error("Booking submission failed:", err);
      toast.error(err.response?.data?.error || "Booking submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setStep("facility");
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setSelectedTableSlot(null);
    setTableStatus([]);
    setName("");
    setPhone("");
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setFirstTimeOffer(null);
  };

  const stepIndex = ["facility", "date", "slot", "details", "confirm"].indexOf(step);
  const stepLabels = ["Sport", "Date", "Slot", "Details", "Confirm"];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          {/* Progress */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-10">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${stepIndex >= i ? "bg-gradient-turf text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}>
                      {i + 1}
                    </div>
                    <span className="text-[10px] text-muted-foreground hidden sm:block">{label}</span>
                  </div>
                  {i < 4 && <div className={`w-6 sm:w-10 h-0.5 mb-4 sm:mb-0 ${stepIndex > i ? "bg-primary" : "bg-border"}`} />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Facility */}
            {step === "facility" && (
              <motion.div key="facility" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-8">
                  <h1 className="font-heading text-3xl lg:text-4xl font-bold mb-2">Choose Your <span className="text-gradient-turf">Sport</span></h1>
                  <p className="text-muted-foreground">What would you like to play today?</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {allFacilities.map((f: any) => (
                    <button key={f.id} onClick={() => handleFacilitySelect(f.facility_type)}
                      className="group text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-turf transition-all duration-300">
                      <div className="h-40 overflow-hidden">
                        <img src={f.image_url || knownImages[f.facility_type] || defaultImage} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      <div className="p-4">
                        <h3 className="font-heading font-semibold text-foreground mb-1">{f.name}</h3>
                        {/* <p className="text-xs text-muted-foreground mb-2">{f.description || "Experience premium sports facilities"}</p> */}
                        <span className="text-xs text-primary font-medium">
                          {f.opening_hour != null ? `${formatHour(f.opening_hour)} – ${formatHour(f.closing_hour)}` : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Date */}
            {step === "date" && (
              <motion.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center">
                <button onClick={() => setStep("facility")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Change sport
                </button>
                <h1 className="font-heading text-3xl lg:text-4xl font-bold mb-2">Pick a <span className="text-gradient-turf">Date</span></h1>
                <p className="text-muted-foreground mb-8">Booking <span className="text-primary font-medium">{facilityName}</span></p>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => date < startOfDay(new Date()) || date > addDays(new Date(), 30)}
                    className="rounded-2xl border border-border bg-card p-4 pointer-events-auto"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Slot / Table View */}
            {step === "slot" && (
              <motion.div key="slot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-8">
                  <h1 className="font-heading text-3xl lg:text-4xl font-bold mb-2">Choose a <span className="text-gradient-turf">Slot</span></h1>
                  <p className="text-muted-foreground">
                    <span className="text-primary font-medium">{facilityName}</span> · {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
                    <button onClick={() => setStep("date")} className="ml-2 text-primary hover:underline text-sm">Change</button>
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {groupedSlots.map((group) => (
                    <button key={group.time} onClick={() => group.isAvailable && handleGroupSelect(group)}
                      disabled={!group.isAvailable}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${!group.isAvailable ? "bg-muted/30 border-border/50 opacity-50 cursor-not-allowed"
                        : selectedSlotGroup?.time === group.time ? "bg-primary/10 border-primary shadow-turf"
                          : "bg-card border-border hover:border-primary/40 hover:shadow-turf cursor-pointer"
                        }`}>
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className={`w-3.5 h-3.5 ${group.isAvailable ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-semibold ${group.isAvailable ? "text-foreground" : "text-muted-foreground"}`}>{group.time.split(' – ')[0]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{group.time}</p>
                      <p className={`text-sm font-bold mt-1 ${group.isAvailable ? "text-primary" : "text-muted-foreground"}`}>₹{group.price}</p>
                      {group.isAvailable ? (
                        <p className="text-[10px] text-primary/80 mt-1 font-medium">
                          {group.availableSlots.length} {facilityData?.pricing_model === "slot" ? "turf" : "table"}s available
                        </p>
                      ) : (
                        <p className="text-[10px] text-destructive mt-1 font-semibold">Booked Full</p>
                      )}
                    </button>
                  ))}

                  {blockingTournament ? (
                    <div className="col-span-full py-12 px-4 text-center border border-border rounded-xl bg-card">
                      <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-foreground mb-2">Turf is Closed for {blockingTournament.name}</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                        This turf is booked from <span className="font-semibold text-foreground">{format(new Date(blockingTournament.start_date), "MMM d, yyyy")}</span> to <span className="font-semibold text-foreground">{format(new Date(blockingTournament.end_date), "MMM d, yyyy")}</span> for a tournament. You can visit the turf to enjoy the matches!
                      </p>
                    </div>
                  ) : isArenaClosed ? (
                    <div className="col-span-full py-16 px-4 text-center border-2 border-destructive/20 rounded-3xl bg-destructive/5">
                      <Lock className="w-16 h-16 text-destructive mx-auto mb-4" />
                      <h3 className="text-2xl font-black text-foreground mb-2">Arena Closed for Today</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed mb-6">
                        The facility is temporarily closed for: <br/> 
                        <span className="font-bold text-foreground text-lg">"{closureReason || "Maintenance"}"</span>
                      </p>
                      <Button onClick={() => setStep("date")} variant="outline" className="rounded-xl font-bold">
                        Check Another Date
                      </Button>
                    </div>
                  ) : groupedSlots.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                      No slots available on this date for {facilityName}. Try another day!
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}

            {/* Step 4: Details with Dual-Channel OTP (WhatsApp or Email) */}
            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto">
                <div className="text-center mb-8">
                  <h1 className="font-heading text-3xl font-bold mb-2">Your <span className="text-gradient-turf">Details</span></h1>
                  <p className="text-muted-foreground text-sm">Verify via WhatsApp or Email to lock in your slot securely</p>
                </div>

                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harshvardhan Patil" className="pl-10 bg-card border-border" />
                    </div>
                  </div>

                  {/* Verification Channel Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Verification Channel *</label>
                    <div className="p-1 bg-secondary/30 rounded-xl border border-border flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isOtpVerified) {
                            setVerificationChannel('whatsapp');
                            setOtpSent(false);
                            setOtp('');
                          }
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                          verificationChannel === 'whatsapp'
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp OTP
                        {isOtpVerified && verifiedChannel === 'whatsapp' && (
                          <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isOtpVerified) {
                            setVerificationChannel('email');
                            setOtpSent(false);
                            setOtp('');
                          }
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                          verificationChannel === 'email'
                            ? "bg-primary/20 text-primary border border-primary/40 shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Mail className="w-3.5 h-3.5" /> Email OTP
                        {isOtpVerified && verifiedChannel === 'email' && (
                          <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Phone Number Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Mobile Number {verificationChannel === 'whatsapp' ? '*' : '(Optional)'}
                      </label>
                      {isOtpVerified && verifiedChannel === 'whatsapp' && (
                        <span className="inline-flex items-center text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <Check className="w-3 h-3 mr-1" /> WhatsApp Verified
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={phone}
                        disabled={isOtpVerified && verifiedChannel === 'whatsapp'}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').substring(0, 10);
                          setPhone(val);
                          if (verificationChannel === 'whatsapp') {
                            setOtpSent(false);
                            setIsOtpVerified(false);
                          }
                        }}
                        placeholder="10-digit mobile number"
                        className={cn("pl-10 bg-card border-border", verificationChannel === 'whatsapp' && !isOtpVerified ? "pr-36" : "")}
                        type="tel"
                      />
                      {verificationChannel === 'whatsapp' && !isOtpVerified && (
                        <button
                          type="button"
                          onClick={() => handleSendOtp('whatsapp')}
                          disabled={otpSending || phone.length !== 10}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold transition-all disabled:opacity-40"
                        >
                          {otpSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : otpSent ? "Resend" : "Verify WhatsApp"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email Address Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Email Address {verificationChannel === 'email' ? '*' : '(Optional)'}
                      </label>
                      {isOtpVerified && verifiedChannel === 'email' && (
                        <span className="inline-flex items-center text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <Check className="w-3 h-3 mr-1" /> Email Verified
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        disabled={isOtpVerified && verifiedChannel === 'email'}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (verificationChannel === 'email') {
                            setOtpSent(false);
                            setIsOtpVerified(false);
                          }
                        }}
                        placeholder="youremail@gmail.com"
                        className={cn("pl-10 bg-card border-border", verificationChannel === 'email' && !isOtpVerified ? "pr-28" : "")}
                      />
                      {verificationChannel === 'email' && !isOtpVerified && (
                        <button
                          type="button"
                          onClick={() => handleSendOtp('email')}
                          disabled={otpSending || !email || !email.includes('@')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all disabled:opacity-40"
                        >
                          {otpSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : otpSent ? "Resend" : "Send OTP"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OTP Entry / 1-Tap Verification Box */}
                  {otpSent && !isOtpVerified && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="p-3.5 bg-secondary/20 rounded-xl border border-primary/30 space-y-3">
                      {verificationChannel === 'whatsapp' ? (
                        <>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            WhatsApp verification ready for <strong className="text-foreground">+91 {phone}</strong>
                          </div>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-extrabold text-xs shadow-lg transition-all"
                            >
                              <MessageCircle className="w-4 h-4 text-slate-950 fill-current" /> Tap to Open WhatsApp &amp; Send "VERIFY" (1-Tap)
                            </a>
                          )}
                          <p className="text-[11px] text-muted-foreground text-center">
                            💡 Simply tap the green button above to open WhatsApp. Hit send, and this page will automatically confirm your mobile number!
                          </p>
                          <div className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
                            — OR ENTER 4-DIGIT CODE MANUALLY —
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Enter the 4-digit verification code sent to <span className="font-semibold text-foreground">{email}</span>
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Input
                          type="text"
                          maxLength={4}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="4-digit OTP"
                          className="bg-card font-mono text-center tracking-widest text-lg font-bold h-10"
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otpVerifying || otp.length < 4}
                          className="bg-gradient-turf text-primary-foreground font-bold text-xs h-10 px-4 shrink-0"
                        >
                          {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Code"}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep("slot")} className="flex-1">Back</Button>
                    <Button onClick={handleSubmit} className="flex-1 bg-gradient-turf text-primary-foreground font-semibold shadow-turf hover:opacity-90">
                      Continue to Payment <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: Direct UPI QR Payment (0% Gateway Fees) */}
            {step === "confirm" && selectedSlot && selectedDate && (() => {
              const basePrice = selectedSlotGroup?.price || 0;
              const finalPayable = Math.max(300, basePrice - couponDiscount);
              const upiPayUrl = `upi://pay?pa=${encodeURIComponent(upiSettings.upi_id)}&pn=${encodeURIComponent("SHRI TRIMURTI FITNESS CLUB")}&am=${finalPayable}&cu=INR`;
              const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(upiPayUrl)}`;

              return (
                <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto">
                  <div className="text-center mb-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30 mb-2">
                      ⚡ 0% Gateway Fee &bull; Direct UPI Payment
                    </span>
                    <h1 className="font-heading text-3xl font-bold mb-1">Scan & <span className="text-gradient-turf">Pay</span></h1>
                    <p className="text-xs text-muted-foreground">Scan with any UPI app on iPhone or Android</p>
                  </div>

                  <div className="rounded-2xl bg-card border border-border p-5 space-y-4 mb-6 shadow-xl">
                    {/* First Time Welcome Offer Auto-Detection Banner */}
                    {firstTimeOffer && !appliedCoupon && (
                      <div className="bg-gradient-to-r from-emerald-500/15 via-[#39FF14]/15 to-emerald-500/15 border border-[#39FF14]/40 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm animate-pulse-slow">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#39FF14]/20 flex items-center justify-center text-[#39FF14] shrink-0">
                            <Gift className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              Welcome Offer! <span className="text-[10px] bg-[#39FF14] text-black font-extrabold px-1.5 py-0.2 rounded">FLAT ₹{firstTimeOffer.discount_value} OFF</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">{firstTimeOffer.description || "Special welcome discount on your first match!"}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => applyCoupon(firstTimeOffer.code)}
                          disabled={isApplyingCoupon}
                          className="h-7 px-3 text-xs font-bold bg-[#39FF14] text-black hover:bg-[#39FF14]/80 shrink-0 shadow-sm"
                        >
                          {isApplyingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    )}

                    {/* Promo Code Input & Management */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-primary" /> Promo Code / Voucher
                        </label>
                        {appliedCoupon && (
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Offer Applied
                          </span>
                        )}
                      </div>

                      {appliedCoupon ? (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                              {appliedCoupon.code}
                            </span>
                            <span className="text-xs font-medium text-emerald-300">
                              -₹{couponDiscount} saved
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={removeCoupon}
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="e.g. WELCOME100"
                            maxLength={20}
                            className="h-9 bg-background border-border font-mono uppercase text-xs font-bold tracking-wider"
                          />
                          <Button
                            size="sm"
                            onClick={() => applyCoupon()}
                            disabled={isApplyingCoupon || !couponCode.trim()}
                            className="h-9 px-4 text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                          >
                            {isApplyingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Booking Mini Summary */}
                    <div className="bg-secondary/30 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-muted-foreground">Sport:</span><span className="font-bold text-foreground">{facilityName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Date & Time:</span><span className="font-bold text-foreground">{format(selectedDate, "EEE, dd MMM")} &bull; {selectedSlotGroup?.time}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Player:</span><span className="font-bold text-foreground">{name} ({phone})</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Slot Base Price:</span><span className="font-medium text-foreground">₹{basePrice}</span></div>
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Offer Discount ({appliedCoupon?.code}):</span>
                          <span>-₹{couponDiscount}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-border/50 font-bold text-sm">
                        <span className="text-muted-foreground">Total Payable:</span>
                        <span className="text-[#39FF14] text-base">₹{finalPayable}</span>
                      </div>
                    </div>

                    {/* High Quality Official QR Code */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner border border-zinc-200">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-2">Scan with GPay / PhonePe / Paytm / BHIM</p>
                      <div className="w-56 h-56 rounded-xl overflow-hidden flex items-center justify-center bg-white p-2">
                        <img
                          src={couponDiscount > 0 ? qrCodeUrl : upiSettings.upi_qr_url}
                          alt="Arena UPI QR"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium mt-1">Exact Payable: <strong className="text-black font-extrabold text-sm">₹{finalPayable}</strong></p>
                    </div>

                    {/* UPI ID with Copy Option */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border">
                      <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Arena UPI ID (VPA)</p>
                        <p className="font-mono font-bold text-sm text-foreground">{upiSettings.upi_id}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(upiSettings.upi_id);
                          setCopiedUpi(true);
                          toast.success("UPI ID copied to clipboard!");
                          setTimeout(() => setCopiedUpi(false), 2000);
                        }}
                        className="h-8 px-3 text-xs font-bold gap-1 border-primary/30 text-primary"
                      >
                        {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedUpi ? "Copied" : "Copy"}
                      </Button>
                    </div>

                    {/* Mobile Direct App Intent Link */}
                    <div className="block sm:hidden">
                      <a
                        href={upiPayUrl}
                        className="w-full py-2.5 px-4 rounded-xl bg-secondary/50 hover:bg-secondary text-xs font-bold text-foreground flex items-center justify-center gap-1.5 border border-border transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-primary" /> Pay ₹{finalPayable} Directly in UPI App
                      </a>
                    </div>

                    {/* UPI Ref ID Input Section */}
                    <div className="border-t border-border pt-4 space-y-2">
                      <label className="text-xs font-bold text-foreground block uppercase tracking-wider">
                        Enter 12-Digit UPI Ref ID
                      </label>
                      <div className="relative">
                        <Input
                          type="text"
                          value={utrNumber}
                          onChange={(e) => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                          placeholder="e.g. 412345678901"
                          maxLength={22}
                          className="bg-background border-border font-mono text-base font-bold tracking-wider"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        💡 Found in your payment app under: <em>UPI Ref ID</em> or <em>Transaction ID</em>.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep("details")} className="flex-1">Back</Button>
                    <Button
                      disabled={isSubmitting || !utrNumber || utrNumber.trim().length < 6}
                      onClick={handleConfirmUpiBooking}
                      className="flex-1 bg-gradient-turf text-primary-foreground font-bold shadow-turf hover:opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit & Reserve"}
                    </Button>
                  </div>
                </motion.div>
              );
            })()}

            {/* Step: Pending Verification Receipt Screen */}
            {(step === "pending_approval" || step === "success") && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-6 glow-turf">
                  <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
                </div>
                <h1 className="font-heading text-3xl font-bold mb-2">Booking <span className="text-gradient-turf">Submitted!</span></h1>
                <p className="text-muted-foreground text-sm mb-6">Payment verification in progress by Shri Trimurti Fitness Club team.</p>

                {/* Digital Receipt Pass */}
                <div id="entry-pass" className="bg-card border-2 border-primary/20 rounded-3xl overflow-hidden shadow-2xl mb-8 relative">
                   <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-turf" />
                   <div className="p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div className="text-left">
                           <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Booking Request</p>
                           <h3 className="font-heading font-bold text-lg">{facilityName}</h3>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Date</p>
                           <p className="font-bold text-sm tracking-tight">{selectedDate && format(selectedDate, "dd MMM yyyy")}</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-secondary/30 border border-border/80 space-y-2 text-left text-xs mb-6">
                        <div className="flex justify-between"><span className="text-muted-foreground">Booking ID:</span><span className="font-mono font-bold text-[#39FF14]">{confirmedBooking?.id?.substring(0, 8).toUpperCase() || "PENDING"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span className="font-bold text-foreground">{name}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Time Slot:</span><span className="font-bold text-foreground">{selectedSlotGroup?.time}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="font-bold text-foreground">₹{selectedSlotGroup?.price}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Submitted UPI Ref ID:</span><span className="font-mono font-bold text-amber-400">{utrNumber || confirmedBooking?.utr_number}</span></div>
                        <div className="flex justify-between pt-1 border-t border-border/50 items-center">
                          <span className="text-muted-foreground">Status:</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            confirmedBooking?.status === 'confirmed'
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}>
                            {confirmedBooking?.status === 'confirmed' ? "Confirmed" : "Awaiting Staff Approval"}
                          </span>
                        </div>
                      </div>

                      {confirmedBooking?.qr_token && (
                        <div className="my-5 p-4 rounded-2xl bg-white text-zinc-900 border border-zinc-200 flex flex-col items-center justify-center text-center shadow-sm">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 mb-2">Official Gate Entry Pass</p>
                          <QRCodeSVG value={confirmedBooking.qr_token} size={150} level="H" />
                          <p className="text-[11px] text-zinc-600 font-medium mt-2">Show this QR code at turf gate for instant check-in</p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground leading-relaxed text-center">
                        A booking receipt and your official Entry Pass QR code have been sent to {email ? <strong className="text-foreground">{email}</strong> : <strong className="text-foreground">+91 {phone} (WhatsApp)</strong>}. Once club staff verifies the UPI transfer, your slot is confirmed!
                      </p>
                   </div>
                   <div className="bg-black/5 border-t border-border p-3 flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Direct Bank Verification Protected</span>
                   </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    onClick={() => setShowTeamSplit(true)}
                    className="h-12 rounded-xl font-bold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/20 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" /> Share Match & Split with Teammates (WhatsApp)
                  </Button>

                  <Button 
                    onClick={() => {
                      const node = document.getElementById('entry-pass');
                      if (node) {
                        toPng(node).then((dataUrl) => {
                          const link = document.createElement('a');
                          link.download = `ShriTrimurti-Receipt-${name}.png`;
                          link.href = dataUrl;
                          link.click();
                        });
                      }
                    }} 
                    variant="outline" 
                    className="h-12 rounded-xl font-bold border-2"
                  >
                    <Download className="mr-2 w-4 h-4" /> Download Booking Receipt
                  </Button>
                  <Button onClick={resetBooking} className="h-12 rounded-xl bg-gradient-turf text-primary-foreground font-bold shadow-turf hover:opacity-90">
                    Done & Book Another Slot
                  </Button>
                </div>

                <TeamSplitModal
                  isOpen={showTeamSplit}
                  onClose={() => setShowTeamSplit(false)}
                  customerName={name || "Player"}
                  facilityName={facilityName}
                  date={selectedDate ? format(selectedDate, "dd MMM yyyy") : ""}
                  timeSlot={selectedSlotGroup?.time || ""}
                  totalPrice={selectedSlotGroup?.price || 0}
                  defaultUpiOrPhone={phone}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <FooterSection />
    </div>
  );
}
