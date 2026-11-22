import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import draftImage from "@/assets/draft-game.jpg.asset.json";
import chessImage from "@/assets/chess-game.png.asset.json";
import virtualNumbers from "@/assets/virtual-numbers.png.asset.json";
import numbersPromo from "@/assets/numbers-promotion.jpg.asset.json";
import smsPromo from "@/assets/sms-promotion.png.asset.json";

export type GameId = "draughts" | "chess";

export const GAMES: { id: GameId; title: string; tag: string; image: string; text: string }[] = [
  { id: "draughts", title: "Draft", tag: "2 PLAYERS", image: draftImage.url, text: "Challenge another player and compete head-to-head in a fast match." },
  { id: "chess", title: "Chess", tag: "ONLINE CHESS", image: chessImage.url, text: "Enter the board, find an opponent and play a competitive game." },
];

const SERVICE_IMAGES = [virtualNumbers.url, numbersPromo.url, smsPromo.url];

export type ServiceItem = { id: string; slug: string; name: string; description: string | null };

export const useServices = () => {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.from("child_projects").select("id, slug, name, description, sort_order, created_at")
      .eq("enabled", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setItems((data || []) as ServiceItem[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);
  return { items, loading };
};

export const GameGrid = () => {
  const navigate = useNavigate();
  return (
    <div className="game-grid">
      {GAMES.map((game) => (
        <article className="game-tile" key={game.id}>
          <img src={game.image} alt={`${game.title} board`} />
          <div className="game-copy">
            <span className="eyebrow">{game.tag}</span>
            <h3>{game.title}</h3>
            <p>{game.text}</p>
            <Button onClick={() => navigate(`/games/${game.id}`)}>Enter Match<ArrowRight /></Button>
          </div>
        </article>
      ))}
    </div>
  );
};

export const ServiceGrid = ({ items, loading }: { items: ServiceItem[]; loading: boolean }) => {
  const navigate = useNavigate();
  if (loading) return <p className="text-sm text-muted-foreground">Loading services…</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No services available yet.</p>;
  return (
    <div className="service-grid">
      {items.map((service, i) => (
        <article className="service-tile" key={service.id} onClick={() => navigate(`/s/${service.slug}`)}>
          <img src={SERVICE_IMAGES[i % SERVICE_IMAGES.length]} alt={service.name} />
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
