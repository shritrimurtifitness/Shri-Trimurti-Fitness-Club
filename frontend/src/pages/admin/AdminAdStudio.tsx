import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
import * as htmlToImage from "html-to-image";
import { Download, Loader2, Megaphone } from "lucide-react";
import { formatTime12Hour } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import logoImage from "@/assets/logo.png";

export default function AdminAdStudio() {
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1)); // Default to tomorrow
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const res = await api.get(`/slots?date=${formattedDate}&facility_type=cricket`);

      const available = res.data.filter((s: any) => s.is_available);

      // Group by start time to handle multiple lanes seamlessly
      const grouped: Record<string, number> = {};
      available.forEach((s: any) => {
        const time = `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`;
        grouped[time] = (grouped[time] || 0) + 1;
      });

      // Convert to array of unique time ranges
      setSlots(Object.keys(grouped).sort());
    } catch {
      toast.error("Failed to load slots");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setIsGenerating(true);
    try {
      // Temporarily ensure high quality capture params
      const dataUrl = await htmlToImage.toPng(captureRef.current, {
        quality: 1,
        pixelRatio: 1, // keeping ratio accurate to 1080x1920 standard
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `available-slots-${format(selectedDate, "yyyy-MM-dd")}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Ad downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatToAMPM = (timeStr: string) => {
    const [start, end] = timeStr.split(" - ");
    const startStr = formatTime12Hour(start).replace(":00", "");
    const endStr = formatTime12Hour(end).replace(":00", "");
    return `${startStr} - ${endStr}`;
  };

  // Support up to 18 slots (6 rows of 3)
  const displaySlots = slots.slice(0, 18);

  const getGridConfig = (count: number) => {
    if (count <= 6) return { cols: "grid-cols-2", gap: "gap-10", py: "py-10", text: "text-[50px]" };
    if (count <= 10) return { cols: "grid-cols-2", gap: "gap-8", py: "py-6", text: "text-[45px]" };
    return { cols: "grid-cols-3 max-w-[1000px]", gap: "gap-6", py: "py-6 px-3", text: "text-[32px]" };
  };

  const gridStyles = getGridConfig(displaySlots.length);
  const [adTheme, setAdTheme] = useState<"dark" | "light">("dark");

  const isLight = adTheme === "light";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" /> Ad Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">Automatically generate Instagram Story ad graphics for available Cricket Turf slots.</p>
        </div>
        <Button onClick={handleDownload} disabled={isGenerating || slots.length === 0} className="bg-gradient-turf text-primary-foreground font-bold h-12 px-6 shadow-turf hover:opacity-90 transition-all rounded-full w-full sm:w-auto">
          {isGenerating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
          Download Story (PNG)
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center bg-card p-2 rounded-2xl border border-border w-fit">
          <Button variant={selectedDate.getDate() === new Date().getDate() ? "default" : "ghost"} onClick={() => setSelectedDate(new Date())} className="rounded-xl">Today</Button>
          <Button variant={selectedDate.getDate() === addDays(new Date(), 1).getDate() ? "default" : "ghost"} onClick={() => setSelectedDate(addDays(new Date(), 1))} className="rounded-xl">Tomorrow</Button>
          <Button variant={selectedDate.getDate() === addDays(new Date(), 2).getDate() ? "default" : "ghost"} onClick={() => setSelectedDate(addDays(new Date(), 2))} className="rounded-xl">Day After</Button>
        </div>

        <div className="flex gap-2 items-center bg-card p-2 rounded-2xl border border-border w-fit">
          <Button variant={!isLight ? "default" : "ghost"} onClick={() => setAdTheme("dark")} className="rounded-xl">Dark Theme</Button>
          <Button variant={isLight ? "default" : "ghost"} onClick={() => setAdTheme("light")} className="rounded-xl bg-white text-black hover:bg-neutral-200">Light Theme</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,500px] gap-8">
        <div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border border-border"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />Loading availability...</div>
          ) : slots.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border rounded-2xl">
              <p className="text-2xl font-bold text-foreground mb-2">Turf is Fully Booked! 🏏</p>
              <p className="text-muted-foreground">No available slots to advertise for {format(selectedDate, "MMM do")}.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-bold text-xl mb-4 text-foreground">{slots.length} available slots for {format(selectedDate, "EEEE")}</h3>
              {slots.length > 18 && (
                <p className="text-xs text-amber-500 mb-4 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  Note: Found {slots.length} slots, but only the first 18 will visibly fit into the Instagram story template.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {displaySlots.map(s => (
                  <div key={s} className="bg-muted p-3 border border-border rounded-xl text-center text-sm font-semibold">{formatToAMPM(s)}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 1080x1920 Preview Canvas - Scaled down for UI */}
        <div className="bg-neutral-900 border border-border rounded-2xl p-4 overflow-hidden flex justify-center items-center h-[700px] relative mt-4">
          <p className="absolute top-4 left-4 text-xs font-bold text-muted-foreground z-20 uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Scale Preview</p>

          {/* Transforming the 1080x1920 canvas to fit inside the preview container */}
          <div className="w-[1080px] h-[1920px] shrink-0 origin-center" style={{ transform: 'scale(0.32)' }}>

            {/* THIS IS THE ACTUAL ELEMENT CAPTURED BY htmlToImage */}
            <div ref={captureRef} className={`w-[1080px] h-[1920px] flex flex-col relative ${isLight ? "bg-stone-100" : "bg-[#040d07]"}`}>
              {/* Background Design */}
              <div className={`absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=3532&auto=format&fit=crop')] bg-cover bg-center ${isLight ? "opacity-30" : "opacity-40"}`} />

              {isLight ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-100 via-stone-100/90 to-stone-100/40" />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#10b981]/10 via-transparent to-transparent" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#040d07] via-[#081f13]/90 to-[#041109]/40 mix-blend-multiply opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#10b981]/20 via-transparent to-transparent" />
                </>
              )}

              {/* Content Layer */}
              <div className="relative z-10 w-full h-full">

                {/* 1) Top Header Section */}
                <div className="pt-20 px-12 flex flex-col items-center">
                  <div className={`w-40 h-40 rounded-full overflow-hidden mb-6 shadow-2xl flex items-center justify-center
                      ${isLight ? "bg-white border-[4px] border-[#059669]" : "bg-white/5 border-[4px] border-[#10b981]/50"}
                    `}>
                    <img src={logoImage} alt="Logo" className="w-[110%] h-[110%] object-cover object-center" />
                  </div>
                  <p className={`font-bold text-4xl uppercase tracking-widest mb-4 ${isLight ? "text-[#059669]" : "text-[#10b981]"}`}>
                    SHRI TRIMURTI FITNESS CLUB
                  </p>
                  <h1 className={`text-[120px] font-black leading-none uppercase font-heading italic tracking-tighter ${isLight ? "text-neutral-900" : "text-white"}`}>
                    Game<br />On.
                  </h1>
                  <div className={`w-28 h-2 mx-auto mt-8 mb-8 rounded-full ${isLight ? "bg-[#059669]" : "bg-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.8)]"}`} />

                  <p className={`text-4xl font-bold mb-5 tracking-wide ${isLight ? "text-neutral-800" : "text-white"}`}>
                    CRICKET TURF
                  </p>
                  <div className={`text-black inline-block px-10 py-5 rounded-[2rem] text-4xl font-black uppercase tracking-wider 
                    ${isLight ? "bg-[#10b981] shadow-[0_10px_30px_rgba(16,185,129,0.3)]" : "bg-[#10b981] shadow-[0_0_40px_rgba(16,185,129,0.5)]"}`}>
                    {selectedDate.getDate() === new Date().getDate() ? "Open Today" : format(selectedDate, "EEEE, MMM do")}
                  </div>
                </div>

                {/* 2) Middle Slots Section (Takes natural height but constrained) */}
                <div className="w-full flex-1 flex flex-col items-center justify-start mt-12 px-12 pb-[350px]">
                  {displaySlots.length > 0 ? (
                    <div className="w-full">
                      <h2 className={`text-[45px] font-black text-center mb-8 uppercase tracking-widest text-shadow-sm ${isLight ? "text-[#059669]" : "text-[#10b981]"}`}>
                        Available Slots
                      </h2>
                      <div className={`grid ${gridStyles.cols} ${gridStyles.gap} w-full max-w-4xl mx-auto`}>
                        {displaySlots.map(s => (
                          <div key={s} className={`backdrop-blur-md rounded-[1.5rem] ${gridStyles.py} text-center font-bold flex items-center justify-center ${gridStyles.text}
                            ${isLight
                              ? "bg-white border-[3px] border-neutral-200 text-neutral-800 shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
                              : "bg-white/5 border-[3px] border-[#10b981]/50 text-white shadow-[0_0_30px_rgba(16,185,129,0.1)]"}
                          `}>
                            {formatToAMPM(s)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={`mt-10 text-6xl font-black text-center uppercase border-[6px] p-24 rounded-[4rem] rotate-[-5deg] backdrop-blur-md
                      ${isLight ? "text-neutral-800 border-neutral-300 bg-white/80" : "text-white border-[#10b981] bg-black/50"}`}>
                      Fully<br />Booked!
                    </div>
                  )}
                </div>

                {/* 3) Bottom Footer Section (Absolutely positioned so it never disappears) */}
                <div className={`absolute bottom-16 left-12 right-12 text-center backdrop-blur-md rounded-[3rem] py-10 px-8
                  ${isLight ? "bg-white/90 border border-neutral-200 shadow-xl" : "bg-black/60 border border-white/10 shadow-2xl"}
                `}>
                  <p className={`text-4xl font-medium mb-4 ${isLight ? "text-neutral-600" : "text-white/80"}`}>
                    Book instantly via Website
                  </p>
                  <p className={`text-[46px] font-black tracking-widest flex justify-center items-center gap-4 ${isLight ? "text-[#059669]" : "text-[#10b981]"}`}>
                    ⚽ www.shritrimurtifitness.com
                  </p>
                </div>

              </div>
            </div>
            {/* END CAPTURE */}

          </div>
        </div>
      </div>
    </div>
  );
}
