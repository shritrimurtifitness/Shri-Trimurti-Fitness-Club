import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  Check, 
  Phone,
  ExternalLink 
} from "lucide-react";
import { toast } from "sonner";
import { 
  getWhatsAppUrl, 
  generateAdminBookingConfirmMessage, 
  generateAdminReminderMessage, 
  generateAdminUtrRequestMessage 
} from "@/lib/whatsapp";

interface BookingInfo {
  id: string;
  customerName: string;
  customerPhone: string;
  facilityName: string;
  date: string;
  timeSlot: string;
  amount: number;
  paidAmount: number;
  rawStatus?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingInfo | null;
}

type TemplateType = "confirm" | "reminder" | "utr_request" | "custom";

export default function AdminWhatsAppModal({ isOpen, onClose, booking }: Props) {
  if (!booking) return null;

  const [activeTemplate, setActiveTemplate] = useState<TemplateType>(
    booking.rawStatus === "pending_verification" ? "utr_request" : "confirm"
  );
  const [customText, setCustomText] = useState("");
  const [copied, setCopied] = useState(false);

  const confirmMsg = generateAdminBookingConfirmMessage({
    customerName: booking.customerName,
    facilityName: booking.facilityName,
    date: booking.date,
    timeSlot: booking.timeSlot,
    bookingId: booking.id,
    totalPrice: booking.amount,
    paidAmount: booking.paidAmount
  });

  const reminderMsg = generateAdminReminderMessage({
    customerName: booking.customerName,
    facilityName: booking.facilityName,
    timeSlot: booking.timeSlot
  });

  const utrMsg = generateAdminUtrRequestMessage({
    customerName: booking.customerName,
    facilityName: booking.facilityName,
    date: booking.date,
    timeSlot: booking.timeSlot
  });

  const getActiveMessage = () => {
    switch (activeTemplate) {
      case "confirm":
        return confirmMsg;
      case "reminder":
        return reminderMsg;
      case "utr_request":
        return utrMsg;
      case "custom":
        return customText || confirmMsg;
    }
  };

  const handleOpenWhatsApp = () => {
    const text = getActiveMessage();
    const url = getWhatsAppUrl(text, booking.customerPhone);
    window.open(url, "_blank");
    toast.success(`Opening WhatsApp for ${booking.customerName}`);
    onClose();
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getActiveMessage());
    setCopied(true);
    toast.success("Message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 bg-gradient-to-r from-emerald-950/60 via-card to-card border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-heading font-black">
              <span className="w-8 h-8 rounded-full bg-[#25D366]/20 text-[#25D366] flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </span>
              WhatsApp Quick Action
            </DialogTitle>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-full text-foreground">
              <Phone className="w-3 h-3 text-muted-foreground" />
              +91 {booking.customerPhone}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {booking.customerName} • {booking.facilityName} ({booking.date})
          </p>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Template Selectors */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Pre-formatted Message</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveTemplate("confirm")}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col gap-1 ${
                  activeTemplate === "confirm"
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold shadow-sm"
                    : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Confirmation
                </div>
                <span className="text-[10px] text-muted-foreground line-clamp-1">Match pass & location</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTemplate("reminder")}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col gap-1 ${
                  activeTemplate === "reminder"
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold shadow-sm"
                    : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Match Reminder
                </div>
                <span className="text-[10px] text-muted-foreground line-clamp-1">1-hr reporting alert</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTemplate("utr_request")}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col gap-1 ${
                  activeTemplate === "utr_request"
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold shadow-sm"
                    : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  Request UTR
                </div>
                <span className="text-[10px] text-muted-foreground line-clamp-1">Pending payment</span>
              </button>
            </div>
          </div>

          {/* Message Text Preview / Editor */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message Body</label>
              <button
                type="button"
                onClick={() => {
                  setCustomText(getActiveMessage());
                  setActiveTemplate("custom");
                }}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                {activeTemplate === "custom" ? "Editing Custom" : "Edit Message"}
              </button>
            </div>

            {activeTemplate === "custom" ? (
              <Textarea
                rows={7}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="bg-secondary/30 font-mono text-xs leading-relaxed"
                placeholder="Type your message..."
              />
            ) : (
              <div className="bg-secondary/30 border border-border/80 rounded-xl p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed select-all">
                {getActiveMessage()}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyText}
              className="flex-1 h-11 text-xs font-bold gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy Text"}
            </Button>

            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-[2] h-11 text-sm font-bold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/20 gap-2"
            >
              <Send className="w-4 h-4" />
              Send via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
