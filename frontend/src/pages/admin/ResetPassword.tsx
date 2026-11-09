import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, ArrowLeft, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Invalid reset link");
      navigate("/admin/login");
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    if (password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { 
        token, 
        newPassword: password 
      });
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        navigate("/admin/login");
      }, 3000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card border border-border p-8 rounded-2xl shadow-xl text-center space-y-6"
        >
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Password Reset!</h2>
          <p className="text-muted-foreground">
            Your password has been successfully updated. Redirecting you to login...
          </p>
          <div className="pt-4">
            <Link to="/admin/login">
              <Button className="w-full bg-gradient-turf text-primary-foreground">
                Login Now
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Set New Password</h1>
          <p className="text-muted-foreground">Choose a strong password for your admin account.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border p-8 rounded-2xl shadow-xl space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="password" 
                  placeholder="Min 6 characters" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-11 bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="password" 
                  placeholder="Re-type password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 h-11 bg-background border-border"
                />
              </div>
            </div>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <div className="flex items-center gap-2 text-destructive text-[11px] font-semibold bg-destructive/5 p-2 rounded-lg border border-destructive/10">
              <AlertCircle className="w-3 h-3" /> Passwords don't match
            </div>
          )}

          <Button 
            type="submit"
            disabled={loading || !password || password !== confirmPassword} 
            className="w-full h-12 bg-gradient-turf text-primary-foreground font-bold shadow-lg shadow-primary/20"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>

        <div className="text-center">
          <Link to="/admin/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
            <ArrowLeft className="w-3 h-3" /> Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
