import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ArrowLeft, Loader2, Delete, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";

interface Profile {
  id: string;
  name: string;
}

export default function StaffLogin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/staff-profiles')
      .then(res => {
        setProfiles(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load staff profiles");
        setIsLoading(false);
      });
  }, []);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 6 && selectedProfile) {
      submitLogin();
    }
  }, [pin]);

  const submitLogin = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/login-staff-pin', {
        id: selectedProfile?.id,
        pin: pin
      });
      localStorage.setItem("adminToken", res.data.token);
      toast.success(`Welcome, ${res.data.user.name}!`);
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Invalid PIN");
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 overflow-hidden">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {!selectedProfile ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-turf flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-turf">
                  <Shield className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-foreground">Staff Entry</h1>
                <p className="text-sm text-muted-foreground mt-1">Select your profile to continue</p>
              </div>

              <div className="flex flex-wrap justify-center gap-4 pb-8">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile)}
                    className="flex flex-col items-center justify-center p-6 w-[160px] rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group shadow-sm active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      <span className="font-bold text-xl">{profile.name.charAt(0)}</span>
                    </div>
                    <span className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors">{profile.name}</span>
                  </button>
                ))}
                {profiles.length === 0 && (
                  <div className="w-full text-center py-8 text-muted-foreground italic border border-dashed rounded-2xl border-border/50">
                    No staff profiles found.
                  </div>
                )}
              </div>
              <div className="text-center">
                <Button variant="ghost" onClick={() => navigate("/admin/login")} className="text-xs text-muted-foreground hover:text-foreground">
                  Go to Admin Login
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pinpad"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <button 
                  onClick={() => { setSelectedProfile(null); setPin(""); }}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-4 transition-colors p-2 -ml-2"
                >
                  <ArrowLeft size={14} /> Back to profiles
                </button>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 border border-primary/20">
                  <span className="font-heading font-bold text-xl text-primary">{selectedProfile.name.charAt(0)}</span>
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground">{selectedProfile.name}</h2>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-black">Enter 6-Digit PIN</p>
              </div>

              <div className="flex justify-center gap-3 mb-8">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      pin.length > i ? "bg-primary border-primary scale-110 shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "border-border/50 bg-muted/50"
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((nu) => (
                  <button
                    key={nu}
                    onClick={() => handleKeyPress(nu.toString())}
                    className="h-16 w-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-xl font-bold text-foreground hover:bg-secondary hover:border-primary/30 active:scale-95 transition-all shadow-sm"
                  >
                    {nu}
                  </button>
                ))}
                <div className="w-16" />
                <button
                  onClick={() => handleKeyPress("0")}
                  className="h-16 w-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-xl font-bold text-foreground hover:bg-secondary hover:border-primary/30 active:scale-95 transition-all shadow-sm"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
                >
                  <Delete size={24} />
                </button>
              </div>

              {isSubmitting && (
                <div className="flex justify-center pt-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
