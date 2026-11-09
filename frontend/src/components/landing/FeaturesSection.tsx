import { motion } from "framer-motion";
import { Lightbulb, Car, Shield, Wind, Sparkles, Shirt, Droplets, Wifi } from "lucide-react";

const features = [
  {
    icon: Lightbulb,
    title: "Pro LED Floodlights",
    desc: "Even, glare-free illumination engineered for evening & late-night matches.",
  },
  {
    icon: Shield,
    title: "Full Perimeter Netting",
    desc: "Heavy-duty tensioned netting keeps every ball safe inside the play zone.",
  },
  {
    icon: Car,
    title: "Spacious Free Parking",
    desc: "Dedicated hassle-free parking for bikes and cars right at the arena entrance.",
  },
  {
    icon: Wind,
    title: "Covered Dugout & Lounge",
    desc: "Shaded team benches and spectator seating to relax between overs and halves.",
  },
  {
    icon: Sparkles,
    title: "Gear & Equipment",
    desc: "Quality cricket bats, stumps, balls, and footballs available for your session.",
  },
  {
    icon: Shirt,
    title: "Changing & Rest Area",
    desc: "Clean, hygienic changing rooms and washroom facilities for players.",
  },
  {
    icon: Droplets,
    title: "Chilled Refreshments",
    desc: "Purified drinking water, energy drinks, and quick snacks readily available.",
  },
  {
    icon: Wifi,
    title: "Free High-Speed Wi-Fi",
    desc: "Fast internet connectivity to update live scorecards and stream moments.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 relative bg-card/40 border-y border-border/50">
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Arena Amenities
          </span>
          <h2 className="font-heading text-3xl lg:text-5xl font-extrabold mb-4 text-foreground">
            World-Class <span className="text-gradient-turf">Experience</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Everything you need for an unforgettable match — from kickoff to the final boundary.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300 hover:shadow-turf flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-gradient-turf transition-colors duration-300">
                  <feature.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors duration-300" />
                </div>
                <h3 className="font-heading font-bold text-foreground text-sm sm:text-base mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
