import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, MessageCircle, Heart } from "lucide-react";
import logoImage from "@/assets/logo.png";
import api from "@/lib/api";

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-3h2.4V9.4c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 3h-2.2v7A10 10 0 0 0 22 12Z" />
  </svg>
);
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2H21l-6.52 7.45L22 22h-6.79l-4.78-6.17L4.8 22H2l7.05-8.05L2 2h6.91l4.32 5.71L18.244 2Zm-2.38 18h1.83L8.27 4H6.32l9.544 16Z" />
  </svg>
);

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
    address: "Kudire Factory , Sangrul Fata , Koparde",
    phone: "+91 9595153006",
    email: "shritrimurtifitness@gmail.com",
    working_hours: "Mon–Sun: 10:00 AM – 12:00 AM",
    facebook_url: "",
    instagram_url: "",
    twitter_url: "",
  });

  useEffect(() => {
    api.get("/settings/contact")
      .then((res) => {
        if (res.data) setContact((prev) => ({ ...prev, ...res.data }));
      })
      .catch(() => {});
  }, []);

  const cleanPhone = contact.phone.replace(/[^0-9]/g, "") || "919595153006";

  const socials = [
    { icon: FacebookIcon, url: contact.facebook_url, label: "Facebook" },
    { icon: InstagramIcon, url: contact.instagram_url, label: "Instagram" },
    { icon: TwitterIcon, url: contact.twitter_url, label: "Twitter" },
  ].filter((s) => s.url);

  return (
    <footer id="footer" className="py-16 bg-card border-t border-border">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-12">
          {/* Brand Info */}
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <img
                src={logoImage}
                alt="SHRI TRIMURTI FITNESS CLUB logo"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#39FF14]/40"
              />
              <span className="font-heading font-extrabold text-lg text-foreground">
                Shri Trimurti <span className="text-gradient-turf">Fitness Club</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Koparde’s premier sports destination featuring high-grade Cricket Turf and Championship Football Turf with floodlights.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${cleanPhone}?text=Hi%20Shri%20Trimurti%20Fitness%20Club`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </a>

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
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h4 className="font-heading font-bold text-foreground mb-4 text-sm uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-2.5">
              {[
                { name: "Home", path: "/" },
                { name: "Book Slot", path: "/book" },
                { name: "Tournaments", path: "/#tournaments" },
                { name: "Facilities", path: "/#facilities" },
                { name: "Amenities", path: "/#features" },
                { name: "Pricing", path: "/#pricing" },
                { name: "FAQs", path: "/#faq" },
                { name: "Contact", path: "/#contact-section" },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Our Sports */}
          <div className="col-span-1">
            <h4 className="font-heading font-bold text-foreground mb-4 text-sm uppercase tracking-wider">
              Our Sports
            </h4>
            <ul className="space-y-2.5">
              {[
                { name: "Cricket Turf", path: "/book?facility=cricket" },
                { name: "Football Turf", path: "/book?facility=football" },
                { name: "Night Floodlit Matches", path: "/book" },
                { name: "Tournaments & Leagues", path: "/#tournaments" },
                { name: "Corporate Bookings", path: "/#contact-section" },
              ].map((s) => (
                <li key={s.name}>
                  <Link
                    to={s.path}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Details */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="font-heading font-bold text-foreground mb-4 text-sm uppercase tracking-wider">
              Arena Contact
            </h4>
            <ul className="space-y-3">
              {contact.address && (
                <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>{contact.address}</span>
                </li>
              )}
              {contact.phone && (
                <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                  <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact.email && (
                <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors break-all">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.working_hours && (
                <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{contact.working_hours}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <p>© {new Date().getFullYear()} SHRI TRIMURTI FITNESS CLUB. All rights reserved.</p>
            <span>•</span>
            <Link to="/privacy" className="hover:text-primary transition-colors underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-primary transition-colors underline-offset-4 hover:underline">
              Terms of Service
            </Link>
          </div>
          <p className="flex items-center gap-1">
            Crafted for sports lovers in Kolhapur & Koparde <Heart className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
          </p>
        </div>
      </div>
    </footer>
  );
}
