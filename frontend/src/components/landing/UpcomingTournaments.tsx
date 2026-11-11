import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ArrowRight, Trophy, Calendar, Users, ChevronLeft, ChevronRight, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { format } from "date-fns";

interface FeaturedTournament {
  id: string;
  name: string;
  sport_type: string;
  banner_image: string;
  start_date: string;
  end_date: string;
  entry_fee: number;
  prize: string;
  max_teams: number;
  registered_teams: number;
}

export default function UpcomingTournaments() {
  const [tournaments, setTournaments] = useState<FeaturedTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const containerRef = useRef<HTMLElement>(null);
  const inView = useInView(containerRef, { amount: 0.3 });

  useEffect(() => {
    api.get("/tournaments/featured")
      .then((res) => {
        setTournaments(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-scroll only when visible
  useEffect(() => {
    if (tournaments.length <= 1 || !inView) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tournaments.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [tournaments.length, inView]);

  if (loading) {
    return (
      <section id="tournaments" ref={containerRef} className="py-12 bg-card/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center gap-2 mb-8">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Featured Tournaments</h2>
          </div>
          <div className="relative w-full h-[380px] md:h-[480px] rounded-3xl overflow-hidden bg-muted animate-pulse" />
        </div>
      </section>
    );
  }

  // Graceful banner if no upcoming tournaments currently published
  if (tournaments.length === 0) {
    return (
      <section id="tournaments" ref={containerRef} className="py-12 bg-card/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-2xl font-heading font-bold text-foreground">Arena Tournaments</h2>
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Community Leagues</span>
          </div>

          <div className="relative w-full rounded-2xl md:rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-8 md:p-12 text-center overflow-hidden">
            <div className="max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold text-xl md:text-2xl text-foreground mb-2">
                New Tournaments Coming Soon!
              </h3>
              <p className="text-sm md:text-base text-muted-foreground mb-6">
                We regularly host Cricket and Football tournaments with cash prizes and trophies. Stay tuned or organize your own private tournament with us.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/book">
                  <Button size="sm" className="bg-gradient-turf text-primary-foreground font-bold">
                    Book Arena for Practice
                  </Button>
                </Link>
                <a href="#contact-section">
                  <Button size="sm" variant="outline" className="border-border">
                    Host a Corporate Tournament
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const current = tournaments[currentIndex];
  const isFull = current.registered_teams >= current.max_teams;

  return (
    <section id="tournaments" ref={containerRef} className="py-12 bg-card/30 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center gap-2 mb-8">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="text-2xl font-heading font-bold text-foreground">Featured Tournaments</h2>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 rounded-full border-border"
              onClick={() => setCurrentIndex((p) => (p === 0 ? tournaments.length - 1 : p - 1))}
              aria-label="Previous tournament"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 rounded-full border-border"
              onClick={() => setCurrentIndex((p) => (p + 1) % tournaments.length)}
              aria-label="Next tournament"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="relative w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden group bg-zinc-950">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 w-full h-full"
            >
              <img
                src={current.banner_image || "https://images.unsplash.com/photo-1518605368461-1ee12523f05d?q=80&w=2670&auto=format&fit=crop"}
                className="w-full h-full object-cover"
                alt={current.name}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/75 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-transparent to-transparent hidden md:block" />

              <div className="absolute inset-0 p-6 md:p-12 flex flex-col justify-end md:justify-center md:items-start max-w-3xl">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase tracking-wider">
                      <Trophy className="w-3.5 h-3.5" /> Featured Event
                    </span>

                    {current.entry_fee > 0 && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <IndianRupee className="w-3 h-3" />
                        {current.entry_fee} Entry
                      </span>
                    )}

                    {isFull && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/20 border border-destructive/30 text-destructive text-xs font-bold uppercase tracking-wider">
                        🚨 Sold Out
                      </span>
                    )}
                  </div>

                  <h3 className="text-3xl md:text-5xl font-heading font-black text-white mb-4 leading-tight">
                    {current.name}
                  </h3>

                  <div className="flex flex-wrap gap-4 md:gap-8 mb-8 text-sm md:text-base">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>{format(new Date(current.start_date), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Users className="w-4 h-4 text-primary" />
                      <span>{current.max_teams} Teams Max ({current.registered_teams || 0} Registered)</span>
                    </div>
                    {current.prize && (
                      <div className="flex items-center gap-2 text-zinc-300 font-bold">
                        <span className="text-emerald-400">Prize Pool:</span> {current.prize}
                      </div>
                    )}
                  </div>

                  <Link to={`/tournaments/${current.id}`}>
                    <Button className="h-12 px-8 rounded-full font-bold text-base gap-2 bg-gradient-turf text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5">
                      {isFull ? "View Tournament Details" : "View Details & Register"} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator */}
          {tournaments.length > 1 && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-10">
              {tournaments.map((t, idx) => (
                <button
                  key={t.id}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Go to tournament ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? "w-8 bg-primary" : "w-2 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
