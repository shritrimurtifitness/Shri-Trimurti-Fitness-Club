import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface GalleryImage {
  id: string;
  cloudinary_url: string;
  alt_text: string;
  span_type: string;
  resource_type?: "image" | "video";
}

export default function GallerySection() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / Math.max(images.length, 1);
    setActiveIdx(Math.round(el.scrollLeft / cardW));
  };

  const scrollToIdx = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardW = el.scrollWidth / Math.max(images.length, 1);
    el.scrollTo({ left: cardW * i, behavior: "smooth" });
  };

  const showNext = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null ? (prev + 1) % images.length : null));
  }, [images.length]);

  const showPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null ? (prev - 1 + images.length) % images.length : null));
  }, [images.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === "ArrowRight") showNext();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "Escape") setSelectedIndex(null);
    },
    [selectedIndex, showNext, showPrev]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    api.get("/gallery")
      .then((res) => setImages(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="gallery" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
              Arena Gallery
            </span>
            <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
              Inside <span className="text-gradient-turf">SHRI TRIMURTI FITNESS CLUB</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Graceful state if no images in gallery yet
  if (images.length === 0) {
    return (
      <section id="gallery" className="py-16 lg:py-24 relative bg-card/20">
        <div className="container mx-auto px-4 lg:px-8 text-center max-w-2xl">
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Arena Gallery
          </span>
          <h2 className="font-heading text-3xl lg:text-4xl font-extrabold mb-4 text-foreground">
            Inside <span className="text-gradient-turf">The Action</span>
          </h2>
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 mt-6">
            <ImageIcon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-foreground font-semibold">Match action photos & highlights arriving soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Visit our arena in Koparde to experience the floodlit atmosphere in person!
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="gallery" className="py-20 lg:py-28 relative">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-3 py-1 mb-3 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
            Arena Gallery
          </span>
          <h2 className="font-heading text-3xl lg:text-5xl font-extrabold mb-4 text-foreground">
            Inside <span className="text-gradient-turf">SHRI TRIMURTI FITNESS CLUB</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Take a look at the immaculate playing surface, bright floodlights, and player dugouts.
          </p>
        </motion.div>

        {/* Mobile: peek scroller */}
        <div className="md:hidden">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto pt-4 pb-6 snap-x snap-mandatory scrollbar-hide"
            style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
          >
            {images.map((img, i) => {
              const isActive = i === activeIdx;
              return (
                <motion.div
                  key={img.id}
                  animate={{
                    scale: isActive ? 1 : 0.93,
                    y: isActive ? -4 : 0,
                    opacity: isActive ? 1 : 0.65,
                  }}
                  transition={{ type: "spring", stiffness: 220, damping: 20 }}
                  onClick={() => setSelectedIndex(i)}
                  className="overflow-hidden rounded-2xl cursor-zoom-in shrink-0 snap-center shadow-lg border border-border"
                  style={{ width: "calc(100vw - 5rem)", maxWidth: "320px" }}
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    {img.resource_type === "video" ? (
                      <div className="w-full h-full relative">
                        <video src={img.cloudinary_url} className="w-full h-full object-cover pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                            <div className="ml-1 border-t-[7px] border-t-transparent border-l-[12px] border-l-white border-b-[7px] border-b-transparent" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={img.cloudinary_url}
                        alt={img.alt_text || "SHRI TRIMURTI FITNESS CLUB pitch photo"}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Dots */}
          <div className="flex items-center gap-1.5 justify-center mt-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-3.5 max-w-5xl mx-auto">
          {images.map((img, i) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "overflow-hidden rounded-2xl cursor-zoom-in border border-border group bg-muted",
                img.span_type === "large" ? "md:col-span-2 md:row-span-2" : ""
              )}
              onClick={() => setSelectedIndex(i)}
            >
              <div className="relative w-full h-full min-h-[180px]">
                {img.resource_type === "video" ? (
                  <div className="w-full h-full relative">
                    <video src={img.cloudinary_url} className="w-full h-full object-cover min-h-[180px] pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 transform group-hover:scale-110 transition-transform">
                        <div className="ml-1 border-t-[7px] border-t-transparent border-l-[12px] border-l-white border-b-[7px] border-b-transparent" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={img.cloudinary_url}
                    alt={img.alt_text || "SHRI TRIMURTI FITNESS CLUB highlight"}
                    loading="lazy"
                    className="w-full h-full object-cover min-h-[180px] group-hover:scale-105 transition-transform duration-500"
                  />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Fullscreen Lightbox */}
        <AnimatePresence>
          {selectedIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4 md:p-10"
              onClick={() => setSelectedIndex(null)}
            >
              <button
                onClick={() => setSelectedIndex(null)}
                aria-label="Close image lightbox"
                className="absolute top-[max(1.5rem,env(safe-area-inset-top))] right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[110]"
              >
                <X size={24} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label="Previous image"
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-[110] active:scale-90"
              >
                <ChevronLeft size={28} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                aria-label="Next image"
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-[110] active:scale-90"
              >
                <ChevronRight size={28} />
              </button>

              <motion.div
                key={selectedIndex}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative max-w-6xl max-h-full w-full h-full flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                {images[selectedIndex].resource_type === "video" ? (
                  <video
                    src={images[selectedIndex].cloudinary_url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
                  />
                ) : (
                  <img
                    src={images[selectedIndex].cloudinary_url}
                    alt={images[selectedIndex].alt_text || "SHRI TRIMURTI FITNESS CLUB"}
                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                  />
                )}

                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-semibold">
                  {selectedIndex + 1} / {images.length}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
