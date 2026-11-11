import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Zap, ChevronRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  unit: string;
  features: string[];
  popular: boolean;
  facility: string;
}

export default function PricingSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / Math.max(plans.length, 1);
    const idx = Math.round(el.scrollLeft / cardW);
    setActiveIdx(idx);
  };

  const scrollToIdx = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / Math.max(plans.length, 1);
    el.scrollTo({ left: cardW * i, behavior: "smooth" });
  };

  useEffect(() => {
    api.get("/pricing")
      .then((res) => setPlans(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="pricing" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
              Pricing Plans
            </span>
            <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
              Simple, <span className="text-gradient-turf">Transparent</span> Pricing
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[0, 1].map((i) => (
              <div key={i} className="h-[420px] rounded-2xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="py-20 lg:py-28 relative">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Pricing Plans
          </span>
          <h2 className="font-heading text-3xl lg:text-5xl font-extrabold mb-4 text-foreground">
            Simple, <span className="text-gradient-turf">Transparent</span> Rates
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            No hidden surge fees. Book hourly slots online with instant confirmation.
          </p>
        </motion.div>

        {/* Mobile: horizontal scroll with snap peek */}
        <div className="md:hidden">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto pt-8 pb-6 snap-x snap-mandatory scroll-pl-6"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
          >
            {plans.map((plan, i) => {
              const isActive = i === activeIdx;
              return (
                <motion.div
                  key={plan.id}
                  animate={{
                    scale: isActive ? 1 : 0.94,
                    y: isActive ? -4 : 0,
                    opacity: isActive ? 1 : 0.7,
                  }}
                  transition={{ type: "spring", stiffness: 220, damping: 20 }}
                  className={`relative rounded-2xl p-5 border flex-shrink-0 snap-center ${
                    plan.popular
                      ? "bg-card border-primary/60 shadow-turf-lg ring-1 ring-primary/40"
                      : "bg-card border-border"
                  }`}
                  style={{ width: "calc(100vw - 5rem)", maxWidth: "320px" }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 bg-gradient-turf text-primary-foreground text-xs font-extrabold px-3 py-1 rounded-full shadow-turf">
                        <Zap className="w-3 h-3" /> Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="font-heading font-bold text-lg text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{plan.subtitle}</p>
                  <div className="mb-4">
                    <span className="font-heading text-3xl font-extrabold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground text-xs ml-1">{plan.unit}</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.facility ? (
                    <Link to={`/book?facility=${plan.facility}`}>
                      <Button
                        className={`w-full font-bold text-sm ${
                          plan.popular
                            ? "bg-gradient-turf text-primary-foreground shadow-turf"
                            : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                        }`}
                      >
                        Book Now
                      </Button>
                    </Link>
                  ) : (
                    <a href="https://wa.me/919595153006?text=Hi,%20I%20want%20to%20inquire%20about%20custom%20slot%20pricing.">
                      <Button className="w-full font-bold text-sm bg-secondary text-secondary-foreground">
                        Inquire on WhatsApp
                      </Button>
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Swipe indicator */}
          <div className="flex flex-col items-center gap-2.5 mt-1">
            {activeIdx === 0 && plans.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [0, 5, 0] }}
                transition={{ x: { repeat: Infinity, duration: 1.4, ease: "easeInOut" } }}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                Swipe for more plans <ChevronRight className="w-3.5 h-3.5 text-primary" />
              </motion.div>
            )}
            <div className="flex items-center gap-1.5">
              {plans.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIdx(i)}
                  aria-label={`Go to plan ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Desktop: Grid */}
        <div
          className={`hidden md:grid gap-6 lg:gap-8 max-w-5xl mx-auto items-stretch ${
            plans.length === 1
              ? "md:grid-cols-1 max-w-md"
              : plans.length === 2
              ? "md:grid-cols-2 max-w-3xl"
              : "md:grid-cols-3"
          }`}
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 lg:p-8 border transition-all duration-300 flex flex-col justify-between ${
                plan.popular
                  ? "bg-card border-primary/60 shadow-turf-lg scale-[1.02] ring-1 ring-primary/40"
                  : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <div>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-gradient-turf text-primary-foreground text-xs font-bold px-4 py-1 rounded-full shadow-turf">
                      <Zap className="w-3.5 h-3.5" /> Most Popular
                    </span>
                  </div>
                )}
                <h3 className="font-heading font-bold text-xl text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-5">{plan.subtitle}</p>
                <div className="mb-6">
                  <span className="font-heading text-4xl lg:text-5xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-1.5">{plan.unit}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {plan.facility ? (
                <Link to={`/book?facility=${plan.facility}`} className="w-full">
                  <Button
                    className={`w-full font-bold h-11 ${
                      plan.popular
                        ? "bg-gradient-turf text-primary-foreground shadow-turf hover:opacity-90"
                        : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                    }`}
                  >
                    Book Slot
                  </Button>
                </Link>
              ) : (
                <a href="https://wa.me/919595153006?text=Hi,%20I%20want%20to%20inquire%20about%20turf%20pricing." className="w-full">
                  <Button className="w-full font-bold h-11 bg-secondary text-secondary-foreground">
                    Inquire on WhatsApp
                  </Button>
                </a>
              )}
            </motion.div>
          ))}
        </div>

        {/* Corporate / Bulk Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Looking for monthly memberships, coaching batches, or full-day corporate tournament bookings?{" "}
            <a
              href="https://wa.me/919595153006?text=Hi,%20I%20would%20like%20to%20inquire%20about%20corporate/bulk%20turf%20booking."
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
            >
              Contact Arena Management <Phone className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
