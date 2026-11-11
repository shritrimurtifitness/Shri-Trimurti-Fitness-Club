import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Users, Trophy, ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/landing/FooterSection";
import api from "@/lib/api";
import { format, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import TournamentRegistrationDialog from "./TournamentRegistrationDialog";
import { Tournament } from "./admin/AdminTournaments";

interface TournamentDetail extends Tournament {
  registered_teams: number;
}

export default function TournamentDetails() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [regOpen, setRegOpen] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0 });

  useEffect(() => {
    api.get(`/tournaments/${id}`)
      .then(res => setTournament(res.data))
      .catch(() => setTournament(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!tournament) return;
    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(tournament.start_date);
      if (now >= start) {
        setTimeLeft({ d: 0, h: 0, m: 0 });
      } else {
        const d = differenceInDays(start, now);
        const h = differenceInHours(start, now) % 24;
        const m = differenceInMinutes(start, now) % 60;
        setTimeLeft({ d, h, m });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading details...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <Trophy className="w-16 h-16 text-muted-foreground/30" />
          <h2 className="text-2xl font-bold">Tournament Not Found</h2>
          <p className="text-muted-foreground">This event may have ended or was removed.</p>
          <Link to="/"><Button variant="outline">Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  const isFull = tournament.registered_teams >= tournament.max_teams;
  const isStarted = new Date() >= new Date(tournament.start_date);
  const slotsLeft = tournament.max_teams - tournament.registered_teams;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 md:py-12 animate-in fade-in duration-500">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 md:gap-12">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-3xl overflow-hidden border border-border bg-card">
              <div className="aspect-[16/9] w-full bg-muted">
                {tournament.banner_image ? (
                  <img src={tournament.banner_image} className="w-full h-full object-cover" alt="Tournament Banner" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Trophy className="w-12 h-12 mb-2 opacity-50" />
                    <span>No banner available</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                  {tournament.sport_type}
                </span>
                {isFull && <span className="px-3 py-1 rounded-full border border-destructive/30 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider">Sold Out</span>}
              </div>
              <h1 className="text-4xl md:text-5xl font-heading font-black mb-6">{tournament.name}</h1>
              
              <div className="text-muted-foreground text-lg leading-relaxed mb-8 whitespace-pre-wrap">
                {tournament.description}
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
                <h3 className="text-xl font-heading font-bold flex items-center gap-2 border-b border-border pb-4">
                  <ShieldCheck className="w-5 h-5 text-primary" /> Rules & Guidelines
                </h3>
                <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {tournament.rules || "No specific rules detailed for this event."}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Sidebar Registration Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-2xl">
              <div className="space-y-6">
                
                {/* Countdown */}
                {!isStarted && (
                  <div className="text-center bg-background rounded-xl py-4 border border-border">
                    <p className="text-xs uppercase text-muted-foreground font-bold tracking-wider mb-2">Starts In</p>
                    <div className="flex justify-center gap-4 text-xl font-mono font-bold">
                      <div className="flex flex-col"><span className="text-primary">{timeLeft.d}</span><span className="text-[10px] text-muted-foreground font-sans">DAYS</span></div>
                      <span>:</span>
                      <div className="flex flex-col"><span className="text-primary">{timeLeft.h}</span><span className="text-[10px] text-muted-foreground font-sans">HRS</span></div>
                      <span>:</span>
                      <div className="flex flex-col"><span className="text-primary">{timeLeft.m}</span><span className="text-[10px] text-muted-foreground font-sans">MINS</span></div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 py-2 border-b border-border pb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Epic Prize</p>
                      <p className="font-bold text-foreground">{tournament.prize}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Event Schedule</p>
                      <p className="font-bold text-foreground">{format(new Date(tournament.start_date), "MMM d - h:mm a")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Ends: {format(new Date(tournament.end_date), "MMM d")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Team Slots ({tournament.max_teams} Total)</p>
                      <p className="font-bold text-foreground">
                        {isFull ? <span className="text-destructive">Filled completely</span> : <span className="text-emerald-500">{slotsLeft} Slots Remaining</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm text-muted-foreground font-bold uppercase tracking-wider">Entry Fee</span>
                    <div className="text-3xl font-black text-emerald-400">₹{tournament.entry_fee}</div>
                  </div>

                  {isStarted ? (
                    <Button disabled className="w-full py-6 rounded-xl font-bold text-lg bg-muted text-muted-foreground border-none">
                      Event Started
                    </Button>
                  ) : isFull ? (
                    <Button disabled className="w-full py-6 rounded-xl font-bold text-lg bg-destructive/10 text-destructive hover:bg-destructive/10 border-none">
                      Sold Out
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setRegOpen(true)}
                      className="w-full py-6 rounded-xl font-bold text-lg bg-gradient-turf text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 group"
                    >
                      Register Team <ChevronRight className="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1" />
                    </Button>
                  )}
                  {/* <p className="text-center text-xs text-muted-foreground mt-3 flex justify-center items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Direct Arena UPI • 0% Platform Fee
                  </p> */}
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

      <FooterSection />
      
      {/* Registration & Checkout Modal */}
      <TournamentRegistrationDialog
        tournament={tournament}
        isOpen={regOpen}
        onClose={() => setRegOpen(false)}
        onSuccess={() => {
          setRegOpen(false);
          setTournament(prev => prev ? { ...prev, registered_teams: prev.registered_teams + 1 } : null);
        }}
      />
    </div>
  );
}
