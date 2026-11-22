import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AppLayout, formatKsh } from "@/components/AppLayout";
import { GameGrid, ServiceGrid, useServices } from "@/components/CatalogCards";
import { useUserStore } from "@/store/userStore";
import draftHero from "@/assets/draft-promotion.jpg.asset.json";
import chessHero from "@/assets/chess-promotion.jpg.asset.json";
import draftImage from "@/assets/draft-game.jpg.asset.json";

const slides = [draftHero, chessHero, draftImage];
const slideAlt = ["Draft promotion", "Chess promotion", "Draft board"];

const Index = () => {
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
          <img key={asset.asset_id} src={asset.url} alt={slideAlt[i]} className={slide === i ? "promotion-slide is-active" : "promotion-slide"} />
        ))}
        <div className="slide-dots">
          {slides.map((_, i) => (
            <Button key={i} variant="ghost" size="icon" aria-label={`Show promotion ${i + 1}`} aria-pressed={slide === i}
              onClick={() => setSlide(i)} className={slide === i ? "dot active" : "dot"}><span /></Button>
          ))}
        </div>
      </section>
      <section className="stats-band">
        <div><small>Wallet</small><strong>{formatKsh(coins)}</strong><span>Available balance</span></div>
        <div><small>Match modes</small><strong>02</strong><span>Create · Join</span></div>
        <div><small>Games</small><strong>02</strong><span>Draft + Chess</span></div>
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
