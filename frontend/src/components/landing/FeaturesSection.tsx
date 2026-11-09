import { motion } from "framer-motion";
import { Lightbulb, Car, Wind, Shield, Wifi, Shirt, Coffee, Tv } from "lucide-react";

const features = [
  { icon: Lightbulb, title: "LED Lighting", desc: "Professional-grade lighting across all facilities for day and night sessions." },
  { icon: Car, title: "Free Parking", desc: "Spacious parking area for 40+ vehicles right at the arena entrance." },
  { icon: Shield, title: "Safety Nets", desc: "Full perimeter netting on cricket turf for player safety." },
  { icon: Wind, title: "AC Lounge", desc: "Climate-controlled snooker & pool area for maximum comfort." },
  { icon: Coffee, title: "Café & Refreshments", desc: "On-site café with snacks, beverages, and energy drinks." },
  { icon: Shirt, title: "Changing Rooms", desc: "Clean changing rooms with lockers, showers, and fresh towels." },
  { icon: Wifi, title: "Free Wi-Fi", desc: "High-speed connectivity throughout the entire arena." },
  { icon: Tv, title: "Live Screens", desc: "Watch live matches on big screens in the lounge area." },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-32 relative bg-card/50">
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Amenities</p>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
            World-Class <span className="text-gradient-turf">Experience</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need for the perfect game, all under one roof.</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group p-3 lg:p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-turf"
            >
              <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-2 lg:mb-3 group-hover:bg-gradient-turf transition-colors duration-300">
                <feature.icon className="w-4 h-4 lg:w-5 lg:h-5 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
              </div>
              <h3 className="font-heading font-semibold text-foreground text-sm lg:text-base mb-0.5 lg:mb-1">{feature.title}</h3>
              <p className="text-muted-foreground text-xs lg:text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
