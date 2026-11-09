import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Star, MessageSquare, CheckCircle2, Globe, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  source?: 'internal' | 'google';
}

export default function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const directionRef = useRef<number>(1);
  const [settings, setSettings] = useState<any>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);

  const loadData = () => {
    Promise.all([
      api.get("/testimonials"),
      api.get("/settings/contact")
    ]).then(([testRes, setRes]) => {
      setTestimonials(testRes.data);
      setSettings(setRes.data);
    })
    .catch(() => { })
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocket('settings_updated', () => {
    api.get("/settings/contact")
      .then(res => setSettings(res.data))
      .catch(() => {});
  });

  // Triple items for seamless loop
  const displayItems = [...testimonials, ...testimonials, ...testimonials, ...testimonials];

  const controls = useAnimation();

  useEffect(() => {
    if (!loading && testimonials.length > 0 && !isPaused) {
      controls.start({
        x: ["0%", "-50%"],
        transition: {
          duration: testimonials.length * 10, // speed based on count
          ease: "linear",
          repeat: Infinity
        }
      });
    } else {
      controls.stop();
    }
  }, [loading, testimonials, isPaused, controls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !text) return toast.error("Please fill in your name and review");

    setIsSubmitting(true);
    try {
      await api.post("/testimonials", { name, role, text, rating });
      setIsSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setIsSuccess(false);
        setName(""); setRole(""); setText(""); setRating(5);
      }, 3000);
    } catch {
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render ONLY when explicitly enabled by the admin from the dashboard
  if (loading || !settings || settings.show_testimonials !== true) {
    return null;
  }

  return (
    <section className="py-20 lg:py-32 relative bg-card/50 overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Testimonials</p>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
            What Players <span className="text-gradient-turf">Say</span>
          </h2>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            className="mt-4 border-primary/20 hover:bg-primary/5 text-primary"
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Write a Review
          </Button>
        </motion.div>
      </div>

      {/* Infinite Scrolling Marquee with Drag Support */}
      <div className="relative w-full overflow-hidden">
        <motion.div
          animate={controls}
          drag="x"
          dragConstraints={{ left: -2000, right: 0 }}
          onDragStart={() => setIsPaused(true)}
          onHoverStart={() => setIsPaused(true)}
          onHoverEnd={() => setIsPaused(false)}
          className="flex gap-6 px-4 py-8 cursor-grab active:cursor-grabbing w-max"
        >
          {displayItems.map((t, i) => (
            <div key={`${t.id}-${i}`}
              className={`flex-shrink-0 w-[320px] p-6 rounded-2xl bg-card border transition-all ${t.source === 'google' ? 'border-blue-500/20 hover:border-blue-500/40' : 'border-border hover:border-primary/20'
                }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`w-4 h-4 ${j < t.rating ? "text-accent fill-accent" : "text-muted-foreground"}`} />
                  ))}
                </div>
                {t.source === 'google' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                    <Globe className="w-3 h-3" /> Google
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-4">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm ${t.source === 'google' ? 'bg-blue-600' : 'bg-gradient-turf'
                  }`}>
                  {t.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    {t.source === 'google' && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.role || "Player"}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Submission Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="py-12 flex flex-col items-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Review Submitted!</h3>
                  <p className="text-muted-foreground mt-2">Thank you! Your feedback will be visible once approved.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DialogHeader>
                  <DialogTitle>Share Your Experience</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                  <div className="flex justify-center mb-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} type="button" onClick={() => setRating(s)} className="p-1">
                          <Star className={`w-6 h-6 transition-colors ${s <= rating ? "text-accent fill-accent" : "text-muted-foreground/30"}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Your Name *</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Rahul" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sport / Role</Label>
                      <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Cricket" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Your Review *</Label>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="Tell us about the turf quality, lighting, or staff..."
                      className="w-full min-h-[100px] bg-background border border-input rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-gradient-turf text-primary-foreground shadow-turf">
                      {isSubmitting ? "Submitting..." : "Submit Review"}
                    </Button>
                  </DialogFooter>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
      {/* Google Trust Banner */}
      <div className="container mx-auto px-4 mt-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-7 h-7">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">
                  {settings?.google_rating || "4.6"} / 5
                </span>
                <div className="flex text-accent">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className={`w-3.5 h-3.5 ${s < Math.round(Number(settings?.google_rating || 4.6)) ? "fill-accent" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground italic">Based on {settings?.google_reviews_count || "150"}+ Google Reviews</p>
            </div>
          </div>
          <a
            href={settings?.google_maps_url || "https://www.google.com/search?q=Shri+Trimurti+Sports+Arena+reviews"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="border-blue-500/20 text-blue-600 hover:bg-blue-500/5">
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> View All Reviews
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
