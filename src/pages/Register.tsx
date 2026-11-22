import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { normalizePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Rocket, Phone, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const Register = () => {
  const navigate = useNavigate();
  const { syncFromSupabase, migrateLocalToAccount } = useUserStore();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return toast.error(
        "That phone number isn't valid. Use the full international format, e.g. +254712345678."
      );
    }
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setLoading(true);
    const loginEmail = `${normalized}@techwizard.local`;
    const { data, error } = await supabase.auth.signUp({
      email: loginEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          phone: normalized,
          real_email: email.trim().toLowerCase(),
        },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (data.user) {
      await migrateLocalToAccount(data.user.id);
      await syncFromSupabase();
    }
    toast.success("Account created! Your welcome bonus has been added");
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
        <h2 className="font-display text-xl font-bold">Create account</h2>
        <p className="mb-4 text-sm text-muted-foreground">Get 70 welcome coins 🎉</p>

        <form onSubmit={submit} className="space-y-3">
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
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone number</Label>
            <div className="relative mt-1">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                className="pl-9"
                maxLength={18}
                required
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Use full international format. Local 07/011 Kenyan numbers are auto-detected.
            </p>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
