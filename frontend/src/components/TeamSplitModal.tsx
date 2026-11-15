import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  MessageSquare, 
  Copy, 
  Check, 
  Plus, 
  Minus, 
  Share2, 
  IndianRupee,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { generateTeamSplitMessage, getWhatsAppUrl } from "@/lib/whatsapp";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  facilityName: string;
  date: string;
  timeSlot: string;
  totalPrice: number;
  defaultUpiOrPhone?: string;
}

export default function TeamSplitModal({
  isOpen,
  onClose,
  customerName,
  facilityName,
  date,
  timeSlot,
  totalPrice,
  defaultUpiOrPhone = ""
}: Props) {
  const [playerCount, setPlayerCount] = useState(12);
  const [captainUpi, setCaptainUpi] = useState(defaultUpiOrPhone);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const perHead = Math.ceil(totalPrice / Math.max(1, playerCount));

  const messageText = generateTeamSplitMessage({
    customerName,
    facilityName,
    date,
    timeSlot,
    totalPrice,
    playerCount,
    captainUpi: captainUpi.trim()
  });

  const handleShareWhatsApp = () => {
    const url = getWhatsAppUrl(messageText);
    window.open(url, "_blank");
    toast.success("Opening WhatsApp to share with your squad!");
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    toast.success("WhatsApp message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-full sm:max-w-md mx-auto p-0 rounded-3xl border border-border/80 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header with WhatsApp Theme Accent */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-3 bg-gradient-to-r from-emerald-950/60 via-card to-card border-b border-border shrink-0 text-left">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-heading font-black">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <span>Team Split & Share</span>
            </DialogTitle>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 shrink-0">
              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Auto Split
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Split the turf fee equally and forward match details to your squad!
          </p>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Compact Live Calculation Banner */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Each Player's Share</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-heading">₹{perHead}</span>
                <span className="text-[11px] text-muted-foreground font-semibold">/ player</span>
              </div>
            </div>
            <div className="text-right bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1.5">
              <p className="text-[10px] uppercase font-bold text-emerald-400">Total ₹{totalPrice}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{playerCount} players</p>
            </div>
          </div>

          {/* Player Count Stepper */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Squad Size</span>
              <span className="text-foreground font-mono font-bold text-xs">{playerCount} Players</span>
            </Label>
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPlayerCount(Math.max(2, playerCount - 1))}
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl"
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>

              <div className="flex-1 flex gap-1">
                {[8, 10, 11, 12, 14, 16].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPlayerCount(count)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      playerCount === count
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPlayerCount(Math.min(30, playerCount + 1))}
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Captain UPI / Contact for Collecting share */}
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Captain's UPI ID / Phone (Optional)
            </Label>
            <Input
              type="text"
              value={captainUpi}
              onChange={(e) => setCaptainUpi(e.target.value)}
              placeholder="e.g. 9876543210@upi or 9876543210"
              className="bg-muted/40 font-mono text-xs h-9"
            />
          </div>

          {/* Collapsible Formatted Message Preview */}
          <div className="space-y-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between w-full hover:text-foreground transition-colors py-1"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp Message Preview
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {showPreview ? "Hide ▲" : "Preview ▼"}
              </span>
            </button>

            {showPreview && (
              <div className="bg-secondary/30 border border-border/80 rounded-xl p-2.5 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed select-all">
                {messageText}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-3 sm:p-4 bg-card/95 backdrop-blur-md border-t border-border shrink-0 mt-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyMessage}
            className="flex-1 h-11 text-xs font-bold gap-1.5 rounded-xl border-border"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Text"}</span>
          </Button>

          <Button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-[2] h-11 text-xs sm:text-sm font-bold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/20 gap-2 rounded-xl"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span>Share on WhatsApp</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
