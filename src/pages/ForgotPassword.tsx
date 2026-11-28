import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!mail) return toast.error("Enter your email");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("password-reset-request", {
      body: { email: mail },
    });
    setLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message);
    toast.success("📧 Code sent — check your email");
    setStep("code");
  };

  const verifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code");
    if (newPassword.length < 6) return toast.error("Password too short");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("password-reset-confirm", {
      body: { email: email.trim().toLowerCase(), code, newPassword },
    });
    setLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message);
    toast.success("✅ Password updated — log in with your new password");
    navigate("/login");
  };

  return (
    <div className="auth-shell">
      <Card className="auth-panel">
        <div className="auth-wordmark">
          <h1 className="font-display text-2xl font-black">
            <span className="text-primary">TECHWOLF</span>pro
          </h1>
        </div>
        <h2 className="font-display text-xl font-bold">Reset password</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {step === "email"
            ? "We'll send a 6-digit code to the email you registered with."
            : "Enter the code from your email and choose a new password."}
        </p>

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary font-display font-bold">
              {loading ? "Sending..." : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyAndReset} className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">6-digit code</Label>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="pl-9 text-center font-mono text-xl tracking-[0.4em]"
                  maxLength={6}
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">New password</Label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary font-display font-bold">
              {loading ? "Updating..." : "Reset password"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Use a different email
            </button>
          </form>
        )}

        <div className="mt-4 text-center text-xs">
          <Link to="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
