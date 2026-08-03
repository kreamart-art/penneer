// De drie spelsecties van de dagronde, op de art uit de mockup.
//
// EEN PLAAT PER ONDERDEEL, en die plaat draagt alles: de illustratie links, een
// donkere pil in het midden voor het aantal spelers, en rechts een vak voor de
// stand. De tekst wordt er alleen overheen gezet.
//
// ALLE MATEN ZIJN DELEN VAN DE PLAAT, opgemeten met een raster over de
// bestanden. Dat moet ook, want de plaat schaalt met de schermbreedte mee en
// vaste punten zouden er bij elke telefoon anders op vallen.
//
// DE PILLEN ZIJN GEMETEN EN NIET GESCHAT, in twee richtingen.
//
// Van boven en onder door het verschil tussen twee rijen te nemen in een strook
// die ver van de illustratie en van het standvak ligt (x 0,44 tot 0,66): de pil
// loopt bij Woorden van 0,671 tot 0,871, bij Topografie van 0,752 tot 0,934 en
// bij de Arena van 0,736 tot 0,907.
//
// Van links en rechts was lastiger, want het randlijntje is maar een paar pixels
// breed en verdrinkt in de gloed die van de illustratie af naar rechts wegzakt.
// Wat wel werkt: van elke kolom het gemiddelde van een brede omgeving aftrekken
// (een hoogdoorlaat), zodat die trage gloed wegvalt en alleen dunne lijnen
// overblijven, en dan middelen over de middelste zestig procent van de pilhoogte
// zodat alleen lijnen overblijven die over de HELE pil doorlopen. Dat geeft in
// alle drie de vellen dezelfde linkerrand, x 0,440, en een rechterrand op 0,730,
// 0,730 en 0,689. Mijn eerste schatting van de linkerrand lag op 0,32, midden in
// de illustratie, en daardoor stak het mensen-teken links naast de pil uit.
//
// DE DRIE VELLEN ZIJN OP DE DEKKENDE PLAAT GESNEDEN en niet op hun alfa-doos.
// Om de arena zit veel meer gloed dan om de andere twee (0,964 tegen 0,996 van
// het vel), en op dezelfde doos viel die daardoor drie procent smaller uit dan
// zijn buren. Op de plaat snijden zet ze alle drie even breed: gemeten x 129,
// 129 en 125 in het bronvel, met breedtes 3830, 3829 en 3838.
//
// DE LETTERGROOTTES OOK. Ze staan in delen van de breedte en niet in punten:
// een titel van 16 punten staat royaal op een plaat van 460 en loopt eruit op
// een plaat van 320. Daarom meet de sectie zichzelf op.
//
// HET VINKJE ZIT IN DE ART, en dat klopt alleen als je klaar bent. Ben je dat
// niet, dan komt er een donkere schijf met een speeldriehoek overheen: dan leest
// dezelfde plaat als een uitnodiging in plaats van als een afvinkje.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { font, withAlpha } from "../theme/tokens";

type Vak = { l: number; r: number; t: number; b: number };
type Plaat = {
  art: string;
  /** breedte gedeeld door hoogte van het vel */
  v: number;
  kleur: string;
  /** waar de titel en de omschrijving mogen staan */
  tekst: Vak;
  /** de donkere pil voor het aantal spelers */
  pil: Vak;
  /** het vak rechts, waar de stand in komt */
  plaat: Vak;
  /** De lege ring rechtsboven; ontbreekt bij de arena, die heeft zwaarden.
   *  x en y zijn het MIDDELPUNT van de ring in de art, d is de buitendiameter
   *  als deel van de plaatbreedte. Opgemeten op de rij door het midden van de
   *  ring: op een andere rij is de koorde korter dan de diameter en zet je hem
   *  te klein en te hoog. */
  ring?: { x: number; y: number; d: number };
};

export const DAG_PLATEN: Record<"woorden" | "topo" | "arena", Plaat> = {
  // De nieuwe art heeft exact dezelfde verhoudingen als de vorige, dus de
  // vakken hieronder zijn ongewijzigd. Alleen de ring is opnieuw opgemeten,
  // want daar zat het vinkje in gebakken en dat is er nu uit.
  woorden: {
    art: "/ui/dag/woorden.webp?v=3", v: 1080 / 310, kleur: "#FFC23D",
    tekst: { l: 0.440, r: 0.760, t: 0.10, b: 0.62 },
    pil: { l: 0.441, r: 0.730, t: 0.671, b: 0.871 },
    plaat: { l: 0.768, r: 0.945, t: 0.38, b: 0.90 },
    ring: { x: 0.8569, y: 0.3306, d: 0.0917 },
  },
  topo: {
    art: "/ui/dag/topo.webp?v=3", v: 1080 / 302, kleur: "#5AC8FF",
    tekst: { l: 0.440, r: 0.760, t: 0.10, b: 0.72 },
    pil: { l: 0.440, r: 0.730, t: 0.752, b: 0.934 },
    plaat: { l: 0.768, r: 0.945, t: 0.40, b: 0.90 },
    ring: { x: 0.8569, y: 0.3262, d: 0.0917 },
  },
  arena: {
    art: "/ui/dag/arena.webp?v=3", v: 1080 / 331, kleur: "#FF6A55",
    tekst: { l: 0.440, r: 0.700, t: 0.10, b: 0.70 },
    pil: { l: 0.440, r: 0.689, t: 0.736, b: 0.907 },
    plaat: { l: 0.705, r: 0.965, t: 0.575, b: 0.905 },
  },
};

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Een mensen-teken voor de spelerspil. Mono lijnwerk, net als de rest. */
function Mensen({ maat, kleur }: { maat: number; kleur: string }) {
  return (
    <svg width={maat} height={maat} viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M16 20v-1.6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7.2" r="3.2" />
      <path d="M22 20v-1.6a4 4 0 0 0-3-3.87" />
      <path d="M16.2 4.1a4 4 0 0 1 0 7.2" />
    </svg>
  );
}

export function DagSectie({
  soort, titel, omschrijving, spelers, klaar, klaarLabel, speelLabel, onClick,
}: {
  soort: "woorden" | "topo" | "arena";
  titel: string;
  omschrijving: string;
  /** De regel met het aantal spelers; leeg laat de pil leeg. */
  spelers: string;
  klaar: boolean;
  klaarLabel: string;
  speelLabel: string;
  onClick: () => void;
}) {
  const P = DAG_PLATEN[soort];
  const doos = useRef<HTMLButtonElement | null>(null);
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

  // Alles wat tekst is, in delen van de plaatbreedte.
  const titelMaat = Math.max(11, b * 0.049);
  const omMaat = Math.max(8, b * 0.0285);
  const pilMaat = Math.max(6.5, b * 0.0215);
  const standMaat = Math.max(8, b * 0.0295);
  const sterMaat = Math.max(6, b * 0.0215);

  // DE PILINHOUD VOEGT ZICH NAAR DE PIL. Wat erin staat wisselt: "0 spelers
  // vandaag" is langer dan "8 players today" en de arena zegt "Onbeperkt
  // spelen" in een pil die smaller is dan die van de andere twee. Een vaste
  // lettergrootte past dus in het ene geval wel en in het andere niet, en dan
  // steekt het teken de rand uit.
  //
  // Meten met offsetWidth en NIET met getBoundingClientRect: offsetWidth geeft
  // de opmaakbreedte en telt de transform niet mee, dus de meting blijft
  // dezelfde zodra de krimp erop staat en er ontstaat geen kringetje van meten
  // en opnieuw meten.
  const pilDoos = useRef<HTMLSpanElement | null>(null);
  const pilInhoud = useRef<HTMLSpanElement | null>(null);
  const [krimp, setKrimp] = useState(1);
  useLayoutEffect(() => {
    const doos = pilDoos.current, inhoud = pilInhoud.current;
    if (!doos || !inhoud || !inhoud.offsetWidth) return;
    // 0,82 en niet 1: aan weerskanten hoort lucht te blijven staan, anders
    // plakt de tekst tegen het randlijntje van de pil aan.
    setKrimp(Math.min(1, (doos.offsetWidth * 0.82) / inhoud.offsetWidth));
  }, [b, spelers, pilMaat]);

  return (
    <button
      ref={doos}
      onClick={onClick}
      className="pressable"
      style={{
        position: "relative", width: "100%", aspectRatio: `${P.v}`,
        appearance: "none", border: "none", background: "transparent", padding: 0,
        cursor: "pointer", display: "block", textAlign: "left",
      }}
    >
      {/* De schaduw als tweede kopie van dezelfde art: een drop-shadow-filter
          rastert Safari apart en dan zie je de doos van de laag over de plaat. */}
      <img
        src={P.art} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(10px)", opacity: 0.55, transform: "translateY(7px)", pointerEvents: "none" }}
      />
      <img src={P.art} alt="" aria-hidden draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

      {/* Titel en omschrijving in het middenvak. */}
      <span
        style={{
          position: "absolute",
          left: pct(P.tekst.l), width: pct(P.tekst.r - P.tekst.l),
          top: pct(P.tekst.t), height: pct(P.tekst.b - P.tekst.t),
          display: "flex", flexDirection: "column", justifyContent: "center", gap: b * 0.012,
        }}
      >
        <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: titelMaat, letterSpacing: titelMaat * 0.05, marginRight: -titelMaat * 0.05, textTransform: "uppercase", color: P.kleur, textShadow: `0 0 ${titelMaat * 0.7}px ${withAlpha(P.kleur, 0.45)}, 0 2px 4px rgba(0,0,0,.7)`, lineHeight: 1 }}>
          {titel}
        </span>
        <span style={{ fontFamily: font.ui, fontSize: omMaat, lineHeight: 1.32, color: "rgba(236,228,255,.82)", whiteSpace: "pre-line" }}>
          {omschrijving}
        </span>
      </span>

      {/* De spelerspil zit al in de plaat; hier komt alleen wat erin staat. */}
      {!!spelers && (
        <span
          ref={pilDoos}
          style={{
            position: "absolute",
            left: pct(P.pil.l), width: pct(P.pil.r - P.pil.l),
            top: pct(P.pil.t), height: pct(P.pil.b - P.pil.t),
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}
        >
          <span
            ref={pilInhoud}
            style={{
              display: "flex", alignItems: "center", gap: pilMaat * 0.5,
              transform: `scale(${krimp})`, transformOrigin: "center center",
              whiteSpace: "nowrap",
            }}
          >
            <Mensen maat={pilMaat * 1.25} kleur={withAlpha(P.kleur, 0.85)} />
            <span style={{ fontFamily: font.ui, fontSize: pilMaat, color: "rgba(236,228,255,.78)" }}>{spelers}</span>
          </span>
        </span>
      )}

      {/* Het vak rechts: klaar of nog te spelen. */}
      <span
        style={{
          position: "absolute",
          left: pct(P.plaat.l), width: pct(P.plaat.r - P.plaat.l),
          top: pct(P.plaat.t), height: pct(P.plaat.b - P.plaat.t),
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: b * 0.006,
        }}
      >
        {klaar ? (
          <>
            <span style={{ display: "flex", gap: sterMaat * 0.24, color: P.kleur, fontSize: sterMaat, lineHeight: 1 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} width={sterMaat} height={sterMaat} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z" />
                </svg>
              ))}
            </span>
            <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: standMaat, letterSpacing: standMaat * 0.06, marginRight: -standMaat * 0.06, textTransform: "uppercase", color: P.kleur, textShadow: `0 0 ${standMaat}px ${withAlpha(P.kleur, 0.5)}` }}>
              {klaarLabel}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: standMaat * 1.25, letterSpacing: standMaat * 0.09, marginRight: -standMaat * 0.09, textTransform: "uppercase", color: "#FFF3D0", textShadow: `0 0 ${standMaat}px ${withAlpha(P.kleur, 0.7)}, 0 2px 4px rgba(0,0,0,.6)` }}>
            {speelLabel}
          </span>
        )}
      </span>

      {/* De ring in de art is LEEG, dus hier komt alleen wat erin hoort: een
          vinkje als je klaar bent, een speeldriehoek als je nog moet. Geen
          eigen schijf en geen eigen randje meer: die waren er om het
          ingebakken vinkje af te dekken, en zouden nu de gouden ring uit de
          art onnodig overschilderen. */}
      {P.ring && (
        <span
          style={{
            position: "absolute",
            left: pct(P.ring.x - P.ring.d / 2), width: pct(P.ring.d),
            top: pct(P.ring.y - (P.ring.d * P.v) / 2), height: pct(P.ring.d * P.v),
            display: "grid", placeItems: "center", pointerEvents: "none",
          }}
        >
          {klaar ? (
            <svg width={b * 0.058} height={b * 0.058} viewBox="0 0 24 24" fill="none" stroke={P.kleur}
                 strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
          ) : (
            <svg width={b * 0.050} height={b * 0.050} viewBox="0 0 24 24" fill={P.kleur} aria-hidden style={{ marginLeft: b * 0.005 }}>
              <path d="M7 4.5l12 7.5-12 7.5z" />
            </svg>
          )}
        </span>
      )}
    </button>
  );
}
