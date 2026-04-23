import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { normalizePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Rocket, Phone, Lock } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { syncFromSupabase, reset } = useUserStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) return toast.error("Enter a valid phone number");
    if (password.length < 6) return toast.error("Password too short");
    setLoading(true);
    const email = `${normalized}@techwizard.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Clear any stale local state from previous sessions, then sync from server.
    // Never migrate on login — coins/transactions live on the server only.
    reset();
    await syncFromSupabase();
    toast.success("Welcome back!");
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm border-primary/30 bg-gradient-card p-6 shadow-glow">
        <div className="mb-5 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Rocket className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-2xl font-black">
            <span className="text-gradient-primary">TECHWIZARD</span> Hub
          </h1>
        </div>
        <h2 className="font-display text-xl font-bold">Log in</h2>
        <p className="mb-4 text-sm text-muted-foreground">Phone number and password</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="phone" className="text-xs uppercase tracking-widest text-muted-foreground">
              Phone number
            </Label>
            <div className="relative mt-1">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712345678 or 254712345678"
                className="pl-9"
                maxLength={18}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-widest text-muted-foreground">
              Password
            </Label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary font-display font-bold shadow-glow"
          >
            {loading ? "Signing in..." : "Log in"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-muted-foreground hover:text-foreground">
            Create account →
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
