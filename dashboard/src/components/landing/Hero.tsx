"use client";
// The opening: one still image that slowly zooms in as you scroll, with three lines of the story over it.
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSurveyNumbers } from "./SurveyNumbers";

// The zoom closes in on her. The source is 1696 px wide, so the zoom stays gentle to stay sharp.
const HERO = { src: "/hero.webp", focus: "76% 74%", zoom: 0.7 };
/** Where each line is visible, as a share of the hero's scroll. */
const BEATS: [number, number][] = [[-1, 0.3], [0.34, 0.64], [0.68, 2]];
const FADE = 0.08;

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { numbers: n } = useSurveyNumbers();

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const beats = el.querySelectorAll<HTMLElement>(".ld-beat");
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      el.style.setProperty("--p", p.toFixed(4));
      BEATS.forEach(([a, b], i) => {
        const beat = beats[i];
        if (!beat) return;
        const o = Math.min(1, Math.max(0, Math.min((p - a) / FADE, (b - p) / FADE)));
        beat.style.setProperty("--o", o.toFixed(3));
        beat.style.visibility = o > 0.01 ? "visible" : "hidden";
      });
    };
    const onScroll = () => { frame ||= requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <section ref={ref} className="ld-hero" style={{ "--focus": HERO.focus, "--zoom": HERO.zoom } as React.CSSProperties}>
      <div className="ld-stage">
        {/* eslint-disable-next-line @next/next/no-img-element -- a CSS-transformed backdrop; next/image adds nothing here */}
        <img className="ld-hero-img" src={HERO.src} alt="" fetchPriority="high" />
        <div className="ld-fog ld-fog-a" aria-hidden />
        <div className="ld-fog ld-fog-b" aria-hidden />
        <div className="ld-shade" aria-hidden />

        <div className="ld-beat ld-beat-0">
          <p className="micro ld-eyebrow">Edinburgh, after dark</p>
          <h1 className="display ld-h1">Every council knows where its lamps are. Nobody measures the light on the pavement.</h1>
          <p className="ld-lede">
            Leerie turns a phone into a street light meter, maps how dark each street really is,
            and tells the council which ones to fix first.
          </p>
          <div className="ld-ctas">
            <Link className="lr-button" href="/map">Open the live map</Link>
            <a className="lr-button lr-button-ghost" href="#why">Why it matters</a>
          </div>
          <p className="ld-scroll micro" aria-hidden>Scroll</p>
        </div>

        <div className="ld-beat ld-beat-1">
          <p className="micro ld-eyebrow">Step 1 · Walk</p>
          <h2 className="display ld-h2">Any phone becomes a light meter.</h2>
          <p className="ld-lede">
            Point the camera ahead and walk. Leerie reads the shutter speed and ISO to undo auto-exposure,
            and keeps one number a second. The picture never leaves the phone.
          </p>
        </div>

        <div className="ld-beat ld-beat-2">
          <p className="micro ld-eyebrow">Step 2 · Map</p>
          <h2 className="display ld-h2">Mapped street by street.</h2>
          <p className="ld-lede">
            {n ? (
              <>In one night we measured <b className="data">{n.measured.toLocaleString("en-GB")}</b> street segments with{" "}
                <b className="data">{n.readings.toLocaleString("en-GB")}</b> readings, and predicted{" "}
                <b className="data">{n.predicted.toLocaleString("en-GB")}</b> more from their neighbours.</>
            ) : "See where we measured light across Edinburgh and where nearby readings support an estimate."}
          </p>
          <Link className="lr-button" href="/map">See the map</Link>
        </div>
      </div>
    </section>
  );
}
