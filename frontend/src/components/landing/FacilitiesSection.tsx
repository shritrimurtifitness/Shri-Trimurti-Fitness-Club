import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import cricketImg from "@/assets/cricket-turf.jpg";
import footballImg from "@/assets/football-turf.jpg";
import { useSocket } from "@/hooks/useSocket";

/** Fallback images for known sport types */
const knownImages: Record<string, string> = {
  cricket: cricketImg,
  football: footballImg,
};

const defaultImage = "https://images.unsplash.com/photo-1461896836934-bd45ba8bf8bd?q=80&w=2000&auto=format&fit=crop";

export default function FacilitiesSection() {
  const [facilities, setFacilities] = useState<any[]>([]);

  const loadFacilities = () => {
    api.get("/facilities")
      .then((res) => setFacilities(res.data.filter((f: any) => f.is_active !== false)))
      .catch(() => {});
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  useSocket("facility_updated", loadFacilities);

  const count = facilities.length;
  const countWord =
    count === 1
      ? "One Sport"
      : count === 2
      ? "Two Sports"
      : count === 3
      ? "Three Sports"
      : `${count} Sports`;

  return (
    <section id="facilities" className="py-20 lg:py-28 relative overflow-hidden bg-card/20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/5 rounded-full blur-[130px] pointer-events-none" />
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Our Facilities
          </span>
          <h2 className="font-heading text-3xl lg:text-5xl font-extrabold mb-4 text-foreground">
            {countWord}, <span className="text-gradient-turf">One Arena</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Engineered for high-intensity games, friendly weekend battles, and competitive corporate leagues.
          </p>
        </motion.div>

        <div className="space-y-16 lg:space-y-24 max-w-6xl mx-auto">
          {facilities.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 lg:gap-12 items-center`}
            >
              {/* Image */}
              <div className="flex-1 w-full">
                <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-border shadow-lg relative group">
                  <img
                    src={f.image_url || knownImages[f.facility_type] || defaultImage}
                    alt={f.name || "Sports facility turf"}
                    loading="lazy"
                    width={800}
                    height={500}
                    className="w-full h-[280px] sm:h-[340px] lg:h-[380px] xl:h-[420px] object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs font-bold uppercase tracking-wider">
                    {f.facility_type === "cricket" ? "Box Cricket Turf" : f.facility_type === "football" ? "Championship Turf" : f.facility_type}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 w-full">
                <div className="inline-flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-widest mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Premium Synthetic Grass
                </div>
                <h3 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground mb-4">
                  {f.name}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6 text-sm sm:text-base">
                  {f.description ||
                    (f.facility_type === "cricket"
                      ? "High-density synthetic grass turf equipped with perimeter safety netting, pro batting and bowling crease markings, and powerful LED floodlights."
                      : "Shock-absorbing championship turf designed for smooth traction, quick passes, and high-energy 5v5 or 6v6 football showdowns.")}
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <Link to={`/book?facility=${f.facility_type}`}>
                    <Button className="bg-gradient-turf text-primary-foreground font-bold shadow-turf hover:opacity-95 group px-6 h-11">
                      Book {f.name}
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>

                  <a
                    href={`https://wa.me/917083738373?text=Hi,%20I%20want%20to%20inquire%20about%20${encodeURIComponent(f.name)}%20slots.`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="border-border font-semibold h-11">
                      WhatsApp Inquiry
                    </Button>
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
