// Het arena-decor: de plaat met het gloeiende podium, op een ondergrond in de
// kleuren van die plaat zelf. Gedeeld door Duel en het gewone potje, zodat die
// twee schermen op hetzelfde toneel spelen.
//
// De plaat is boven en onder doorzichtig gemaakt, dus wat eronder ligt moet
// exact die randkleuren hebben, anders zie je een naad. Deze waarden zijn uit
// de platen gemeten en komen uit het Duel-palet: donkerste achtergrond #09002C,
// donker paars #170150, midden paars #360287.
//
// Het podium zit op een bekende fractie van de plaathoogte (gemeten: de
// helderste beeldrij). Door de plaat precies die fractie omhoog te schuiven
// landt het podium op de lijn die je kiest, op elk schermformaat. En omdat de
// randen vervagen maakt het niet uit als dat er een paar pixels naast zit.
import { useEffect, useRef, useState } from "react";
import { withAlpha } from "../theme/tokens";

export const ARENA = {
  base: "#09002C",   // donkerste achtergrond, gelijk aan de bovenrand van de plaat
  deep: "#0D0134",
  mid: "#10013B",    // de onderrand van de plaat
  glow: "#360287",   // midden paars, alleen als zachte lichtspreiding
} as const;

export function Arena({
  src,
  /** Waar het podium in de PLAAT zit, als fractie van de plaathoogte. */
  podium,
  /** Waar het podium op het SCHERM moet komen. */
  at,
  /** Hoe breed de plaat wordt getekend, als deel van de schermbreedte. */
  width = "205%",
  /** Waar de lichtspreiding zijn kern heeft. */
  glowAt = "46%",
  /** `fill` laat de plaat het hele scherm vullen (object-fit: cover) in plaats
   *  van als losse band met vervaagde randen te liggen. Dan bepaalt de plaat
   *  zelf waar het podium uitkomt, en `podium`/`at`/`width` doen niets meer. */
  fill = false,
  /** Uit: alleen de ondergrond en het vignet, geen plaat. Voor schermen die de
   *  plaat zelf ergens anders ophangen (zie ArenaPlate). */
  plate = true,
}: {
  src: string;
  podium: number;
  at: string;
  width?: string;
  glowAt?: string;
  fill?: boolean;
  plate?: boolean;
}) {
  const [art, setArt] = useState(true);
  const layer = useRef<HTMLDivElement | null>(null);

  // Het decor volgt het ZICHTBARE deel van het scherm, niet de pagina.
  //
  // Op iOS maakt het toetsenbord de pagina niet kleiner; Safari schuift hem
  // omhoog zodat het invoerveld in beeld komt. Een laag met `position: fixed`
  // hangt aan de PAGINA, dus die schuift mee naar boven en laat onderin een
  // strook onbedekt: dan valt het decor rond de letter weg en zie je de kale
  // achtergrond. `visualViewport` vertelt precies welk stuk je nog ziet, dus
  // daar leggen we de laag overheen. Zonder toetsenbord verandert er niets.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = layer.current;
    if (!vv || !el) return;
    const sync = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return (
    <div ref={layer} aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Dekkende ondergrond in het palet van de plaat: dekt de app-gradient af. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${ARENA.base} 0%, ${ARENA.base} 16%, ${ARENA.deep} 44%, ${ARENA.mid} 68%, ${ARENA.deep} 86%, ${ARENA.base} 100%)`,
        }}
      />
      {/* Zachte lichtspreiding rond het podium, zodat de overgang van plaat naar
          ondergrond als licht leest en niet als een rand. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(80% 40% at 50% ${glowAt}, ${withAlpha(ARENA.glow, 0.4)} 0%, transparent 70%)`,
        }}
      />
      {plate && art && (
        <img
          src={src}
          alt=""
          onError={() => setArt(false)}
          style={
            fill
              ? {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  maxWidth: "none",
                  objectFit: "cover",
                  // Staand is de hoogte de krappe kant, dus de hele plaat is in
                  // beeld en het podium landt vanzelf op zijn eigen fractie; de
                  // zijkanten worden bijgesneden.
                  objectPosition: "50% 50%",
                }
              : {
                  position: "absolute",
                  left: "50%",
                  top: at,
                  width,
                  maxWidth: "none",   // de reset knipt afbeeldingen anders terug naar schermbreedte
                  transform: `translate(-50%, -${podium * 100}%)`,
                }
          }
        />
      )}
      {/* Vignet: houdt de aandacht in het midden en dempt de randen. */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(125% 70% at 50% 40%, transparent 30%, ${withAlpha(ARENA.base, 0.62)} 100%)` }} />
    </div>
  );
}

/** De plaat, opgehangen aan het element waar hij omheen hoort in plaats van aan
 *  het scherm.
 *
 *  Waarom dat uitmaakt: het podium moet onder de letter staan, en dat is een
 *  verhouding van de KAART. Hang je hem aan het scherm, dan schuift hij zodra
 *  het toetsenbord opengaat, want dan verandert het scherm wel en de kaart niet.
 *
 *  De plaat is breder dan zijn ouder en steekt er dus buiten. Dat is de bedoeling:
 *  zo dekt hij nog steeds het hele beeld. Zet hem in een ouder met
 *  `position: relative` en geef de inhoud daarvan `position: relative` mee,
 *  anders verdwijnt die eronder. */
export function ArenaPlate({
  src,
  /** Waar het podium in de PLAAT zit, als fractie van de plaathoogte. */
  podium,
  /** Waar het podium in de OUDER moet komen. */
  at,
  /** Hoe breed de plaat wordt getekend, als deel van de ouderbreedte. */
  width = "205%",
}: {
  src: string;
  podium: number;
  at: string;
  width?: string;
}) {
  const [art, setArt] = useState(true);
  if (!art) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => setArt(false)}
      style={{
        position: "absolute",
        left: "50%",
        top: at,
        width,
        maxWidth: "none",   // de reset knipt afbeeldingen anders terug
        transform: `translate(-50%, -${podium * 100}%)`,
        pointerEvents: "none",
        // Achter alles wat eromheen staat. De ouder maakt zelf geen stapelcontext
        // (geen z-index), dus de plaat zakt door tot achter de buren van die
        // ouder: de rondjes en de klok erboven blijven zichtbaar.
        zIndex: -1,
      }}
    />
  );
}
