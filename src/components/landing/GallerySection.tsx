import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface GalleryImage {
  id: string;
  cloudinary_url: string;
  alt_text: string;
  span_type: string;
  resource_type?: 'image' | 'video';
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
    setSelectedIndex(prev => (prev !== null ? (prev + 1) % images.length : null));
  }, [images.length]);

  const showPrev = useCallback(() => {
    setSelectedIndex(prev => (prev !== null ? (prev - 1 + images.length) % images.length : null));
  }, [images.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIndex === null) return;
    if (e.key === "ArrowRight") showNext();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "Escape") setSelectedIndex(null);
  }, [selectedIndex, showNext, showPrev]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    api.get("/gallery")
      .then(res => setImages(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="gallery" className="py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Gallery</p>
            <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
              Inside <span className="text-gradient-turf">Shri Trimurti Sports Arena</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (images.length === 0) return null;

  return (
    <section id="gallery" className="py-20 lg:py-32 relative">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-semibold mb-2 uppercase tracking-wider text-sm">Gallery</p>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold mb-4">
            Inside <span className="text-gradient-turf">Shri Trimurti Sports Arena</span>
          </h2>
        </motion.div>

        {/* Mobile: peek scroller with active card pop */}
        <div className="md:hidden">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto pt-6 pb-6 snap-x snap-mandatory scrollbar-hide"
            style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
          >
            {images.map((img, i) => {
              const isActive = i === activeIdx;
              return (
                <motion.div
                  key={img.id}
                  animate={{
                    scale: isActive ? 1 : 0.92,
                    y: isActive ? -6 : 0,
                    opacity: isActive ? 1 : 0.6,
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  onClick={() => setSelectedIndex(i)}
                  className="overflow-hidden rounded-2xl cursor-zoom-in shrink-0 snap-center shadow-turf-lg"
                  style={{ width: "calc(100vw - 6rem)", maxWidth: "320px" }}
                >
                  <div className="relative aspect-[4/3]">
                    {img.resource_type === 'video' ? (
                      <div className="w-full h-full relative">
                        <video src={img.cloudinary_url} className="w-full h-full object-cover pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                            <div className="ml-1 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img src={img.cloudinary_url} alt={img.alt_text} loading="lazy"
                        className="w-full h-full object-cover" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Swipe hint + dots */}
          <div className="flex flex-col items-center gap-3 mt-2">
            {activeIdx === 0 && images.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [0, 6, 0] }}
                transition={{ x: { repeat: Infinity, duration: 1.4, ease: "easeInOut" }, opacity: { duration: 0.4 } }}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                Swipe to explore <ChevronRight className="w-3.5 h-3.5 text-primary" />
              </motion.div>
            )}
            <div className="flex items-center gap-2 flex-wrap justify-center max-w-[240px]">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIdx(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Desktop: grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-3 max-w-5xl mx-auto">
          {images.map((img, i) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "overflow-hidden rounded-2xl cursor-zoom-in",
                img.span_type === 'large' ? 'md:col-span-2 md:row-span-2' : ''
              )}
              onClick={() => setSelectedIndex(i)}
            >
              <div className="relative w-full h-full">
                {img.resource_type === 'video' ? (
                  <div className="w-full h-full relative group">
                    <video src={img.cloudinary_url} className="w-full h-full object-cover min-h-[160px] pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 transform group-hover:scale-110 transition-transform duration-300">
                        <div className="ml-1 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img src={img.cloudinary_url} alt={img.alt_text} loading="lazy"
                    className="w-full h-full object-cover min-h-[160px] hover:scale-105 transition-transform duration-500" />
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {selectedIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-xl p-4 md:p-10"
            >
              <button 
                onClick={() => setSelectedIndex(null)}
                className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[110]"
              >
                <X size={24} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); showPrev(); }}
                className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[110] active:scale-90"
              >
                <ChevronLeft size={32} />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); showNext(); }}
                className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[110] active:scale-90"
              >
                <ChevronRight size={32} />
              </button>

              <motion.div
                key={selectedIndex}
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {images[selectedIndex].resource_type === 'video' ? (
                  <video 
                    src={images[selectedIndex].cloudinary_url} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-full rounded-xl shadow-2xl"
                  />
                ) : (
                  <img 
                    src={images[selectedIndex].cloudinary_url} 
                    alt={images[selectedIndex].alt_text}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                  />
                )}
                
                <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 text-white/50 text-sm font-medium">
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
