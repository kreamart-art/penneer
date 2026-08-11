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

/** Een plaat met zijn opgemeten maten. Twee stuks: de zwaarden bovenaan en de
 *  wereldbol van de live duels. Ze delen alles behalve deze getallen, dus ze
 *  delen ook de component eronder; twee kopieen zouden na de eerste wijziging
 *  uit elkaar lopen. */
interface Plaat {
  art: string;
  /** Breedte gedeeld door hoogte van het vel. */
  verhouding: number;
  /** De drie vakjes rechtsonder. */
  vakken: readonly { l: number; r: number }[];
  vakT: number;
  vakB: number;
  /** Waar de kop en de uitleg staan: links, rechts, boven en hoog. */
  tekst: { l: number; r: number; t: number; h: number };
}

const ZWAARDEN: Plaat = {
  art: "/ui/duel/kop.webp",
  verhouding: 2.283,
  vakken: [
    { l: 0.4303, r: 0.6040 },
    { l: 0.6233, r: 0.7800 },
    { l: 0.7996, r: 0.9570 },
  ],
  vakT: 0.7229,
  vakB: 0.9040,
  tekst: { l: 0.4000, r: 0.9700, t: 0.0900, h: 0.6100 },
};

/** De wereldbol van de live duels. Op dezelfde manier opgemeten: de vakjes zijn
 *  hier alle drie even breed (0,159) en de lijn eromheen zit op
 *
 *    boven 0,7061   onder 0,9034
 *    vak 1  x 0,4142 .. 0,5731
 *    vak 2  x 0,5924 .. 0,7522
 *    vak 3  x 0,7712 .. 0,9311
 *
 *  De tekst begint links precies boven het eerste vakje: op de mockup staat de
 *  kop op die lijn, en dat is ook waarom het niet dezelfde getallen als de
 *  zwaardenplaat zijn. */
const WERELD: Plaat = {
  art: "/ui/duel/live.webp",
  verhouding: 2.7714,
  vakken: [
    { l: 0.4142, r: 0.5731 },
    { l: 0.5924, r: 0.7522 },
    { l: 0.7712, r: 0.9311 },
  ],
  vakT: 0.7061,
  vakB: 0.9034,
  // Het blok staat LAGER dan bij de zwaardenplaat en is minder hoog: hier
  // staan maar twee regels onder de kop, en die zweefden bovenin terwijl er
  // onder de tekst een gat bleef tot aan de vakjes. De inhoud staat verticaal
  // in het midden van dit vak, dus door het vak zelf te laten zakken zakt het
  // geheel mee.
  tekst: { l: 0.4142, r: 0.9311, t: 0.1800, h: 0.4400 },
};

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Een vakje met een teken, een groot getal en een klein bijschrift eronder. */
function Vak({
  x, breedte, t, h, icoon, waarde, label, b,
}: {
  x: number; breedte: number; t: number; h: number;
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
        top: pct(t), height: pct(h),
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

function KopPlaat({
  plaat, titel, uitleg, winsten, winstenLabel, winrate, winrateLabel, reeks, reeksLabel,
}: {
  plaat: Plaat;
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
    <div ref={doos} style={{ position: "relative", width: "100%", aspectRatio: `${plaat.verhouding}` }}>
      {/* De schaduw als tweede kopie van dezelfde art: een drop-shadow-filter
          rastert Safari apart en dan zie je de doos van de laag over de plaat. */}
      <img
        src={plaat.art} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(10px)", opacity: 0.5, transform: "translateY(7px)", pointerEvents: "none" }}
      />
      <img src={plaat.art} alt="" aria-hidden draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

      {/* De kop en de uitleg vullen het vlak rechts van de zwaarden, boven de
          vakjes. De regelafbreking staat in de tekst zelf: bij een vaste
          breedte breekt hij op elke taal en elke telefoon net ergens anders. */}
      <span
        style={{
          position: "absolute",
          left: pct(plaat.tekst.l), width: pct(plaat.tekst.r - plaat.tekst.l),
          top: pct(plaat.tekst.t), height: pct(plaat.tekst.h),
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
        x={plaat.vakken[0].l} breedte={plaat.vakken[0].r - plaat.vakken[0].l}
        t={plaat.vakT} h={plaat.vakB - plaat.vakT} b={b}
        icoon={<img src="/ui/stat/winsten.webp" alt="" aria-hidden draggable={false} style={{ height: tekenMaat, width: "auto", display: "block" }} />}
        waarde={winsten} label={winstenLabel}
      />
      <Vak
        x={plaat.vakken[1].l} breedte={plaat.vakken[1].r - plaat.vakken[1].l}
        t={plaat.vakT} h={plaat.vakB - plaat.vakT} b={b}
        icoon={
          <svg width={tekenMaat} height={tekenMaat} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M19 5L5 19" /><circle cx="7.5" cy="7.5" r="2.6" /><circle cx="16.5" cy="16.5" r="2.6" />
          </svg>
        }
        waarde={winrate} label={winrateLabel}
      />
      <Vak
        x={plaat.vakken[2].l} breedte={plaat.vakken[2].r - plaat.vakken[2].l}
        t={plaat.vakT} h={plaat.vakB - plaat.vakT} b={b}
        icoon={<img src="/ui/stat/kroon.webp" alt="" aria-hidden draggable={false} style={{ height: tekenMaat, width: "auto", display: "block" }} />}
        waarde={reeks} label={reeksLabel}
      />
    </div>
  );
}

/** De kop van het duelscherm: de zwaarden. */
export function DuelKop(props: Omit<React.ComponentProps<typeof KopPlaat>, "plaat">) {
  return <KopPlaat plaat={ZWAARDEN} {...props} />;
}

/** De sectie van de live duels: de wereldbol. Zelfde opbouw, andere plaat. */
export function DuelLiveKop(props: Omit<React.ComponentProps<typeof KopPlaat>, "plaat">) {
  return <KopPlaat plaat={WERELD} {...props} />;
}
