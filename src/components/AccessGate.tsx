import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Activation is held until the owner configures VIEW_PASSWORD_HASH. This is not a replacement for RLS. */
export const AccessGate = ({ children }: { children: ReactNode }) => {
  const [granted, setGranted] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [expiresAt, setExpiresAt] = useState(0);
  useEffect(() => {
    let active = true;
    const permit = sessionStorage.getItem("view_access_permit");
    if (!permit) { setBusy(false); return; }
    void supabase.functions.invoke("check-view-password", { body: { permit } }).then(({ data }) => {
      if (!active) return;
      if (data?.granted) { setGranted(true); setExpiresAt(data.expiresAt); }
      else { sessionStorage.removeItem("view_access_permit"); sessionStorage.removeItem("access_granted"); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!granted) return;
    const timer = window.setTimeout(() => { setGranted(false); sessionStorage.removeItem("view_access_permit"); sessionStorage.removeItem("access_granted"); }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [granted, expiresAt]);
  if (granted) return <>{children}</>;
  return <div className="auth-shell"><form className="auth-panel grid gap-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("check-view-password", { body: { password } });
      setPassword("");
      if (error || !data?.granted) { setMessage(data?.error || "Could not verify access"); return; }
      sessionStorage.setItem("access_granted", "true"); sessionStorage.setItem("view_access_permit", data.permit);
      setExpiresAt(data.expiresAt); setGranted(true);
    } finally { setBusy(false); }
  }}>
    <label htmlFor="view-password" className="text-xl font-bold">Enter Access Password</label>
    <Input id="view-password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
    <Button type="submit" aria-label="Submit access password" disabled={busy}>Continue</Button>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
  </form></div>;
};