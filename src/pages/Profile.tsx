import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, AtSign, History, LogOut, UserRound } from "lucide-react";
import { AppLayout, PageSection, formatKsh } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

const Profile = () => {
  const navigate = useNavigate();
  const { phoneNumber, email, username, transactions, coins, gamesPlayed, signOutLocal, syncFromSupabase } = useUserStore();
  const [name, setName] = useState(username ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(username ?? ""); }, [username]);

  const saveUsername = async () => {
    const value = name.trim();
    if (!USERNAME_RE.test(value)) return toast.error("Use 3 to 20 letters, numbers or underscores");
    setSaving(true);
    const { error } = await supabase.rpc("set_username", { _username: value });
    setSaving(false);
    if (error) return toast.error(error.message.includes("taken") ? "That username is taken" : error.message);
    await syncFromSupabase();
    toast.success("Username saved");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    signOutLocal();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <AppLayout>
      <PageSection title="Profile">
        <div className="wallet-layout">
          <div>
            <div className="wallet-total">
              <UserRound />
              <span>Signed in as</span>
              <strong className="!text-2xl">{username || phoneNumber || "—"}</strong>
              <small>{username ? `+${phoneNumber}` : email || "No email on file"}</small>
            </div>
            <div className="mt-3">
              <Label htmlFor="profile-username" className="text-xs uppercase tracking-widest text-muted-foreground">Username</Label>
              <div className="username-form">
                <div className="relative flex-1">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-username" value={name} maxLength={20} placeholder="Choose a username" className="pl-9"
                    onChange={(e) => setName(e.target.value)} disabled={saving} />
                </div>
                <Button onClick={saveUsername} disabled={saving || name.trim() === (username ?? "")}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
            <div className="stats-band !mx-0 !grid-cols-2">
              <div><small>Balance</small><strong>{formatKsh(coins)}</strong><span>Available</span></div>
              <div><small>Games played</small><strong>{gamesPlayed}</strong><span>All games</span></div>
            </div>
            <div className="profile-wallet-actions">
              <Button onClick={() => navigate("/buy")}><ArrowDownToLine />Deposit</Button>
              <Button variant="outline" onClick={() => navigate("/buy?tab=withdraw")}><ArrowUpFromLine />Withdraw</Button>
            </div>
            <Button variant="outline" onClick={signOut}><LogOut />Sign out</Button>
          </div>
          <div className="transaction-history">
            <h2>Recent activity</h2>
            {transactions.length === 0 && (
              <div className="empty-history"><History /><p>No activity yet</p></div>
            )}
            {transactions.slice(0, 15).map((t) => (
              <div key={t.id} className="transaction-row">
                <div className="transaction-icon"><History /></div>
                <div className="flex-1">
                  <strong>{t.description}</strong>
                  <small>{new Date(t.timestamp).toLocaleString()}</small>
                </div>
                <strong className={t.amount > 0 ? "text-win" : "text-lose"}>{t.amount > 0 ? "+" : ""}{t.amount}</strong>
              </div>
            ))}
          </div>
        </div>
      </PageSection>
    </AppLayout>
  );
};

export default Profile;
