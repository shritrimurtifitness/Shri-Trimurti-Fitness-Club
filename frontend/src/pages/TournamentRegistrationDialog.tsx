import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  ShieldCheck, 
  Trophy, 
  CheckCircle2, 
  Copy, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Smartphone, 
  QrCode,
  Clock,
  Sparkles,
  Mail,
  Send,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Tournament } from "./admin/AdminTournaments";
import { getWhatsAppUrl, generateTournamentTeamShareMessage } from "@/lib/whatsapp";

interface Props {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TournamentRegistrationDialog({ tournament, isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"details" | "payment">("details");
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Email OTP state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  // UPI payment & UTR state
  const [utrNumber, setUtrNumber] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedUtr, setSubmittedUtr] = useState("");

  const [upiSettings, setUpiSettings] = useState({
    upi_id: "harshvardhanp@slc",
    upi_qr_url: "/upi-qr.png"
  });

  // Fetch UPI credentials and QR settings
  useEffect(() => {
    if (isOpen) {
      api.get('/settings/contact').then(res => {
        if (res.data?.upi_id || res.data?.upi_qr_url) {
          setUpiSettings({
            upi_id: res.data.upi_id || "harshvardhanp@slc",
            upi_qr_url: res.data.upi_qr_url || "/upi-qr.png"
          });
        }
      }).catch(err => console.error("Failed to fetch UPI settings", err));
    }
  }, [isOpen]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep("details");
      setTeamName("");
      setCaptainName("");
      setPhone("");
      setEmail("");
      setOtp("");
      setOtpSent(false);
      setIsOtpVerified(false);
      setUtrNumber("");
      setIsSuccess(false);
      setSubmittedUtr("");
    }
  }, [isOpen]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiSettings.upi_id);
    setCopiedUpi(true);
    toast.success("UPI ID copied to clipboard!");
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Send OTP via Brevo API
  const handleSendOtp = async () => {
    if (!captainName.trim()) {
      return toast.error("Please enter the Captain's name first");
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return toast.error("Please enter a valid email address");
    }

    setOtpSending(true);
    try {
      const res = await api.post('/tournaments/send-otp', {
        email: cleanEmail,
        name: captainName.trim(),
        tournament_id: tournament.id
      });
      setOtpSent(true);
      toast.success(res.data?.message || "Verification code sent to your email!");
    } catch (err: any) {
      console.error("Send OTP error:", err);
      toast.error(err.response?.data?.error || "Failed to send OTP. Please check your email.");
    } finally {
      setOtpSending(false);
    }
  };

  // Verify 4-digit OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      return toast.error("Please enter the 4-digit OTP code");
    }

    setOtpVerifying(true);
    try {
      const res = await api.post('/tournaments/verify-otp', {
        email: email.trim(),
        otp: otp.trim()
      });
      setIsOtpVerified(true);
      toast.success(res.data?.message || "Email verified successfully!");
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      toast.error(err.response?.data?.error || "Invalid or expired OTP");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleNextToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return toast.error("Please enter a team name");
    if (!captainName.trim()) return toast.error("Please enter captain's name");
    if (phone.length !== 10) return toast.error("Please enter a valid 10-digit mobile number");
    if (!isOtpVerified) return toast.error("Please verify captain's email with the OTP code first");

    setStep("payment");
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrNumber.trim();
    if (cleanUtr.length < 6) {
      return toast.error("Please enter a valid 12-digit UPI Reference / UTR number");
    }

    setIsSubmitting(true);
    try {
      await api.post(`/tournaments/${tournament.id}/register`, {
        team_name: teamName.trim(),
        captain_name: captainName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        utr_number: cleanUtr
      });

      setSubmittedUtr(cleanUtr);
      setIsSuccess(true);
      toast.success("Tournament registration submitted! Confirmation sent to your email.");
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error(err.response?.data?.error || "Registration failed. Please check details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Confirmation Screen
  if (isSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={() => { setIsSuccess(false); onSuccess(); }}>
        <DialogContent className="sm:max-w-md text-center py-8 px-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto mb-3">
            <Clock className="w-3.5 h-3.5" /> Awaiting Staff UTR Verification
          </span>

          <h2 className="text-2xl font-heading font-black mb-1">Registration Received!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A confirmation receipt has been emailed to <strong className="text-foreground">{email}</strong>. Once staff verifies the payment, your official match pass will be delivered to your inbox.
          </p>

          <div className="bg-card border border-border rounded-xl p-4 text-left space-y-2.5 text-xs mb-6">
            <div className="flex justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Tournament</span>
              <span className="font-bold text-foreground truncate max-w-[200px]">{tournament.name}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Team Name</span>
              <span className="font-bold text-foreground">{teamName}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Captain</span>
              <span className="font-semibold text-foreground">{captainName}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Verified Email</span>
              <span className="font-mono text-emerald-400 font-semibold">{email}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Entry Fee Paid</span>
              <span className="font-bold text-emerald-400">₹{tournament.entry_fee} (0% Fee)</span>
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-muted-foreground font-medium">Submitted Bank UTR</span>
              <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {submittedUtr}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Button 
              type="button"
              onClick={() => {
                const text = generateTournamentTeamShareMessage({
                  teamName,
                  captainName,
                  tournamentName: tournament.name,
                  entryFee: tournament.entry_fee,
                  registrationId: submittedUtr,
                });
                window.open(getWhatsAppUrl(text), "_blank");
              }}
              className="w-full h-11 text-sm font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <MessageSquare className="w-4 h-4 fill-white" /> Share Team Entry on WhatsApp
            </Button>

            <Button 
              onClick={() => { setIsSuccess(false); onSuccess(); }} 
              variant="outline"
              className="w-full h-10 text-sm font-semibold border-border hover:bg-secondary/60"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiSettings.upi_id)}&pn=${encodeURIComponent("SHRI TRIMURTI FITNESS CLUB")}&am=${tournament.entry_fee}&cu=INR&tn=${encodeURIComponent(`Reg:${teamName || 'Tournament'}`)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border/80">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-heading font-black">
              <Trophy className="w-5 h-5 text-primary" /> Register Team
            </DialogTitle>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> 0% Platform Fee
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {tournament.name} • Entry Fee: <strong className="text-foreground">₹{tournament.entry_fee}</strong>
          </p>
        </DialogHeader>

        {step === "details" ? (
          <form onSubmit={handleNextToPayment} className="p-6 space-y-4">
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Name</Label>
                <Input 
                  value={teamName} 
                  onChange={(e) => setTeamName(e.target.value)} 
                  required 
                  placeholder="e.g. Phoenix Titans FC" 
                  className="bg-muted/40 font-medium" 
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Captain's Full Name</Label>
                  <Input 
                    value={captainName} 
                    onChange={(e) => setCaptainName(e.target.value)} 
                    required 
                    placeholder="e.g. Rahul Patil" 
                    className="bg-muted/40 font-medium" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Captain's Mobile</Label>
                  <div className="flex bg-muted/40 border border-border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                    <span className="flex items-center justify-center px-2.5 bg-muted text-muted-foreground border-r border-border text-xs font-bold">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      className="w-full p-2 bg-transparent outline-none text-sm font-mono"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Captain's Email with Brevo OTP Verification (Option B) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Captain's Email (OTP Verified)
                  </Label>
                  {isOtpVerified && (
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <Check className="w-3 h-3 mr-0.5" /> Verified
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Input 
                    type="email"
                    value={email}
                    disabled={isOtpVerified}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setOtpSent(false);
                      setIsOtpVerified(false);
                    }}
                    required 
                    placeholder="captain@example.com" 
                    className="bg-muted/40 font-medium pr-24 disabled:opacity-80" 
                  />
                  {!isOtpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending || !email || !email.includes('@')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all disabled:opacity-40"
                    >
                      {otpSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : otpSent ? "Resend" : "Send OTP"}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Official match pass and registration receipt will be sent to this email.
                </p>

                {/* OTP Input Box */}
                {otpSent && !isOtpVerified && (
                  <div className="p-3 bg-secondary/30 rounded-xl border border-primary/30 space-y-2 mt-2 animate-in fade-in duration-200">
                    <p className="text-xs text-muted-foreground">
                      Enter the 4-digit code sent to <strong className="text-foreground">{email}</strong>
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        maxLength={4}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="4-digit OTP"
                        className="bg-background font-mono text-center tracking-widest text-lg font-bold h-9"
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otp.length < 4}
                        className="bg-gradient-turf text-primary-foreground font-bold text-xs h-9 px-4 shrink-0"
                      >
                        {otpVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify Code"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Zero Platform Fee Summary Box */}
            <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Official Tournament Entry Fee</span>
                <span className="text-foreground font-semibold">₹{tournament.entry_fee}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Platform / Gateway Surcharge</span>
                <span className="text-emerald-400 font-bold">₹0.00 (0% Fee)</span>
              </div>
              <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-foreground">Total Payable Amount</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Direct Arena UPI Transfer
                  </p>
                </div>
                <div className="text-2xl font-black text-emerald-400">₹{tournament.entry_fee}</div>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={!teamName.trim() || !captainName.trim() || phone.length < 10 || !isOtpVerified} 
              className="w-full h-11 text-base font-bold bg-gradient-turf text-primary-foreground shadow-turf transition-all hover:opacity-95 disabled:opacity-50"
            >
              {!isOtpVerified ? "Verify Email to Continue" : "Proceed to UPI Payment"} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmitRegistration} className="p-6 space-y-4">
            {/* Back to details link */}
            <button
              type="button"
              onClick={() => setStep("details")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Team Details
            </button>

            {/* Arena QR & UPI Box */}
            <div className="bg-gradient-to-br from-card to-muted/20 border border-border rounded-2xl p-4 text-center space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-primary" /> Scan & Pay via Any UPI App
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  ₹{tournament.entry_fee} Exact
                </span>
              </div>

              {/* QR Code Container */}
              <div className="inline-block bg-white p-3 rounded-2xl shadow-lg border border-zinc-200">
                <img
                  src={upiSettings.upi_qr_url}
                  alt="Arena Tournament UPI QR"
                  className="w-36 h-36 object-contain mx-auto rounded-lg"
                />
              </div>

              {/* UPI ID + 1-Click Copy */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium">Or pay directly to Arena UPI ID:</p>
                <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                  <div className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-foreground truncate">
                    {upiSettings.upi_id}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUpi}
                    className="h-8 px-2.5 gap-1 text-xs shrink-0 font-semibold"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUpi ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              {/* Mobile Deep Link */}
              <div className="pt-0.5">
                <a
                  href={upiDeepLink}
                  className="inline-flex md:hidden items-center justify-center gap-1.5 w-full py-2 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Tap to Open GPay / PhonePe / Paytm
                </a>
              </div>
            </div>

            {/* UTR Reference Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  12-Digit Bank UTR / UPI Ref Number
                </Label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {utrNumber.trim().length}/12
                </span>
              </div>
              <Input
                type="text"
                placeholder="e.g. 429812345678"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                maxLength={24}
                required
                className="bg-background font-mono font-bold text-sm tracking-wider uppercase"
              />
              <p className="text-[10px] text-muted-foreground">
                Found on your payment success screen in GPay, PhonePe, Paytm, or your bank app.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || utrNumber.trim().length < 6}
              className="w-full h-11 text-base font-bold bg-gradient-turf text-primary-foreground shadow-turf transition-all hover:opacity-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting & Sending Receipt...
                </>
              ) : (
                "Submit Registration & UTR"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
