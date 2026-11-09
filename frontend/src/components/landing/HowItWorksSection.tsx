import { motion } from "framer-motion";
import { Calendar, QrCode, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const steps = [
  {
    step: "01",
    icon: Calendar,
    title: "Pick Your Sport & Slot",
    desc: "Choose between Box Cricket Turf or Football Arena. Select your preferred date, hour, and duration.",
  },
  {
    step: "02",
    icon: QrCode,
    title: "Instant UPI Payment",
    desc: "Pay directly via GPay, PhonePe, Paytm or UPI QR. Fast automated verification with zero gateway surcharges.",
  },
  {
    step: "03",
    icon: Play,
    title: "Show Up & Play!",
    desc: "Arrive at the arena in Koparde, flash your booking confirmation ID, pick your gear, and start competing.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-16 lg:py-24 relative overflow-hidden bg-background">
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Simple 3-Step Process
          </span>
          <h2 className="font-heading text-3xl lg:text-4xl font-extrabold text-foreground mb-3">
            How It <span className="text-gradient-turf">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            No endless phone calls or uncertainty. Book a slot whenever the mood strikes in under 60 seconds.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto mb-10">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.12 }}
                className="relative rounded-2xl bg-card border border-border p-6 sm:p-7 hover:border-primary/40 transition-all hover:shadow-turf group"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-gradient-turf group-hover:text-primary-foreground transition-colors duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-heading font-black text-2xl text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                    {item.step}
                  </span>
                </div>

                <h3 className="font-heading font-bold text-lg text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          <Link to="/book">
            <Button size="lg" className="bg-gradient-turf text-primary-foreground font-bold shadow-turf px-8">
              Book a Session Now
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
