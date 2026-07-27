// DEMO, niet aangesloten op de app. Een prijzenkist om de premium-game-ui skill
// aan een echte feature te toetsen. Bewust met een underscore ervoor en zonder
// import vanuit App: zo staat hij wel in het project maar niet in de bundel.
//
// Wat hier getoond wordt, per vakregel:
//
//  1  MATERIAAL   De kist is donker metaal met gouden banden, geen bruin vierkant.
//                 Elke zeldzaamheid is een ander materiaal: steen, glas, kristal,
//                 gepolijst goud.
//  2  LAGEN       Kist en kaart bestaan elk uit acht lagen: vulling, verloop,
//                 binnenschaduw, rand, highlight, reflectie, omgevingslicht,
//                 aanraaktoestand.
//  3  HIERARCHIE  Kist eerst, dan de knop, dan de uitleg, dan de reeks onderin.
//  4  LICHTBRON   Alles wordt belicht van linksboven. Bovenranden lichter,
//                 onderranden donkerder, hoeken feller.
//  7  GAME FEEL   De kist wiebelt tot je hem opent en zakt in bij het indrukken.
//  8  GLOED       Bloom uit een vervaagde kopie, klein en dicht op het object.
//  9  DIEPTE      Eerst de vorm en de schaduw, pas daarna licht en gloed.
// 10  KLEUR       Gedempt paars als basis, goud als beloningskleur. Alleen de
//                 beloning is vol verzadigd.
// 14  BELONING    Vier zeldzaamheden, elk met een eigen belichtingstaal: meer
//                 stralen, meer gloed, feller randlicht naarmate het zeldzamer is.
import { useState } from "react";
import { Screen, Card } from "../components/Layout";
import { Button } from "../components/Button";
import { NeonText } from "../components/NeonText";
import { neonSkin, rampFrom, ringGradient } from "../theme/neon";
import { colors, font, withAlpha } from "../theme/tokens";

type RarityKey = "gewoon" | "zeldzaam" | "episch" | "legendarisch";

interface Rarity {
  key: RarityKey;
  label: string;
  accent: string;
  /** De belichtingstaal: hoeveel stralen, hoe ver de bloom, hoe fel de rand. */
  rays: number;
  bloom: number;
  material: string;
}

// Zeldzaamheid is niet alleen een andere kleur maar een andere HOEVEELHEID licht.
// Dat is wat een legendarische beloning waardevol laat voelen voordat je weet
// wat erin zit.
const RARITIES: Rarity[] = [
  { key: "gewoon", label: "Gewoon", accent: "#7E8AA8", rays: 0, bloom: 10, material: "Dof steen" },
  { key: "zeldzaam", label: "Zeldzaam", accent: "#28C2FF", rays: 8, bloom: 18, material: "Glas" },
  { key: "episch", label: "Episch", accent: "#A96BFF", rays: 12, bloom: 26, material: "Energiekristal" },
  { key: "legendarisch", label: "Legendarisch", accent: "#FFC23D", rays: 18, bloom: 36, material: "Gepolijst goud" },
];

const PRIZES: Record<RarityKey, { art: string; name: string; sub: string }> = {
  gewoon: { art: "/coin.webp", name: "50 munten", sub: "Valuta" },
  zeldzaam: { art: "/coin.webp", name: "300 munten", sub: "Valuta" },
  episch: { art: "/buzzers/bz01.webp", name: "Draai-knop Nederland", sub: "Knop-skin" },
  legendarisch: { art: "/frames/fr01.webp", name: "Gouden frame", sub: "Avatar-frame" },
};

const GOLD = rampFrom(colors.gold);

export function DemoKist() {
  const [open, setOpen] = useState(false);
  const [rarity, setRarity] = useState<Rarity>(RARITIES[2]);
  const prize = PRIZES[rarity.key];

  const roll = () => {
    // In het echt zou de server dit bepalen. Hier alleen om de vier
    // belichtingstalen naast elkaar te kunnen zien.
    const next = RARITIES[Math.floor(Math.random() * RARITIES.length)];
    setRarity(next);
    setOpen(true);
  };

  return (
    <Screen>
      <style>{`
        @keyframes kist-wiebel {
          0%, 88%, 100% { transform: rotate(0deg) }
          91% { transform: rotate(-3.5deg) }
          94% { transform: rotate(3deg) }
          97% { transform: rotate(-1.5deg) }
        }
        @keyframes kist-burst {
          from { transform: scale(.4); opacity: 0 }
          60%  { opacity: 1 }
          to   { transform: scale(1); opacity: 1 }
        }
        @keyframes kist-draai { to { transform: rotate(360deg) } }
        @keyframes kist-op {
          from { transform: translateY(14px) scale(.9); opacity: 0 }
          to   { transform: translateY(0) scale(1); opacity: 1 }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
        {/* Hierarchie: dit is de kop, niet de hoofdactie. Dus stil gehouden. */}
        <div style={{ textAlign: "center" }}>
          <NeonText accent={colors.gold} blur={14} glow={0.7} style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, letterSpacing: 0.5 }}>
            Dagkist
          </NeonText>
          <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            Elke dag een kist. Wat erin zit hangt af van hoe ver je komt.
          </p>
        </div>

        <div style={{ position: "relative", display: "grid", placeItems: "center", minHeight: 300 }}>
          {open ? <Reveal rarity={rarity} prize={prize} /> : <Kist />}
        </div>

        <Button variant={open ? "primary" : "gold"} full onClick={() => (open ? setOpen(false) : roll())}>
          {open ? "Nog een keer" : "Open de kist"}
        </Button>

        {/* De reeks onderin: de belichtingstaal per zeldzaamheid naast elkaar. */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
            Zeldzaamheid
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {RARITIES.map((r) => (
              <button
                key={r.key}
                onClick={() => { setRarity(r); setOpen(true); }}
                className="pressable"
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
              >
                <Gem rarity={r} />
                <span style={{ fontFamily: font.ui, fontSize: 9.5, fontWeight: 700, color: r.accent }}>{r.label}</span>
                <span style={{ fontFamily: font.ui, fontSize: 8.5, color: colors.faint }}>{r.material}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </Screen>
  );
}

/** De kist zelf. Donker metaal met gouden banden, belicht van linksboven.
 *
 *  De opbouw van onder naar boven: slagschaduw op de grond, de romp met zijn
 *  verloop en binnenschaduw, de gouden banden, het deksel met zijn eigen
 *  belichting, het slot, en bovenop een dun glansstreepje langs de bovenrand. */
function Kist() {
  return (
    <div style={{ position: "relative", width: 200, height: 190, animation: "kist-wiebel 3.4s ease-in-out infinite" }}>
      {/* De schaduw op de grond. Diepte komt eerst. */}
      <div style={{ position: "absolute", left: "12%", right: "12%", bottom: 2, height: 16, borderRadius: "50%", background: "radial-gradient(50% 50%, rgba(0,0,0,.6), transparent 72%)" }} />
      {/* Omgevingslicht: de kist staat ergens, niet in het niets. */}
      <div style={{ position: "absolute", inset: -40, background: `radial-gradient(50% 45% at 50% 60%, ${withAlpha(colors.gold, 0.12)}, transparent 70%)`, pointerEvents: "none" }} />

      {/* Romp */}
      <div
        style={{
          position: "absolute", left: 8, right: 8, bottom: 14, height: 104,
          borderRadius: "10px 10px 14px 14px",
          padding: 2,
          background: ringGradient(rampFrom("#4A3E6B")),
          boxShadow: "0 10px 22px rgba(0,0,0,.55)",
        }}
      >
        <div
          style={{
            width: "100%", height: "100%", borderRadius: "8px 8px 12px 12px",
            backgroundImage: [
              "linear-gradient(180deg, rgba(255,255,255,.14) 0%, transparent 12%)",
              "radial-gradient(120% 90% at 30% 0%, rgba(169,107,255,.22), transparent 60%)",
              "linear-gradient(180deg, #3A2F58 0%, #241C3C 55%, #140F26 100%)",
            ].join(", "),
            boxShadow: "inset 0 -10px 16px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.1)",
          }}
        />
        <Band left="16%" />
        <Band left="72%" />
      </div>

      {/* Deksel. Eigen belichting: het vangt het licht van linksboven het eerst. */}
      <div
        style={{
          position: "absolute", left: 2, right: 2, top: 26, height: 66,
          borderRadius: "16px 16px 6px 6px",
          padding: 2,
          background: ringGradient(GOLD),
          boxShadow: "0 6px 14px rgba(0,0,0,.5)",
        }}
      >
        <div
          style={{
            width: "100%", height: "100%", borderRadius: "14px 14px 4px 4px",
            backgroundImage: [
              "linear-gradient(180deg, rgba(255,243,181,.5) 0%, rgba(255,243,181,.08) 9%, transparent 24%)",
              "radial-gradient(70% 60% at 34% 8%, rgba(255,243,181,.4), transparent 62%)",
              "linear-gradient(180deg, #4A3B69 0%, #2C2247 52%, #191230 100%)",
            ].join(", "),
            boxShadow: "inset 0 -8px 14px rgba(0,0,0,.5), inset 0 1.5px 0 rgba(255,243,181,.55)",
          }}
        />
        <Band left="16%" top />
        <Band left="72%" top />
      </div>

      {/* Slot: het duurste detail, dus vol goud en met een eigen glans. */}
      <div
        style={{
          position: "absolute", left: "50%", top: 74, transform: "translateX(-50%)",
          width: 40, height: 44, borderRadius: 8, padding: 1.5,
          background: ringGradient(GOLD),
          boxShadow: `0 3px 8px rgba(0,0,0,.55), 0 0 14px ${withAlpha(colors.gold, 0.35)}`,
        }}
      >
        <div
          style={{
            width: "100%", height: "100%", borderRadius: 6.5, display: "grid", placeItems: "center",
            background: `linear-gradient(180deg, ${GOLD[3]} 0%, ${GOLD[2]} 34%, ${GOLD[1]} 74%, ${GOLD[0]} 100%)`,
            boxShadow: "inset 0 1px 0 rgba(255,243,181,.9), inset 0 -3px 5px rgba(107,52,0,.55)",
          }}
        >
          {/* Sleutelgat: een gat, dus donker bovenaan en licht onderaan. */}
          <span style={{ width: 9, height: 15, borderRadius: "50% 50% 40% 40%", background: "#2A1B05", boxShadow: "inset 0 2px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,243,181,.5)" }} />
        </div>
      </div>
    </div>
  );
}

/** Een gouden band over de kist. Bovenranden lichter, onderranden donkerder. */
function Band({ left, top = false }: { left: string; top?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute", left, top: top ? -2 : -1, bottom: -1, width: 12,
        background: `linear-gradient(90deg, ${GOLD[0]} 0%, ${GOLD[2]} 26%, ${GOLD[3]} 44%, ${GOLD[2]} 62%, ${GOLD[0]} 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,243,181,.7), 0 0 8px rgba(255,194,61,.25)",
      }}
    />
  );
}

/** De onthulling. Hoe zeldzamer, hoe meer licht: meer stralen, wijdere bloom,
 *  feller randlicht. Dat is de belichtingstaal van regel 14. */
function Reveal({ rarity, prize }: { rarity: Rarity; prize: { art: string; name: string; sub: string } }) {
  const ramp = rampFrom(rarity.accent);
  return (
    <div style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", animation: "kist-burst .45s cubic-bezier(.2,1.3,.4,1)" }}>
      {/* Stralen. Alleen vanaf zeldzaam, en ze draaien langzaam mee. */}
      {rarity.rays > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute", width: 300, height: 300,
            background: `repeating-conic-gradient(from 0deg, ${withAlpha(rarity.accent, 0.22)} 0deg ${180 / rarity.rays}deg, transparent ${180 / rarity.rays}deg ${360 / rarity.rays}deg)`,
            WebkitMaskImage: "radial-gradient(circle, #000 12%, transparent 62%)",
            maskImage: "radial-gradient(circle, #000 12%, transparent 62%)",
            animation: "kist-draai 22s linear infinite",
          }}
        />
      )}
      {/* Bloom: een vervaagde vlek, met ruimte om zich heen zodat je zijn doos
          nooit ziet. */}
      <div aria-hidden style={{ position: "absolute", width: rarity.bloom * 7, height: rarity.bloom * 7, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(rarity.accent, 0.4)}, transparent 68%)`, filter: `blur(${rarity.bloom / 2}px)` }} />

      {/* De prijskaart. Verlooprand, donkere vulling, licht van linksboven. */}
      <div
        className="neon-ring"
        style={{
          position: "relative", width: 186, borderRadius: 20, padding: 2,
          ...neonSkin(rarity.accent),
          ["--ng-w" as string]: "2px",
          boxShadow: `0 14px 34px rgba(0,0,0,.6), 0 0 ${rarity.bloom}px ${withAlpha(rarity.accent, 0.45)}`,
          animation: "kist-op .5s cubic-bezier(.2,1.3,.4,1) both",
        } as React.CSSProperties}
      >
        <div
          style={{
            borderRadius: 18, padding: "18px 14px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            backgroundImage: [
              "linear-gradient(180deg, rgba(255,255,255,.1) 0%, transparent 14%)",
              `radial-gradient(90% 60% at 50% 0%, ${withAlpha(rarity.accent, 0.22)}, transparent 65%)`,
              "linear-gradient(180deg, #1B1436 0%, #0C0820 100%)",
            ].join(", "),
            boxShadow: `inset 0 -12px 20px rgba(0,0,0,.5), inset 0 1.5px 0 ${withAlpha(ramp[3], 0.5)}`,
          }}
        >
          <img src={prize.art} alt="" width={86} height={86} style={{ width: 86, height: 86, objectFit: "contain", filter: `drop-shadow(0 6px 10px rgba(0,0,0,.5))` }} />
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.ink, textAlign: "center", lineHeight: 1.2 }}>{prize.name}</span>
          <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>{prize.sub}</span>
          {/* Het lint met de zeldzaamheid. Vol verzadigd, want dit IS de beloning. */}
          <span
            style={{
              marginTop: 2, padding: "4px 12px", borderRadius: 999,
              fontFamily: font.ui, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
              color: ramp[0],
              background: `linear-gradient(180deg, ${ramp[3]} 0%, ${ramp[2]} 45%, ${ramp[1]} 100%)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,.6), 0 2px 6px rgba(0,0,0,.45), 0 0 12px ${withAlpha(rarity.accent, 0.5)}`,
            }}
          >
            {rarity.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Het steentje in de reeks onderin: dezelfde taal, klein. */
function Gem({ rarity }: { rarity: Rarity }) {
  const ramp = rampFrom(rarity.accent);
  return (
    <span
      className="neon-ring"
      style={{
        position: "relative", width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center",
        backgroundImage: [
          "linear-gradient(180deg, rgba(255,255,255,.16) 0%, transparent 22%)",
          `linear-gradient(160deg, ${ramp[2]} 0%, ${ramp[1]} 55%, ${ramp[0]} 100%)`,
        ].join(", "),
        ...neonSkin(rarity.accent),
        ["--ng-w" as string]: "1.5px",
        boxShadow: `inset 0 -4px 7px rgba(0,0,0,.45), 0 0 ${rarity.bloom / 2}px ${withAlpha(rarity.accent, 0.45)}`,
      } as React.CSSProperties}
    >
      <span style={{ width: 12, height: 12, borderRadius: 3, transform: "rotate(45deg)", background: `linear-gradient(160deg, ${ramp[3]}, ${ramp[2]})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)" }} />
    </span>
  );
}
