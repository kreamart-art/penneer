// Een pack openscheuren en de kaart eruit halen.
//
// DE SCHEUR IS ECHTE ART en geen css-truc: het pack in de animatie kreukt,
// buigt en licht van binnenuit op, en dat krijg je met twee helften die je uit
// elkaar draait nooit voor elkaar. Vierentwintig frames uit de bronvideo staan
// naast elkaar in EEN strip (public/ui/dag/pack-open.webp) en die schuift met
// `background-position` langs een venster ter grootte van een frame.
//
// STAPPEN IN PLAATS VAN EEN VLOEIENDE OVERGANG. `steps(24)` springt van frame
// naar frame; een gewone overgang zou tussen twee frames in blijven staan en
// dan zie je een halve scheur die nergens op slaat.
//
// HET GROEN IS ERUIT GESLEUTELD op "groen duidelijk boven rood en blauw", met
// een zachte rand zodat er geen getrapte lijn overblijft, en met het groen van
// de randpixels teruggebracht tot hoogstens het gemiddelde van rood en blauw.
// Zonder die tweede stap houd je een groene zoom om het goud.
//
// DE KAART KOMT VAN PIEPKLEIN NAAR GROOT, en met opzet niet lineair: hij schiet
// een klein stukje voorbij zijn eindmaat en zakt dan terug. Dat laatste stukje
// is wat het gevoel geeft dat er iets uit het pack GEDUWD wordt in plaats van
// dat er een plaatje groter wordt.
//
// DE GLOED IS EEN EIGEN LAAG achter de kaart, want hij hoort bij het moment en
// niet bij het pack: hij zwelt op terwijl de kaart nog klein is en dooft als de
// kaart er eenmaal staat. Zo kijk je eerst naar het licht en dan pas naar wat
// eruit komt.
import { useEffect, useRef, useState } from "react";
import { colors, font, withAlpha } from "../theme/tokens";

/** Hoeveel frames er in de strip staan. Moet kloppen met het bestand. */
const FRAMES = 24;
/** Hoe lang het scheuren duurt. */
const SCHEUR_MS = 1150;
/** Wanneer de gloed begint, gerekend vanaf het begin van het scheuren. */
const GLOED_NA = 620;
/** Wanneer de kaart begint te groeien. */
const KAART_NA = 900;

type Fase = "dicht" | "scheurt" | "kaart" | "klaar";

export function PackOpenen({
  kaartArt = "/ui/dag/kaart-voor.webp",
  titel,
  onderschrift,
  knop,
  knopKlaar,
  onKlaar,
}: {
  /** De kaart die je krijgt. */
  kaartArt?: string;
  titel: string;
  onderschrift?: string;
  /** Wat er op de knop staat zolang het pack dicht is. */
  knop: string;
  /** En wat erop staat als de kaart er ligt. Dezelfde knop, want een tweede
   *  knop op dezelfde plek zou de eerste alleen maar verschuiven. */
  knopKlaar: string;
  onKlaar: () => void;
}) {
  const [fase, setFase] = useState<Fase>("dicht");
  const klokken = useRef<number[]>([]);

  useEffect(() => () => klokken.current.forEach(window.clearTimeout), []);

  const openen = () => {
    if (fase !== "dicht") return;
    navigator.vibrate?.([8, 60, 14]);
    setFase("scheurt");
    klokken.current.push(window.setTimeout(() => setFase("kaart"), KAART_NA));
    klokken.current.push(window.setTimeout(() => setFase("klaar"), KAART_NA + 900));
  };

  const bezig = fase !== "dicht";
  const kaartUit = fase === "kaart" || fase === "klaar";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "radial-gradient(circle at 50% 42%, rgba(46,18,86,.94), rgba(6,3,16,.97) 70%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, padding: 24,
      }}
    >
      {/* Het toneel: gloed, pack en kaart liggen op elkaar, allemaal om hetzelfde
          midden. Zo komt de kaart uit de scheur en niet ergens ernaast. */}
      <div style={{ position: "relative", width: 230, height: 288, display: "grid", placeItems: "center" }}>
        {/* DE GLOED, EEN laag. Hier stond ook een smalle witte kolom, maar die
            deed over wat de art zelf al doet: in de bronvideo komt het licht als
            een streep uit de scheur. Twee keer dezelfde streep leest als een
            fout in het beeld. Wat overblijft is de halo eromheen, en die zit
            niet in de art. */}
        <span
          aria-hidden
          className={bezig ? "pack-gloed" : undefined}
          style={{
            position: "absolute", left: "50%", top: "50%", width: 420, height: 420,
            transform: "translate(-50%,-50%)", borderRadius: "50%", opacity: 0,
            // EEN WITTE KERN met een staart die tot NIETS loopt. Het hart is
            // echt wit en niet creme: daar komt het licht vandaan, en een
            // gebroken wit leest als een gele vlek in plaats van als licht.
            //
            // VEEL STOPS EN TOT 100 PROCENT. Met een handvol stops die op
            // tachtig procent eindigen zie je twee dingen die er niet horen: de
            // ringen tussen de stops, en de rand van de cirkel zelf, want daar
            // springt hij ineens van iets naar niets. De stops volgen hier een
            // derdemachtsafname (elke stap ongeveer de helft van de vorige) en
            // de laatste staat op de rand van het vlak.
            //
            // En er gaat een VERVAGING overheen. Een verloop wordt in stappen
            // van een 256e uitgerekend, en bij zulke lage waarden zie je die
            // stappen als ringen; de vervaging smeert ze weg. Dat mag hier
            // gerust ruim, want er staat geen vorm in die scherp hoort te zijn.
            filter: "blur(14px)",
            background: [
              "radial-gradient(circle,",
              "rgba(255,255,255,.95) 0%,",
              "rgba(255,255,255,.78) 6%,",
              "rgba(255,252,240,.55) 12%,",
              "rgba(255,242,205,.36) 20%,",
              "rgba(255,228,158,.22) 30%,",
              "rgba(255,214,120,.13) 42%,",
              "rgba(255,203,98,.07) 55%,",
              "rgba(255,193,80,.032) 70%,",
              "rgba(255,186,68,.012) 85%,",
              "rgba(255,180,60,0) 100%)",
            ].join(" "),
            animationDelay: `${GLOED_NA}ms`, pointerEvents: "none",
          }}
        />

        {/* HET PACK. Dicht staat hij op frame 0 en wipt hij zachtjes, zodat je
            ziet dat er iets mee kan. */}
        <button
          type="button"
          onClick={openen}
          disabled={bezig}
          aria-label={knop}
          className={fase === "dicht" ? "pack-wipt" : undefined}
          style={{
            position: "absolute", width: 230, height: 288,
            border: "none", padding: 0, background: "transparent",
            cursor: bezig ? "default" : "pointer",
            backgroundImage: "url(/ui/dag/pack-open.webp)",
            backgroundSize: `${FRAMES * 100}% 100%`,
            backgroundPosition: "0% 0%",
            backgroundRepeat: "no-repeat",
            animation: bezig ? `pack-scheurt ${SCHEUR_MS}ms steps(${FRAMES - 1}) forwards` : undefined,
            opacity: fase === "klaar" ? 0 : 1,
            transition: "opacity 420ms ease",
            filter: `drop-shadow(0 ${bezig ? 10 : 14}px ${bezig ? 18 : 22}px rgba(0,0,0,.55))`,
          }}
        />

        {/* DE KAART. Groeit van bijna niets naar zijn maat, met een zetje
            voorbij het eind. */}
        <img
          src={kaartArt}
          alt=""
          aria-hidden
          draggable={false}
          className={kaartUit ? "pack-kaart" : undefined}
          style={{
            position: "absolute", height: 268, width: "auto", display: "block",
            opacity: kaartUit ? undefined : 0, pointerEvents: "none",
            filter: "drop-shadow(0 14px 26px rgba(0,0,0,.6))",
          }}
        />
      </div>

      <span
        style={{
          fontFamily: font.wide, fontWeight: 700, fontSize: 19, letterSpacing: 1.2, marginRight: -1.2,
          textTransform: "uppercase", color: "#FFF3D0", textAlign: "center",
          textShadow: `0 0 14px ${withAlpha(colors.gold, 0.5)}, 0 2px 5px rgba(0,0,0,.7)`,
          opacity: fase === "klaar" ? 1 : 0, transition: "opacity 380ms ease 120ms",
        }}
      >
        {titel}
      </span>
      {!!onderschrift && (
        <span
          style={{
            fontFamily: font.ui, fontSize: 13.5, color: "rgba(238,231,255,.82)", textAlign: "center",
            marginTop: -10, opacity: fase === "klaar" ? 1 : 0, transition: "opacity 380ms ease 200ms",
          }}
        >
          {onderschrift}
        </span>
      )}

      <button
        type="button"
        onClick={fase === "klaar" ? onKlaar : openen}
        className="pressable"
        style={{
          marginTop: 6, minWidth: 190, padding: "13px 26px", borderRadius: 999,
          border: "none", cursor: "pointer",
          background: "linear-gradient(180deg, #FFE08A, #F2AC22 55%, #C97A0B)",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.6), 0 8px 20px ${withAlpha(colors.gold, 0.35)}`,
          fontFamily: font.wide, fontWeight: 700, fontSize: 15, letterSpacing: 1.1, marginRight: -1.1,
          textTransform: "uppercase", color: "#2A1603",
          opacity: fase === "dicht" || fase === "klaar" ? 1 : 0.35,
          transition: "opacity 300ms ease",
        }}
        disabled={fase === "scheurt" || fase === "kaart"}
      >
        {fase === "klaar" ? knopKlaar : knop}
      </button>
    </div>
  );
}
