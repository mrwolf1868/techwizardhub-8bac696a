import { useNavigate } from "react-router-dom";
import { History, LogOut, UserRound } from "lucide-react";
import { AppLayout, PageSection, formatKsh } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const { phoneNumber, email, transactions, coins, gamesPlayed, signOutLocal } = useUserStore();

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
              <strong className="!text-2xl">{phoneNumber || "—"}</strong>
              <small>{email || "No email on file"}</small>
            </div>
            <div className="stats-band !mx-0 !grid-cols-2">
              <div><small>Balance</small><strong>{formatKsh(coins)}</strong><span>Available</span></div>
              <div><small>Games played</small><strong>{gamesPlayed}</strong><span>Chess + Draft</span></div>
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
