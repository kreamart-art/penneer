// De kop van het duelscherm, op de plaat uit de mockup.
//
// DE ZWAARDEN ZITTEN IN DE ART en niet als los plaatje ernaast: in het bestand
// staan ze op een gloed die tot ver in het paneel doorloopt, en die gloed
// afsnijden op een eigen doos zou een rechthoek in het licht zetten.
//
// ALLE MATEN ZIJN DELEN VAN DE PLAAT. De drie statvakjes zijn opgemeten op de
// dunne lijn die eromheen staat, met een hoogdoorlaat over de kolommen (de
// lijn is een paar pixels breed en verdrinkt anders in het verloop van het
// vlak):
//
//   boven 0,7229   onder 0,9040
//   vak 1  x 0,4303 .. 0,6040
//   vak 2  x 0,6233 .. 0,7800
//   vak 3  x 0,7996 .. 0,9570
//
// Het eerste vak is een tik breder dan de andere twee. Dat is zo getekend; ik
// heb ze niet gelijkgetrokken, want dan staat de tekst niet meer in het vak.
//
// DE INHOUD VAN EEN VAKJE KRIMPT als het te breed wordt. "100%" is smaller dan
// "72%" maar "1234" niet, en een winrate van drie cijfers hoort niet over het
// randje te lopen.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { colors, font, withAlpha } from "../theme/tokens";

/** Breedte gedeeld door hoogte van het vel. */
const VERHOUDING = 2.283;

/** De drie vakjes rechtsonder, opgemeten in de art. */
const VAKKEN = [
  { l: 0.4303, r: 0.6040 },
  { l: 0.6233, r: 0.7800 },
  { l: 0.7996, r: 0.9570 },
] as const;
const VAK_T = 0.7229;
const VAK_B = 0.9040;

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Een vakje met een teken, een groot getal en een klein bijschrift eronder. */
function Vak({
  x, breedte, icoon, waarde, label, b,
}: {
  x: number; breedte: number;
  icoon: React.ReactNode; waarde: string; label: string; b: number;
}) {
  const doos = useRef<HTMLSpanElement | null>(null);
  const inhoud = useRef<HTMLSpanElement | null>(null);
  const [krimp, setKrimp] = useState(1);
  useLayoutEffect(() => {
    const d = doos.current, i = inhoud.current;
    if (!d || !i) return;
    const meet = () => {
      if (!i.offsetWidth) return;
      setKrimp(Math.min(1, (d.clientWidth * 0.9) / i.offsetWidth));
    };
    meet();
    // Meekijken en niet eenmalig meten: het eigen lettertype komt later binnen
    // dan de eerste opmaak, en met de terugvalletter is de tekst smaller.
    const ro = new ResizeObserver(meet);
    ro.observe(i); ro.observe(d);
    return () => ro.disconnect();
  }, [b]);

  // Groter dan eerst: het bijschrift is weg, dus die hoogte is nu voor het
  // getal zelf.
  const groot = Math.max(12, b * 0.050);
  return (
    <span
      ref={doos}
      style={{
        position: "absolute",
        left: pct(x), width: pct(breedte),
        top: pct(VAK_T), height: pct(VAK_B - VAK_T),
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", pointerEvents: "none",
      }}
    >
      {/* ALLEEN HET TEKEN EN HET GETAL. Het bijschrift eronder stond er ook,
          maar op telefoonbreedte is een vakje nog geen twee centimeter breed:
          dan wordt dat bijschrift zo klein dat het niet meer te lezen is en
          duwt het de twee dingen die je WEL leest uit het midden. Wat het
          betekent staat in het teken. */}
      <span
        ref={inhoud}
        title={label}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: b * 0.016,
          transform: `scale(${krimp})`, whiteSpace: "nowrap",
        }}
      >
        {icoon}
        <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: groot, lineHeight: 1, color: "#FFF3D0" }}>
          {waarde}
        </span>
      </span>
    </span>
  );
}

export function DuelKop({
  titel, uitleg, winsten, winstenLabel, winrate, winrateLabel, reeks, reeksLabel,
}: {
  titel: string;
  uitleg: string;
  winsten: string;
  winstenLabel: string;
  winrate: string;
  winrateLabel: string;
  reeks: string;
  reeksLabel: string;
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [b, setB] = useState(0);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setB(el.clientWidth);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const titelMaat = Math.max(13, b * 0.062);
  const uitlegMaat = Math.max(9.5, b * 0.0295);
  const tekenMaat = Math.max(11, b * 0.038);

  return (
    <div ref={doos} style={{ position: "relative", width: "100%", aspectRatio: `${VERHOUDING}` }}>
      {/* De schaduw als tweede kopie van dezelfde art: een drop-shadow-filter
          rastert Safari apart en dan zie je de doos van de laag over de plaat. */}
      <img
        src="/ui/duel/kop.webp" alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(10px)", opacity: 0.5, transform: "translateY(7px)", pointerEvents: "none" }}
      />
      <img src="/ui/duel/kop.webp" alt="" aria-hidden draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

      {/* De kop en de uitleg vullen het vlak rechts van de zwaarden, boven de
          vakjes. De regelafbreking staat in de tekst zelf: bij een vaste
          breedte breekt hij op elke taal en elke telefoon net ergens anders. */}
      <span
        style={{
          position: "absolute",
          left: pct(0.4000), width: pct(0.9700 - 0.4000),
          top: pct(0.0900), height: pct(0.6100),
          display: "flex", flexDirection: "column", justifyContent: "center", gap: b * 0.014,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: font.wide, fontWeight: 700, fontSize: titelMaat, lineHeight: 1,
            letterSpacing: titelMaat * 0.045, marginRight: -titelMaat * 0.045,
            textTransform: "uppercase", color: "#FFF3D0",
            textShadow: `0 0 ${titelMaat * 0.5}px ${withAlpha(colors.gold, 0.4)}, 0 2px 4px rgba(0,0,0,.75)`,
          }}
        >
          {titel}
        </span>
        <span style={{ fontFamily: font.ui, fontSize: uitlegMaat, lineHeight: 1.4, color: "rgba(238,231,255,.9)", whiteSpace: "pre-line" }}>
          {uitleg}
        </span>
      </span>

      <Vak
        x={VAKKEN[0].l} breedte={VAKKEN[0].r - VAKKEN[0].l} b={b}
        icoon={<img src="/ui/stat/winsten.webp" alt="" aria-hidden draggable={false} style={{ height: tekenMaat, width: "auto", display: "block" }} />}
        waarde={winsten} label={winstenLabel}
      />
      <Vak
        x={VAKKEN[1].l} breedte={VAKKEN[1].r - VAKKEN[1].l} b={b}
        icoon={
          <svg width={tekenMaat} height={tekenMaat} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M19 5L5 19" /><circle cx="7.5" cy="7.5" r="2.6" /><circle cx="16.5" cy="16.5" r="2.6" />
          </svg>
        }
        waarde={winrate} label={winrateLabel}
      />
      <Vak
        x={VAKKEN[2].l} breedte={VAKKEN[2].r - VAKKEN[2].l} b={b}
        icoon={<img src="/ui/stat/kroon.webp" alt="" aria-hidden draggable={false} style={{ height: tekenMaat, width: "auto", display: "block" }} />}
        waarde={reeks} label={reeksLabel}
      />
    </div>
  );
}
