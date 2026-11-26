import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaSeries, BarSeries, BaselineSeries, CandlestickSeries, ColorType, CrosshairMode, LineSeries, LineStyle, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp,
} from "lightweight-charts";
import {
  BarChart3, CandlestickChart, Crosshair, Eraser, LineChart, Lock, Minus, MoveDiagonal, Pencil, Spline, TrendingUp, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  aggregate, bidAsk, bollinger, ema, FIB_LEVELS, marginFor, rsi, sma, tradePnl, type Candle,
} from "@/lib/chartMath";

type ChartType = "candles" | "hollow" | "bars" | "line" | "area" | "baseline";
type Tool = "cursor" | "hline" | "trend" | "fib";
type Anchor = { time: number; price: number };
type Drawing = { kind: "hline"; price: number } | { kind: "trend" | "fib"; a: Anchor; b: Anchor };
type Position = { id: string; side: "buy" | "sell"; lots: number; entry: number; margin: number; sl: number | null; tp: number | null; status: string; exit_price: number | null; pnl: number | null; close_reason: string | null; opened_at: string; closed_at: string | null };

const TIMEFRAMES = [["1m", 60], ["5m", 300], ["15m", 900], ["30m", 1800], ["1H", 3600], ["4H", 14400]] as const;
const TYPES: { id: ChartType; label: string; icon: typeof LineChart }[] = [
  { id: "candles", label: "Candles", icon: CandlestickChart }, { id: "hollow", label: "Hollow candles", icon: CandlestickChart },
  { id: "bars", label: "Bars", icon: BarChart3 }, { id: "line", label: "Line", icon: LineChart },
  { id: "area", label: "Area", icon: TrendingUp }, { id: "baseline", label: "Baseline", icon: Spline },
];
const fx = (n: number | null | undefined, d = 3) => (n == null ? "—" : n.toFixed(d));

/** Turn an HSL design token ("211 92% 58%") into a colour the chart canvas understands. */
const token = (name: string, alpha = 1) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/);
  const [h, s, l] = [parseFloat(raw[0]), parseFloat(raw[1]) / 100, parseFloat(raw[2]) / 100];
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `rgba(${f(0)}, ${f(8)}, ${f(4)}, ${alpha})`;
};

const CoinTrade = () => {
  const { userId, coins, isAdmin, syncFromSupabase } = useUserStore();
  const { lockedGames } = useAppSettings();
  const locked = lockedGames.includes("cointrade");
  const [raw, setRaw] = useState<Candle[]>([]);
  const [tf, setTf] = useState(60);
  const [type, setType] = useState<ChartType>("candles");
  const [ind, setInd] = useState({ ma: true, ema: false, bb: false, rsi: false });
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const pending = useRef<Anchor | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const [lots, setLots] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tab, setTab] = useState<"open" | "history">("open");
  const [edit, setEdit] = useState<{ id: string; sl: string; tp: string } | null>(null);

  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const main = useRef<ISeriesApi<SeriesType> | null>(null);
  const extras = useRef<ISeriesApi<SeriesType>[]>([]);
  const lastT = useRef<string | null>(null);
  const fitted = useRef(false);

  /* ---------- market feed: fills any missed time on the server, then returns new candles ---------- */
  const pull = useCallback(async () => {
    const since = lastT.current ?? new Date(Date.now() - 2 * 86400_000).toISOString();
    const { data, error } = await supabase.rpc("coin_feed", { _since: since });
    if (error || !data?.length) return;
    lastT.current = data[data.length - 1].t;
    setRaw((prev) => {
      const map = new Map(prev.map((c) => [c.time, c]));
      data.forEach((r) => { const time = Math.floor(new Date(r.t).getTime() / 1000); map.set(time, { time, open: +r.o, high: +r.h, low: +r.l, close: +r.c }); });
      return [...map.values()].sort((a, b) => a.time - b.time);
    });
  }, []);

  const loadPositions = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("coin_positions").select("*").eq("user_id", userId).order("opened_at", { ascending: false }).limit(100);
    if (!data) return;
    setPositions((prev) => {
      const next = data.map((p) => ({ ...p, lots: +p.lots, entry: +p.entry, sl: p.sl == null ? null : +p.sl, tp: p.tp == null ? null : +p.tp, exit_price: p.exit_price == null ? null : +p.exit_price })) as Position[];
      const closedNow = next.filter((p) => p.status === "closed" && prev.some((o) => o.id === p.id && o.status === "open"));
      closedNow.forEach((p) => toast(`${p.side.toUpperCase()} ${p.lots} closed by ${p.close_reason}: ${p.pnl! >= 0 ? "+" : ""}KSh ${p.pnl}`));
      if (closedNow.length) void syncFromSupabase();
      return next;
    });
  }, [userId, syncFromSupabase]);

  useEffect(() => {
    if (!userId) return;
    void pull().then(loadPositions);
    const t = window.setInterval(() => { void pull().then(loadPositions); }, 3000);
    return () => window.clearInterval(t);
  }, [userId, pull, loadPositions]);

  const candles = useMemo(() => aggregate(raw.map((c) => ({ ...c })), tf), [raw, tf]);
  const mid = raw.length ? raw[raw.length - 1].close : 0;
  const { bid, ask } = bidAsk(mid);
  const prevClose = candles.length > 1 ? candles[candles.length - 2].close : mid;
  const change = mid && prevClose ? ((mid - prevClose) / prevClose) * 100 : 0;

  /* ---------- chart setup ---------- */
  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: token("--chart-bg") }, textColor: token("--chart-text"), fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: token("--chart-grid") }, horzLines: { color: token("--chart-grid") } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: token("--border") },
      timeScale: { borderColor: token("--border"), timeVisible: true, secondsVisible: false, rightOffset: 6 },
      localization: { priceFormatter: (p: number) => p.toFixed(3) },
    });
    chart.current = c;
    return () => { c.remove(); chart.current = null; main.current = null; extras.current = []; };
  }, []);

  /* ---------- series, indicators, drawings and trade lines ---------- */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    if (main.current) c.removeSeries(main.current);
    extras.current.forEach((s) => c.removeSeries(s));
    extras.current = [];
    const bull = token("--bull"), bear = token("--bear");
    const fmt = { type: "price" as const, precision: 3, minMove: 0.001 };
    let s: ISeriesApi<SeriesType>;
    if (type === "candles" || type === "hollow") {
      s = c.addSeries(CandlestickSeries, { priceFormat: fmt, upColor: type === "hollow" ? "rgba(0,0,0,0)" : bull, downColor: bear, borderUpColor: bull, borderDownColor: bear, wickUpColor: bull, wickDownColor: bear });
    } else if (type === "bars") s = c.addSeries(BarSeries, { priceFormat: fmt, upColor: bull, downColor: bear });
    else if (type === "line") s = c.addSeries(LineSeries, { priceFormat: fmt, color: bull, lineWidth: 2 });
    else if (type === "area") s = c.addSeries(AreaSeries, { priceFormat: fmt, lineColor: bull, topColor: token("--bull", 0.35), bottomColor: token("--bull", 0.02), lineWidth: 2 });
    else s = c.addSeries(BaselineSeries, { priceFormat: fmt, baseValue: { type: "price", price: candles[0]?.close ?? 100 }, topLineColor: bull, topFillColor1: token("--bull", 0.3), topFillColor2: token("--bull", 0.02), bottomLineColor: bear, bottomFillColor1: token("--bear", 0.02), bottomFillColor2: token("--bear", 0.3) });
    main.current = s;
    const ohlc = type === "candles" || type === "hollow" || type === "bars";
    s.setData(candles.map((k) => (ohlc ? { ...k, time: k.time as UTCTimestamp } : { time: k.time as UTCTimestamp, value: k.close })));

    const line = (data: { time: number; value: number }[], color: string, pane = 0, width: 1 | 2 = 1) => {
      const l = c.addSeries(LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: fmt }, pane);
      l.setData(data.map((d) => ({ time: d.time as UTCTimestamp, value: d.value })));
      extras.current.push(l);
      return l;
    };
    if (ind.ma) line(sma(candles, 20), token("--warning"));
    if (ind.ema) line(ema(candles, 50), token("--primary-glow"));
    if (ind.bb) { const b = bollinger(candles); line(b.upper, token("--accent-foreground", 0.6)); line(b.lower, token("--accent-foreground", 0.6)); }
    if (ind.rsi) {
      const r = line(rsi(candles), token("--brand-pink"), 1);
      r.createPriceLine({ price: 70, color: token("--chart-text", 0.5), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      r.createPriceLine({ price: 30, color: token("--chart-text", 0.5), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" });
      c.panes()[1]?.setHeight(110);
    }

    const snap = (t: number) => Math.floor(t / tf) * tf;
    drawings.forEach((d) => {
      if (d.kind === "hline") { s.createPriceLine({ price: d.price, color: token("--warning"), lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }); return; }
      const [a, b] = [d.a, d.b].sort((x, y) => x.time - y.time);
      if (d.kind === "trend" && snap(a.time) !== snap(b.time)) line([{ time: snap(a.time), value: a.price }, { time: snap(b.time), value: b.price }], token("--warning"), 0, 2);
      if (d.kind === "fib") FIB_LEVELS.forEach((lv) => s.createPriceLine({ price: d.b.price + (d.a.price - d.b.price) * lv, color: token("--accent-foreground", 0.7), lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: `${(lv * 100).toFixed(1)}%` }));
    });

    positions.filter((p) => p.status === "open").forEach((p) => {
      s.createPriceLine({ price: p.entry, color: p.side === "buy" ? token("--bull") : token("--bear"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${p.side.toUpperCase()} ${p.lots}` });
      if (p.sl != null) s.createPriceLine({ price: p.sl, color: token("--bear", 0.8), lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: "SL" });
      if (p.tp != null) s.createPriceLine({ price: p.tp, color: token("--bull", 0.8), lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: "TP" });
    });
    if (!fitted.current && candles.length) { c.timeScale().setVisibleLogicalRange({ from: candles.length - 120, to: candles.length + 6 }); fitted.current = true; }
  }, [candles, type, ind, drawings, positions, tf]);

  useEffect(() => { fitted.current = false; }, [tf]);

  /* ---------- legend + drawing clicks ---------- */
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const move = (p: { time?: Time }) => setHover(p.time ? candles.find((k) => k.time === p.time) ?? null : null);
    const click = (p: { time?: Time; point?: { x: number; y: number } }) => {
      if (tool === "cursor" || !p.point || !main.current) return;
      const price = main.current.coordinateToPrice(p.point.y);
      const time = (p.time as number | undefined) ?? (c.timeScale().coordinateToTime(p.point.x) as number | null);
      if (price == null || time == null) return;
      if (tool === "hline") { setDrawings((d) => [...d, { kind: "hline", price }]); setTool("cursor"); return; }
      if (!pending.current) { pending.current = { time, price }; toast.message("Now click the second point"); return; }
      const a = pending.current; pending.current = null;
      setDrawings((d) => [...d, { kind: tool, a, b: { time, price } }]);
      setTool("cursor");
    };
    c.subscribeCrosshairMove(move); c.subscribeClick(click);
    return () => { c.unsubscribeCrosshairMove(move); c.unsubscribeClick(click); };
  }, [candles, tool]);

  /* ---------- orders ---------- */
  const lotNum = Number.parseFloat(lots);
  const lotsOk = Number.isFinite(lotNum) && lotNum >= 0.01 && lotNum <= 5 && Math.round(lotNum * 100) === lotNum * 100;
  const slNum = sl.trim() ? Number.parseFloat(sl) : null;
  const tpNum = tp.trim() ? Number.parseFloat(tp) : null;
  const needMargin = lotsOk && mid ? marginFor(lotNum, ask) : 0;
  const openTrades = positions.filter((p) => p.status === "open");
  const floating = openTrades.reduce((t, p) => t + tradePnl(p.side, p.lots, p.entry, p.side === "buy" ? bid : ask), 0);
  const used = openTrades.reduce((t, p) => t + p.margin, 0);
  const blocked = !userId || isAdmin || locked;

  const place = async (side: "buy" | "sell") => {
    if (blocked || busy) return;
    if (!lotsOk) return toast.error("Lot size must be from 0.01 to 5.00");
    if ((slNum != null && !Number.isFinite(slNum)) || (tpNum != null && !Number.isFinite(tpNum))) return toast.error("Enter a valid stop loss and take profit");
    setBusy(true);
    const { error } = await supabase.rpc("coin_open", { _side: side, _lots: lotNum, _sl: slNum as number, _tp: tpNum as number });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${side === "buy" ? "Bought" : "Sold"} ${lotNum.toFixed(2)} lot TWC/KSh`);
    void syncFromSupabase(); void loadPositions();
  };
  const close = async (id: string) => {
    const { error } = await supabase.rpc("coin_close", { _id: id });
    if (error) return toast.error(error.message);
    void syncFromSupabase(); void loadPositions();
  };
  const saveLevels = async () => {
    if (!edit) return;
    const s = edit.sl.trim() ? Number.parseFloat(edit.sl) : null, t = edit.tp.trim() ? Number.parseFloat(edit.tp) : null;
    const { error } = await supabase.rpc("coin_set_levels", { _id: edit.id, _sl: s as number, _tp: t as number });
    if (error) return toast.error(error.message);
    toast.success("Stop loss and take profit updated"); setEdit(null); void loadPositions();
  };

  const legend = hover ?? candles[candles.length - 1];

  if (!userId) {
    return <AppLayout><section className="page-section"><h1 className="text-2xl font-bold">Coin Trade</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to view the TWC/KSh market and trade.</p><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></section></AppLayout>;
  }

  return (
    <AppLayout>
      <section className="page-section">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="eyebrow">TWC / KSH · TECHWOLF coin vs Kenyan shilling</span>
            <h1 className="text-2xl font-bold tabular-nums">{fx(mid)} <span className={`text-base ${change >= 0 ? "up" : "down"}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span></h1>
          </div>
          <div className="text-right text-xs text-muted-foreground">Market runs 24/7 · prices are the same for every player</div>
        </div>

        <div className="trade-shell">
          <div className="trade-panel overflow-hidden">
            <div className="trade-toolbar" role="toolbar" aria-label="Chart tools">
              {TIMEFRAMES.map(([label, sec]) => <button key={label} type="button" className={`tb-btn ${tf === sec ? "is-on" : ""}`} onClick={() => setTf(sec)}>{label}</button>)}
              <span className="sep" />
              {TYPES.map(({ id, label, icon: Icon }) => <button key={id} type="button" title={label} aria-label={label} className={`tb-btn ${type === id ? "is-on" : ""}`} onClick={() => setType(id)}><Icon />{id === "hollow" && <span className="text-[10px]">H</span>}</button>)}
              <span className="sep" />
              {([["ma", "MA 20"], ["ema", "EMA 50"], ["bb", "BB"], ["rsi", "RSI"]] as const).map(([k, label]) => (
                <button key={k} type="button" className={`tb-btn ${ind[k] ? "is-on" : ""}`} onClick={() => setInd((v) => ({ ...v, [k]: !v[k] }))}>{label}</button>
              ))}
              <span className="sep" />
              {([["cursor", "Cursor", Crosshair], ["hline", "Horizontal line", Minus], ["trend", "Trend line", MoveDiagonal], ["fib", "Fibonacci retracement", Pencil]] as const).map(([k, label, Icon]) => (
                <button key={k} type="button" title={label} aria-label={label} className={`tb-btn ${tool === k ? "is-on" : ""}`} onClick={() => { pending.current = null; setTool(k); }}><Icon /></button>
              ))}
              <button type="button" title="Clear drawings" aria-label="Clear drawings" className="tb-btn" onClick={() => setDrawings([])}><Eraser /></button>
            </div>
            {legend && (
              <div className="trade-legend">
                <span>O <strong>{fx(legend.open)}</strong></span><span>H <strong>{fx(legend.high)}</strong></span>
                <span>L <strong>{fx(legend.low)}</strong></span><span>C <strong className={legend.close >= legend.open ? "up" : "down"}>{fx(legend.close)}</strong></span>
                {ind.ma && <span className="text-warning">MA 20</span>}{ind.ema && <span>EMA 50</span>}{ind.bb && <span>BB 20, 2</span>}
                {tool !== "cursor" && <span className="text-warning">{tool === "hline" ? "Click the chart to place a line" : "Click two points on the chart"}</span>}
              </div>
            )}
            <div ref={box} className={`trade-chart ${tool !== "cursor" ? "is-drawing" : ""}`} aria-label="TWC/KSh price chart" />
          </div>

          <aside className="trade-panel space-y-3 p-3">
            <div className="quote-row">
              <button type="button" className="quote-btn sell" disabled={blocked || busy || !mid} onClick={() => void place("sell")}><small>Sell</small><span>{fx(bid)}</span></button>
              <button type="button" className="quote-btn buy" disabled={blocked || busy || !mid} onClick={() => void place("buy")}><small>Buy</small><span>{fx(ask)}</span></button>
            </div>
            <div className="trade-field">
              <label htmlFor="lots">Volume (lots)</label>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Decrease lots" onClick={() => setLots((v) => Math.max(0.01, (+v || 0) - 0.01).toFixed(2))}>−</Button>
                <Input id="lots" inputMode="decimal" value={lots} onChange={(e) => setLots(e.target.value)} className="text-center tabular-nums" />
                <Button variant="outline" size="icon" aria-label="Increase lots" onClick={() => setLots((v) => Math.min(5, (+v || 0) + 0.01).toFixed(2))}>+</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="trade-field"><label htmlFor="sl">Stop loss</label><Input id="sl" inputMode="decimal" placeholder="Optional" value={sl} onChange={(e) => setSl(e.target.value)} /></div>
              <div className="trade-field"><label htmlFor="tp">Take profit</label><Input id="tp" inputMode="decimal" placeholder="Optional" value={tp} onChange={(e) => setTp(e.target.value)} /></div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
              <dt className="text-muted-foreground">Margin needed</dt><dd className="text-right font-semibold">KSh {needMargin.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Value per 1.000 move</dt><dd className="text-right">KSh {lotsOk ? Math.round(lotNum * 1000).toLocaleString() : "—"}</dd>
              <dt className="text-muted-foreground">Spread</dt><dd className="text-right">{fx(ask - bid)}</dd>
              <dt className="text-muted-foreground">Leverage</dt><dd className="text-right">1:100</dd>
            </dl>
            {isAdmin && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">The house account can watch the market but cannot trade.</p>}
            {locked && <p className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Coin Trade is temporarily locked. Open trades can still be closed.</p>}
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs tabular-nums">
              <div><div className="text-muted-foreground">Balance</div><strong>KSh {coins.toLocaleString()}</strong></div>
              <div><div className="text-muted-foreground">Equity</div><strong>KSh {(coins + used + floating).toLocaleString()}</strong></div>
              <div><div className="text-muted-foreground">Margin in trades</div><strong>KSh {used.toLocaleString()}</strong></div>
              <div><div className="text-muted-foreground">Floating P/L</div><strong className={floating >= 0 ? "up" : "down"}>{floating >= 0 ? "+" : ""}{floating.toLocaleString()}</strong></div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">A trade closes automatically at your stop loss, your take profit, or when its loss reaches the margin held, so you can never lose more than that margin.</p>
          </aside>
        </div>

        <div className="trade-panel mt-3">
          <div className="trade-toolbar">
            <button type="button" className={`tb-btn ${tab === "open" ? "is-on" : ""}`} onClick={() => setTab("open")}>Positions ({openTrades.length})</button>
            <button type="button" className={`tb-btn ${tab === "history" ? "is-on" : ""}`} onClick={() => setTab("history")}>History</button>
          </div>
          <div className="overflow-x-auto">
            <table className="trade-table">
              <thead><tr><th>Type</th><th>Volume</th><th>Open price</th><th>S/L</th><th>T/P</th><th>{tab === "open" ? "Current" : "Close price"}</th><th>Margin</th><th>Profit</th><th />{tab === "history" && <th>Reason</th>}</tr></thead>
              <tbody>
                {(tab === "open" ? openTrades : positions.filter((p) => p.status === "closed")).map((p) => {
                  const cur = p.status === "open" ? (p.side === "buy" ? bid : ask) : p.exit_price;
                  const pnl = p.status === "open" ? tradePnl(p.side, p.lots, p.entry, cur ?? p.entry) : p.pnl ?? 0;
                  const editing = edit?.id === p.id;
                  return (
                    <tr key={p.id}>
                      <td><span className={`side-tag ${p.side}`}>{p.side}</span></td>
                      <td>{p.lots.toFixed(2)}</td><td>{fx(p.entry)}</td>
                      <td>{editing ? <Input className="h-7 w-20" value={edit.sl} onChange={(e) => setEdit({ ...edit, sl: e.target.value })} aria-label="Stop loss" /> : fx(p.sl)}</td>
                      <td>{editing ? <Input className="h-7 w-20" value={edit.tp} onChange={(e) => setEdit({ ...edit, tp: e.target.value })} aria-label="Take profit" /> : fx(p.tp)}</td>
                      <td>{fx(cur)}</td><td>{p.margin}</td>
                      <td className={pnl >= 0 ? "up" : "down"}>{pnl >= 0 ? "+" : ""}{pnl.toLocaleString()}</td>
                      <td className="text-right">
                        {p.status === "open" && (editing ? (
                          <><Button size="sm" variant="outline" className="h-7" onClick={() => void saveLevels()}>Save</Button> <Button size="sm" variant="ghost" className="h-7" onClick={() => setEdit(null)}>Cancel</Button></>
                        ) : (
                          <><Button size="sm" variant="outline" className="h-7" onClick={() => setEdit({ id: p.id, sl: p.sl?.toString() ?? "", tp: p.tp?.toString() ?? "" })}>Modify</Button> <Button size="sm" variant="ghost" className="h-7" aria-label="Close trade" onClick={() => void close(p.id)}><X className="h-4 w-4" /></Button></>
                        ))}
                      </td>
                      {tab === "history" && <td className="capitalize">{p.close_reason}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(tab === "open" ? openTrades.length : positions.length - openTrades.length) === 0 && <p className="p-4 text-center text-xs text-muted-foreground">{tab === "open" ? "No open trades." : "No closed trades yet."}</p>}
          </div>
        </div>
      </section>
    </AppLayout>
  );
};

export default CoinTrade;
