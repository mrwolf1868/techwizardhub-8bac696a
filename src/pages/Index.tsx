import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppLayout, formatKsh } from "@/components/AppLayout";
import { GAMES, GameArt, GameGrid, ServiceGrid, useServices } from "@/components/CatalogCards";
import { AssetImage } from "@/components/AssetImage";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import draftHero from "@/assets/draughts-table.jpg.asset.json";
import chessHero from "@/assets/chess-table.jpg.asset.json";

const slides = [draftHero, chessHero];
const slideAlt = ["Black and cream draughts board", "Black and cream chessboard"];

const Index = () => {
  const navigate = useNavigate();
  const coins = useUserStore((s) => s.coins);
  const { items, loading } = useServices();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((i) => (i + 1) % slides.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <AppLayout>
      <section className="promotion" aria-label="TECHWOLFpro promotions">
        {slides.map((asset, i) => (
          <div key={asset.asset_id} className={slide === i ? "promotion-slide is-active" : "promotion-slide"}>
            <AssetImage src={asset.url} alt={slideAlt[i]} className="h-full w-full object-cover" fallback={<div className="promotion-fallback"><GameArt game={GAMES[i % 2]} /></div>} />
          </div>
        ))}
        <div className="promotion-copy"><span className="eyebrow">THE PLAYERS' CLUB</span><h1>TECHWOLFpro</h1><p>{slide === 0 ? "Draft" : "Chess"} · Head-to-head</p><Button onClick={() => navigate(slide === 0 ? "/games/draughts" : "/games/chess")}>Enter match</Button></div>
        <div className="slide-dots">
          {slides.map((_, i) => (
            <Button key={i} variant="ghost" size="icon" aria-label={`Show promotion ${i + 1}`} aria-pressed={slide === i}
              onClick={() => setSlide(i)} className={slide === i ? "dot active" : "dot"}><span /></Button>
          ))}
        </div>
      </section>
      <section className="stats-band">
        <div><small>Wallet</small><strong>{formatKsh(coins)}</strong><span>Available balance</span></div>
        <div><small>Match modes</small><strong>03</strong><span>Open · Friend · Challenge</span></div>
        <div><small>Games</small><strong>{String(GAMES.length).padStart(2, "0")}</strong><span>Chess · Draft · more</span></div>
        <div><small>Services</small><strong>{loading ? "--" : String(items.length).padStart(2, "0")}</strong><span>Explore services</span></div>
      </section>
      <section className="content-section">
        <div className="section-heading"><div><span className="eyebrow">GAME ZONE</span><h2>Choose your game</h2></div><small>Skill • Competition • Rewards</small></div>
        <GameGrid />
      </section>
      <section className="content-section">
        <div className="section-heading"><div><h2>Services</h2></div><small>Simple • Fast • Secure</small></div>
        <ServiceGrid items={items} loading={loading} />
      </section>
    </AppLayout>
  );
};

export default Index;
