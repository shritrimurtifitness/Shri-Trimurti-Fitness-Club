import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, KeyRound, ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("shritrimurtifitness@gmail.com");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loginMode, setLoginMode] = useState<"password" | "pin">("password");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (loginMode === "pin" && pin.length !== 4) {
        setIsSubmitting(false);
        return toast.error("Please enter 4-digit PIN");
      }

      const response = loginMode === "password"
        ? await api.post('/auth/login', { email, password })
        : await api.post('/auth/login-pin', { email, pin });

      localStorage.setItem("adminToken", response.data.token);
      const user = response.data.user;
      toast.success(user.role === "admin" ? "Welcome back, Admin!" : `Welcome, ${user.name}!`);
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Invalid credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-turf flex items-center justify-center mx-auto mb-4">
            <span className="font-heading font-bold text-primary-foreground text-2xl">S</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Login</h1>
          <p className="text-sm text-muted-foreground mt-1">SHRI TRIMURTI FITNESS CLUB Management Panel</p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setLoginMode("password")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === "password" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Password
            </button>
            <button
              onClick={() => setLoginMode("pin")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === "pin" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              4-Digit PIN
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="shritrimurtifitness@gmail.com" type="email" className="pl-10 bg-background border-border" />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {loginMode === "password" ? (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                      <button 
                        type="button"
                        onClick={() => navigate("/admin/forgot-password")}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pin"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">4-Digit PIN</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").substring(0, 4))}
                        type="password"
                        placeholder="• • • •"
                        className="pl-10 text-center tracking-[1em] font-bold bg-background border-border"
                        autoFocus
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-gradient-turf text-primary-foreground font-bold shadow-turf hover:opacity-95 h-11 disabled:opacity-70">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                loginMode === "password" ? "Sign In with Password" : "Login with PIN"
              )}
            </Button>

            {/* <p className="text-[10px] text-muted-foreground text-center pt-2">
              Default: {loginMode === "password" ? "admin123" : "PIN 1234"}
            </p> */}
          </form>
 
          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-3 italic">Are you a staff member?</p>
            <Button 
              variant="outline" 
              onClick={() => navigate("/admin/staff-login")}
              className="w-full border-primary/20 hover:bg-primary/5 text-primary text-xs font-bold gap-2"
            >
              <ArrowRightLeft size={14} /> Switch to Staff Entry
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
