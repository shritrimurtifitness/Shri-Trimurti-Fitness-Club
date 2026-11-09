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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border">
        {/* Header with WhatsApp Theme Accent */}
        <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-emerald-950/60 via-card to-card border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-heading font-black">
              <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </span>
              Team Split & WhatsApp Share
            </DialogTitle>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Auto Calculator
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Calculate each player's share and forward ready-made match details directly to your team group!
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Live Calculation Banner */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Each Player's Share</p>
            <div className="flex items-baseline justify-center gap-1 my-1">
              <span className="text-3xl font-black text-emerald-400 font-heading">₹{perHead}</span>
              <span className="text-xs text-muted-foreground font-semibold">/ player</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Total ₹{totalPrice} split equally across {playerCount} players
            </p>
          </div>

          {/* Player Count Stepper */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Squad Size (Players)</span>
              <span className="text-foreground font-mono font-bold">{playerCount} Players</span>
            </Label>
            
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPlayerCount(Math.max(2, playerCount - 1))}
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <div className="flex-1 flex gap-1.5">
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
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Captain UPI / Contact for Collecting share */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Captain's UPI ID / GPay Number (Optional)
            </Label>
            <Input
              type="text"
              value={captainUpi}
              onChange={(e) => setCaptainUpi(e.target.value)}
              placeholder="e.g. 9876543210@upi or 9876543210"
              className="bg-muted/40 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Included in the WhatsApp message so teammates know where to send their share.
            </p>
          </div>

          {/* Formatted Message Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              WhatsApp Message Preview
            </Label>
            <div className="bg-secondary/30 border border-border/80 rounded-xl p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed select-all">
              {messageText}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyMessage}
              className="flex-1 h-11 text-xs font-bold gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy Text"}
            </Button>

            <Button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-[2] h-11 text-sm font-bold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/20 gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share on WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
