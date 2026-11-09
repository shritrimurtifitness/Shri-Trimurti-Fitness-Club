import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-3h2.4V9.4c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 3h-2.2v7A10 10 0 0 0 22 12Z"/></svg>
);
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
);
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M18.244 2H21l-6.52 7.45L22 22h-6.79l-4.78-6.17L4.8 22H2l7.05-8.05L2 2h6.91l4.32 5.71L18.244 2Zm-2.38 18h1.83L8.27 4H6.32l9.544 16Z"/></svg>
);
import logoImage from "@/assets/logo.png";
import api from "@/lib/api";

interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  working_hours: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
}

export default function FooterSection() {
  const [contact, setContact] = useState<ContactInfo>({
    address: "",
    phone: "",
    email: "",
    working_hours: "",
    facebook_url: "",
    instagram_url: "",
    twitter_url: "",
  });

  useEffect(() => {
    api.get("/settings/contact")
      .then(res => setContact(res.data))
      .catch(() => {});
  }, []);

  const socials = [
    { icon: FacebookIcon, url: contact.facebook_url, label: "Facebook" },
    { icon: InstagramIcon, url: contact.instagram_url, label: "Instagram" },
    { icon: TwitterIcon, url: contact.twitter_url, label: "Twitter" },
  ].filter(s => s.url);

  return (
    <footer id="contact" className="py-16 border-t border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img
                src={logoImage}
                alt="Shri Trimurti Sports Arena logo"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/40"
              />
              <span className="font-heading font-bold text-xl text-foreground">
                Shri Trimurti Sports <span className="text-gradient-turf">Arena</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Premium sports arena with cricket turf, snooker & pool. Book online, show up, and play.
            </p>
            {socials.length > 0 && (
              <div className="flex items-center gap-2">
                {socials.map(({ icon: Icon, url, label }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-1">
            <h4 className="font-heading font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { name: "Home", path: "/" },
                { name: "Book Now", path: "/book" },
                { name: "Facilities", path: "/#facilities" },
                { name: "Pricing", path: "/#pricing" },
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1">
            <h4 className="font-heading font-semibold text-foreground mb-4">Our Sports</h4>
            <ul className="space-y-2">
              {["Cricket Nets", "Snooker Tables", "Pool Tables", "Tournaments"].map((s) => (
                <li key={s} className="text-sm text-muted-foreground">{s}</li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <h4 className="font-heading font-semibold text-foreground mb-4">Contact</h4>
            <ul className="space-y-3">
              {contact.address && (
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  {contact.address}
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                  <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">{contact.phone}</a>
                </li>
              )}
              {contact.email && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
                </li>
              )}
              {contact.working_hours && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                  {contact.working_hours}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center">
          <p className="text-sm text-muted-foreground">© 2026 Shri Trimurti Sports Arena. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
