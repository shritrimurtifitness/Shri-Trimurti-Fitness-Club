import { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Clock, Send, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  working_hours: string;
  map_embed_url?: string;
}

export default function ContactSection() {
  const [contact, setContact] = useState<ContactInfo>({
    address: "Kudire Factory , Sangrul Fata , Koparde",
    phone: "+91 9595153006",
    email: "shritrimurtifitness@gmail.com",
    working_hours: "Mon–Sun: 5:00 AM – 11:00 PM",
    map_embed_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3821.6516423908665!2d74.120735!3d16.6943068!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc1adfbed242d0d%3A0x78d9a54fdca8460e!2sShri%20Trimurti%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1794397156504!5m2!1sen!2sin",
  });

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSport, setFormSport] = useState("Cricket");
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fetchContact = () => {
    api.get("/settings/contact")
      .then((res) => {
        if (res.data) {
          setContact((prev) => ({
            ...prev,
            ...res.data,
            address: res.data.address || prev.address,
            phone: res.data.phone || prev.phone,
            email: res.data.email || prev.email,
            working_hours: res.data.working_hours || prev.working_hours,
            map_embed_url: res.data.map_embed_url || prev.map_embed_url,
          }));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchContact();
  }, []);

  useSocket("settings_updated", fetchContact);

  const extractSrc = (value: string) => {
    if (!value) return "";
    const match = value.match(/src=["']([^"']+)["']/i);
    return match ? match[1] : value.trim();
  };

  const mapSrc = contact.map_embed_url
    ? extractSrc(contact.map_embed_url)
    : contact.address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(
        contact.address + ", Maharashtra"
      )}&t=&z=14&ie=UTF8&iwloc=&output=embed`
    : "";

  const cleanPhone = contact.phone.replace(/[^0-9]/g, "") || "919595153006";

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }

    const text = `Hi SHRI TRIMURTI FITNESS CLUB!\n\nName: ${formName}\nPhone: ${formPhone}\nInterested Sport: ${formSport}\nMessage: ${formMessage || "I want to inquire about turf availability."}`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

    setIsSubmitted(true);
    toast.success("Opening WhatsApp with your inquiry details...");

    setTimeout(() => {
      window.open(waUrl, "_blank");
      setIsSubmitted(false);
      setFormName("");
      setFormPhone("");
      setFormMessage("");
    }, 800);
  };

  const items = [
    {
      icon: MapPin,
      label: "Arena Location",
      value: contact.address,
      href: contact.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
        : undefined,
    },
    {
      icon: Phone,
      label: "Phone Support",
      value: contact.phone,
      href: contact.phone ? `tel:${contact.phone}` : undefined,
    },
    {
      icon: Mail,
      label: "Email Address",
      value: contact.email,
      href: contact.email ? `mailto:${contact.email}` : undefined,
    },
    {
      icon: Clock,
      label: "Arena Hours",
      value: contact.working_hours,
    },
  ].filter((i) => i.value);

  return (
    <section id="contact-section" className="py-20 lg:py-28 bg-muted/20 border-t border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Get In Touch
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-foreground mb-3">
            Visit Our <span className="text-gradient-turf">Arena</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Drop by, call us directly, or send an inquiry — we're ready to host your next match.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto mb-12">
          {/* Left Column: Contact Cards & Quick Action Buttons */}
          <div className="lg:col-span-5 space-y-4">
            {items.map((item, i) => {
              const Icon = item.icon;
              const Wrapper: any = item.href ? "a" : "div";
              return (
                <Wrapper
                  key={i}
                  {...(item.href
                    ? {
                        href: item.href,
                        target: item.href.startsWith("http") ? "_blank" : undefined,
                        rel: "noopener noreferrer",
                      }
                    : {})}
                  className="flex items-start gap-4 p-4 sm:p-5 bg-card border border-border rounded-2xl hover:border-primary/40 transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      {item.label}
                    </p>
                    <p className="text-foreground font-semibold text-sm sm:text-base break-words">
                      {item.value}
                    </p>
                  </div>
                </Wrapper>
              );
            })}

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl font-bold text-sm transition-colors"
              >
                <Phone className="w-4 h-4 text-primary" /> Call Now
              </a>

              <a
                href={`https://wa.me/${cleanPhone}?text=Hi%20Shri%20Trimurti%20Fitness%20Club,%20I%20have%20an%20inquiry.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>

            {contact.address && (
              <a
                href="https://maps.app.goo.gl/XCxniFWMMtnfw2MJA"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-gradient-turf text-primary-foreground rounded-xl font-bold text-sm shadow-turf hover:opacity-95 transition-opacity"
              >
                <Send className="w-4 h-4" /> Get Turn-by-Turn Directions
              </a>
            )}
          </div>

          {/* Right Column: Send Inquiry Form */}
          <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
            <h3 className="font-heading font-bold text-xl sm:text-2xl text-foreground mb-2">
              Send an Arena Inquiry
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              Fill out this quick form to reserve slots for tournaments, corporate events, or regular matches.
            </p>

            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inquiry-name" className="text-xs font-semibold">Your Full Name *</Label>
                  <Input
                    id="inquiry-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Harshvardhan Patil"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inquiry-phone" className="text-xs font-semibold">Phone / WhatsApp Number *</Label>
                  <Input
                    id="inquiry-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inquiry-sport" className="text-xs font-semibold">Sport / Purpose</Label>
                <select
                  id="inquiry-sport"
                  value={formSport}
                  onChange={(e) => setFormSport(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Cricket Turf">Cricket Turf</option>
                  <option value="Football Turf">Football Turf</option>
                  <option value="Tournament / Corporate Booking">Tournament / Corporate Booking</option>
                  <option value="Other Inquiry">Other Inquiry</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inquiry-message" className="text-xs font-semibold">Message / Preferred Date & Time</Label>
                <textarea
                  id="inquiry-message"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="e.g. Looking to book on Sunday evening for 12 players..."
                  className="w-full min-h-[100px] bg-background border border-input rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitted}
                className="w-full h-12 bg-gradient-turf text-primary-foreground font-bold shadow-turf hover:opacity-95"
              >
                {isSubmitted ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Redirecting to WhatsApp...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Send Inquiry via WhatsApp
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Embedded Map */}
        <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-border bg-card min-h-[340px] shadow-sm max-w-6xl mx-auto">
          {mapSrc ? (
            <iframe
              title="SHRI TRIMURTI FITNESS CLUB location map"
              src={mapSrc}
              className="w-full h-[360px] sm:h-[420px]"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-[360px] flex items-center justify-center text-muted-foreground text-sm">
              Kudire Factory , Sangrul Fata , Koparde
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
