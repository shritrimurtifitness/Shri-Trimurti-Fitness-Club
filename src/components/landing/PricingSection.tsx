import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Zap, ChevronRight } from "lucide-react";
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
      .then(res => setPlans(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="pricing" className="py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Pricing</p>
            <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
              Simple, <span className="text-gradient-turf">Transparent</span> Pricing
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[0,1,2].map(i => (
              <div key={i} className="h-[420px] rounded-2xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="pricing" className="py-20 lg:py-32 relative">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Pricing</p>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
            Simple, <span className="text-gradient-turf">Transparent</span> Pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">No hidden fees. Pick your sport, book a slot, and play.</p>
        </motion.div>

        {/* Mobile: horizontal scroll with peek */}
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
                    scale: isActive ? 1 : 0.92,
                    y: isActive ? -6 : 0,
                    opacity: isActive ? 1 : 0.65,
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  className={`relative rounded-2xl p-5 border flex-shrink-0 snap-center ${
                    plan.popular
                      ? "bg-card border-primary/60 shadow-turf-lg"
                      : "bg-card border-border"
                  }`}
                  style={{ width: "calc(100vw - 6rem)", maxWidth: "300px" }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 bg-gradient-turf text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-turf">
                        <Zap className="w-3 h-3" /> Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="font-heading font-semibold text-base text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{plan.subtitle}</p>
                  <div className="mb-4">
                    <span className="font-heading text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground text-xs">{plan.unit}</span>
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
                      <Button className={`w-full font-semibold text-sm ${
                        plan.popular
                          ? "bg-gradient-turf text-primary-foreground shadow-turf hover:opacity-90"
                          : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                      }`}>
                        Book Now
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full font-semibold text-sm bg-secondary text-secondary-foreground">
                      Coming Soon
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Swipe hint + dots */}
          <div className="flex flex-col items-center gap-3 mt-2">
            {activeIdx === 0 && plans.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [0, 6, 0] }}
                transition={{ x: { repeat: Infinity, duration: 1.4, ease: "easeInOut" }, opacity: { duration: 0.4 } }}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                Swipe to see more <ChevronRight className="w-3.5 h-3.5 text-primary" />
              </motion.div>
            )}
            <div className="flex items-center gap-2">
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

        {/* Desktop: grid */}
        <div className={`hidden md:grid gap-6 lg:gap-8 max-w-5xl mx-auto ${
          plans.length === 1 ? "md:grid-cols-1 max-w-md" : plans.length === 2 ? "md:grid-cols-2 max-w-3xl" : "md:grid-cols-3"
        }`}>
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 lg:p-8 border transition-all duration-300 ${
                plan.popular
                  ? "bg-card border-primary/50 shadow-turf-lg scale-[1.02]"
                  : "bg-card border-border hover:border-primary/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-gradient-turf text-primary-foreground text-xs font-bold px-4 py-1 rounded-full">
                    <Zap className="w-3 h-3" /> Most Popular
                  </span>
                </div>
              )}
              <h3 className="font-heading font-semibold text-lg text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{plan.subtitle}</p>
              <div className="mb-6">
                <span className="font-heading text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.unit}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.facility ? (
                <Link to={`/book?facility=${plan.facility}`}>
                  <Button className={`w-full font-semibold ${
                    plan.popular
                      ? "bg-gradient-turf text-primary-foreground shadow-turf hover:opacity-90"
                      : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                  }`}>
                    Book Now
                  </Button>
                </Link>
              ) : (
                <Button disabled className="w-full font-semibold bg-secondary text-secondary-foreground">
                  Coming Soon
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
