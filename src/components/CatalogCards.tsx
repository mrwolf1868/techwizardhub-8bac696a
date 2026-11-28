import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Calculator, CandlestickChart, CircleDot, Columns3, Crown, Hash, Lock, type LucideIcon } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { DraughtPiece } from "@/components/GamePieces";
import type { GameId } from "@/lib/games";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import draftImage from "@/assets/draft-game.jpg.asset.json";
import chessImage from "@/assets/chess-game.png.asset.json";
import virtualNumbers from "@/assets/virtual-numbers.png.asset.json";
import numbersPromo from "@/assets/numbers-promotion.jpg.asset.json";
import smsPromo from "@/assets/sms-promotion.png.asset.json";
import { AssetImage } from "@/components/AssetImage";

export type { GameId } from "@/lib/games";

export type GameInfo = { id: GameId | "cointrade"; href?: string; title: string; tag: string; image?: string; icon: LucideIcon; text: string };

export const GAMES: GameInfo[] = [
  { id: "draughts", title: "Draft", tag: "2 PLAYERS", image: draftImage.url, icon: CircleDot, text: "Challenge another player and compete head-to-head in a fast match." },
  { id: "chess", title: "Chess", tag: "ONLINE CHESS", image: chessImage.url, icon: Crown, text: "Enter the board, find an opponent and play a competitive game." },
  { id: "tictactoe", title: "Tic-Tac-Toe", tag: "QUICK MATCH", icon: Hash, text: "Line up three in a row before your opponent. Matches take about a minute." },
  { id: "connect4", title: "Connect Four", tag: "STRATEGY", icon: Columns3, text: "Drop discs into the grid and connect four in a line to win the pot." },
  { id: "quiz", title: "Math Quiz", tag: "BRAIN DUEL", icon: Calculator, text: "Both players get the same 10 sums. Most correct answers wins; the faster player wins a tie." },
  { id: "cointrade", href: "/trade", title: "Coin Trade", tag: "TWC / KSH MARKET", icon: CandlestickChart, text: "Trade the TECHWOLF coin against the shilling with live charts, stop loss and take profit." },
];

const C4_ART = "......." + "...b..." + "..wbw.." + ".bwwbw.";

/** Board illustration for games without a photo. */
export const GameArt = ({ game, className = "" }: { game: GameInfo; className?: string }) => {
  const Icon = game.icon;
  return (
    <div className={`game-art game-art-${game.id} ${className}`} aria-hidden="true">
      {game.id === "tictactoe" ? (
        <div className="art-ttt">{"wb.bw..bw".split("").map((c, i) => <span key={i}>{c !== "." && <DraughtPiece color={c as "w" | "b"} king={false} />}</span>)}</div>
      ) : game.id === "connect4" ? (
        <div className="art-c4">{C4_ART.split("").map((c, i) => <span key={i}>{c !== "." && <DraughtPiece color={c as "w" | "b"} king={false} />}</span>)}</div>
      ) : <Icon />}
    </div>
  );
};

const SERVICE_IMAGES = [virtualNumbers.url, numbersPromo.url, smsPromo.url];

export type ServiceItem = { id: string; slug: string; name: string; description: string | null };

export const useServices = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["service-catalog", "enabled"],
    queryFn: async () => {
      const { data, error } = await supabase.from("child_projects")
        .select("id, slug, name, description, sort_order, created_at")
        .eq("enabled", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ServiceItem[];
    },
    staleTime: 60_000,
  });
  return { items: data ?? [], loading: isLoading };
};

export const GameGrid = () => {
  const navigate = useNavigate();
  const { lockedGames } = useAppSettings();
  return (
    <div className="game-grid">
      {GAMES.map((game) => {
        const locked = lockedGames.includes(game.id);
        const Icon = game.icon;
        return (
          <article className={`game-tile${locked ? " is-locked" : ""}`} key={game.id}>
            {game.image ? <AssetImage src={game.image} alt={`${game.title} board`} fallback={<GameArt game={game} className="tile-art" />} /> : <GameArt game={game} className="tile-art" />}
            <div className="game-copy">
              <span className="eyebrow game-tag"><Icon className="h-3.5 w-3.5" />{game.tag}</span>
              <h3>{game.title}</h3>
              <p>{game.text}</p>
              {locked
                ? <Button variant="secondary" disabled><Lock />Temporarily locked</Button>
                : <Button onClick={() => navigate(game.href ?? `/games/${game.id}`)}>{game.href ? "Open market" : "Enter Match"}<ArrowRight /></Button>}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export const ServiceGrid = ({ items, loading }: { items: ServiceItem[]; loading: boolean }) => {
  const navigate = useNavigate();
  if (loading) return <div className="service-grid" aria-busy="true" aria-label="Services loading">{[0, 1, 2].map((item) => <div key={item} className="service-skeleton" />)}</div>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No services available yet.</p>;
  return (
    <div className="service-grid">
      {items.map((service, i) => (
        <article className="service-tile" key={service.id} onClick={() => navigate(`/s/${service.slug}`)}>
          <AssetImage src={SERVICE_IMAGES[i % SERVICE_IMAGES.length]} alt={service.name} loading="lazy" fallback={<div className="service-art" aria-hidden="true"><ArrowRight /></div>} />
          <div>
            <h3>{service.name}</h3>
            <p>{service.description || "Open this service inside TECHWOLFpro."}</p>
            <Button variant="ghost" className="service-open" aria-label={`Open ${service.name}`}
              onClick={(e) => { e.stopPropagation(); navigate(`/s/${service.slug}`); }}>
              <ArrowRight />
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
};
