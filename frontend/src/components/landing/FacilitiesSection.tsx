import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import cricketImg from "@/assets/cricket-turf.jpg";
import snookerImg from "@/assets/snooker-room.jpg";
import poolImg from "@/assets/pool-room.jpg";

import { useSocket } from "@/hooks/useSocket";

/** Fallback images for known sport types */
const knownImages: Record<string, string> = {
  cricket: cricketImg,
  snooker: snookerImg,
  pool: poolImg,
};

/** Generic placeholder for unknown sports */
const defaultImage = "https://images.unsplash.com/photo-1461896836934-bd45ba8bf8bd?q=80&w=2000&auto=format&fit=crop";

export default function FacilitiesSection() {
  const [facilities, setFacilities] = useState<any[]>([]);

  const loadFacilities = () => {
    api.get('/facilities').then(res => setFacilities(res.data.filter((f: any) => f.is_active !== false))).catch(() => { });
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  useSocket('facility_updated', loadFacilities);

  const count = facilities.length;
  const countWord = count === 1 ? "One Sport" : count === 2 ? "Two Sports" : count === 3 ? "Three Sports" : count === 4 ? "Four Sports" : `${count} Sports`;

  return (
    <section id="facilities" className="py-20 lg:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Our Sports Events</p>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
            {countWord}, <span className="text-gradient-turf">One Arena</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need for the perfect sports experience - all under one roof.
          </p>
        </motion.div>

        <div className="space-y-16">
          {facilities.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 items-center`}
            >
              <div className="flex-1 w-full">
                <div className="overflow-hidden rounded-2xl border border-border">
                  <img
                    src={f.image_url || knownImages[f.facility_type] || defaultImage}
                    alt={f.name}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="w-full h-[280px] lg:h-[360px] object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>
              <div className="flex-1 w-full">
                <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-1">{f.facility_type}</p>
                <h3 className="font-heading text-2xl lg:text-3xl font-bold text-foreground mb-3">{f.name}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5">{f.description || "Experience premium sports facilities with professional equipment and a great atmosphere."}</p>
                <Link to={`/book?facility=${f.facility_type}`}>
                  <Button className="bg-gradient-turf text-primary-foreground font-semibold shadow-turf hover:opacity-90 group">
                    Book {f.name}
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
