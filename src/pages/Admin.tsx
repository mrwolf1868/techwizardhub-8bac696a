import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Search, Coins, Bot as BotIcon, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Profile = {
  user_id: string;
  phone: string;
  email: string | null;
  coins: number;
  games_played: number;
  bots_deployed: number;
  referral_code: string;
  created_at: string;
};

type BotRow = {
  id: string;
  user_id: string;
  phone_number: string;
  code: string;
  deployed_at: string;
};

type Tx = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
};

const Admin = () => {
  const { isAdmin, userId } = useUserStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [q, setQ] = useState("");
  const [mpesa, setMpesa] = useState<Array<{ id: string; phone: string; amount: number; status: string; mpesa_receipt: string | null; created_at: string }>>([]);

  const load = async () => {
    const [{ data: p }, { data: b }, { data: t }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("bots").select("*").order("deployed_at", { ascending: false }).limit(200),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("mpesa_transactions").select("id, phone, amount, status, mpesa_receipt, created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    setProfiles((p || []) as Profile[]);
    setBots((b || []) as BotRow[]);
    setTxs((t || []) as Tx[]);
    setMpesa((m || []) as typeof mpesa);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!userId) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const adjustCoins = async (uid: string, delta: number) => {
    const row = profiles.find((x) => x.user_id === uid);
    if (!row) return;
    const newCoins = Math.max(0, row.coins + delta);
    const { error } = await supabase.from("profiles").update({ coins: newCoins }).eq("user_id", uid);
    if (error) return toast.error(error.message);
    await supabase.from("transactions").insert({
      user_id: uid,
      type: delta > 0 ? "purchase" : "game_loss",
      amount: delta,
      description: `Admin adjustment (${delta > 0 ? "+" : ""}${delta})`,
    });
    toast.success("Updated");
    load();
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      !q ||
      p.phone.includes(q) ||
      (p.email || "").toLowerCase().includes(q.toLowerCase()) ||
      p.referral_code.toLowerCase().includes(q.toLowerCase())
  );

  const totalCoins = profiles.reduce((s, p) => s + p.coins, 0);
  const totalBots = profiles.reduce((s, p) => s + p.bots_deployed, 0);

  return (
    <AppLayout>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <ShieldCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">Full access to users, coins, bots, and payments</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="bg-gradient-card p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> Users
          </div>
          <div className="font-display text-2xl font-black">{profiles.length}</div>
        </Card>
        <Card className="bg-gradient-card p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Coins className="h-3 w-3 text-coin" /> Total coins
          </div>
          <div className="font-display text-2xl font-black text-coin">{totalCoins.toLocaleString()}</div>
        </Card>
        <Card className="bg-gradient-card p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BotIcon className="h-3 w-3" /> Bots
          </div>
          <div className="font-display text-2xl font-black">{totalBots}</div>
        </Card>
      </div>

      <Card className="mt-4 bg-gradient-card p-4">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Users
        </h2>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phone / email / ref" className="pl-9" />
        </div>
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                  <TableCell className="text-xs">{p.email || "—"}</TableCell>
                  <TableCell className="text-right font-bold text-coin">{p.coins}</TableCell>
                  <TableCell className="font-mono text-[10px]">{p.referral_code}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => adjustCoins(p.user_id, 100)}>
                        +100
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => adjustCoins(p.user_id, -100)}>
                        -100
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4 bg-gradient-card p-4">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          M-Pesa payments
        </h2>
        <div className="max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">KES</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mpesa.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.phone}</TableCell>
                  <TableCell className="text-right font-bold">{m.amount}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        m.status === "success"
                          ? "bg-win/20 text-win"
                          : m.status === "pending"
                          ? "bg-muted text-muted-foreground"
                          : "bg-lose/20 text-lose"
                      }`}
                    >
                      {m.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">{m.mpesa_receipt || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4 bg-gradient-card p-4">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Recent bots
        </h2>
        <div className="max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Deployed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bots.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.phone_number}</TableCell>
                  <TableCell className="font-mono text-xs tracking-widest">{b.code}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(b.deployed_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4 bg-gradient-card p-4">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Recent transactions
        </h2>
        <div className="max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{t.type}</TableCell>
                  <TableCell className={`text-right font-bold ${t.amount > 0 ? "text-win" : "text-lose"}`}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </TableCell>
                  <TableCell className="text-xs">{t.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AppLayout>
  );
};

export default Admin;
