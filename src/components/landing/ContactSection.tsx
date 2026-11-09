import { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import api from "@/lib/api";

interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  working_hours: string;
  map_embed_url?: string;
}

export default function ContactSection() {
  const [contact, setContact] = useState<ContactInfo>({
    address: "",
    phone: "",
    email: "",
    working_hours: "",
    map_embed_url: "",
  });

  useEffect(() => {
    api.get("/settings/contact")
      .then(res => setContact(res.data))
      .catch(() => { });
  }, []);

  // Accept either a raw URL or a full <iframe> snippet pasted by admin
  const extractSrc = (value: string) => {
    if (!value) return "";
    const match = value.match(/src=["']([^"']+)["']/i);
    return match ? match[1] : value.trim();
  };

  const mapSrc = contact.map_embed_url
    ? extractSrc(contact.map_embed_url)
    : contact.address
      ? `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}&output=embed`
      : "";

  const items = [
    { icon: MapPin, label: "Visit Us", value: contact.address, href: contact.address ? `https://www.google.com/maps?q=${encodeURIComponent(contact.address)}` : undefined },
    { icon: Phone, label: "Call Us", value: contact.phone, href: contact.phone ? `tel:${contact.phone}` : undefined },
    { icon: Mail, label: "Email Us", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
    { icon: Clock, label: "Working Hours", value: contact.working_hours },
  ].filter(i => i.value);

  return (
    <section id="contact-section" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 mb-4 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Get in touch
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-3">
            Visit Our <span className="text-gradient-turf">Arena</span>
          </h2>
          <p className="text-muted-foreground">
            Drop by, call, or send us a message - we'd love to host your next game.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Contact info cards */}
          <div className="space-y-4">
            {items.map((item, i) => {
              const Icon = item.icon;
              const Wrapper: any = item.href ? "a" : "div";
              return (
                <Wrapper
                  key={i}
                  {...(item.href ? { href: item.href, target: item.href.startsWith("http") ? "_blank" : undefined, rel: "noopener noreferrer" } : {})}
                  className="flex items-start gap-4 p-5 bg-card border border-border rounded-2xl hover:border-primary/40 hover:shadow-md transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-foreground font-medium break-words">{item.value}</p>
                  </div>
                </Wrapper>
              );
            })}

            {contact.address && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(contact.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                <Send className="w-4 h-4" /> Get Directions
              </a>
            )}
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden border border-border bg-card min-h-[360px] shadow-sm">
            {mapSrc ? (
              <iframe
                title="Shri Trimurti Sports Arena location"
                src={mapSrc}
                className="w-full h-full min-h-[360px]"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full min-h-[360px] flex items-center justify-center text-muted-foreground text-sm">
                Map will appear once an address is set in admin settings.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
