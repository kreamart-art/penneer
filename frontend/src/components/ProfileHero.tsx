// De vitrine-onderdelen van het profiel, naar de mockup.
//
// De opzet: bovenaan een heldenkaart die in een oogopslag zegt wie je bent en
// hoe ver je bent, daaronder je cijfers, dan je laatste potjes, dan je
// medaillekast. Het oog loopt van persoon naar voortgang naar bewijs.
//
// Materiaal boven versiering. Elk paneel heeft dezelfde opbouw als de tegels op
// de main page: een verlooprand als aparte laag eronder (een `border` kan geen
// verloop), een vulling die van licht naar donker loopt omdat het licht van
// boven komt, randverdonkering zodat het vlak bol leest, en een kort glansje.
// De gouden hoekjes zijn geen plaatjes maar vier kleine haakjes; zo schalen ze
// mee en kosten ze niets.
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight, Check, Lock } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";

export const GOUD = ["#4A2E04", "#B07C17", "#FFC23D", "#FFEBB8"] as const;

const goudVlak = `linear-gradient(160deg, ${GOUD[3]} 0%, ${GOUD[2]} 38%, ${GOUD[1]} 72%, ${GOUD[0]} 100%)`;

/** Vier gouden haakjes in de hoeken van een paneel. Ze maken van een rechthoek
 *  een gesmeed ding, en anders dan een doorlopende rand trekken ze de aandacht
 *  naar de hoeken in plaats van naar de omtrek. */
function Hoeken({ maat = 14, dik = 2.5 }: { maat?: number; dik?: number }) {
  const arm = (s: CSSProperties): CSSProperties => ({
    position: "absolute",
    background: goudVlak,
    borderRadius: 1,
    ...s,
  });
  const hoek = (v: CSSProperties, h1: CSSProperties, h2: CSSProperties) => (
    <span aria-hidden style={{ position: "absolute", ...v }}>
      <span style={arm(h1)} />
      <span style={arm(h2)} />
    </span>
  );
  return (
    <>
      {hoek({ left: 5, top: 5 }, { width: maat, height: dik }, { width: dik, height: maat })}
      {hoek({ right: 5, top: 5 }, { width: maat, height: dik, right: 0 }, { width: dik, height: maat, right: 0 })}
      {hoek({ left: 5, bottom: 5 }, { width: maat, height: dik, bottom: 0 }, { width: dik, height: maat, bottom: 0 })}
      {hoek({ right: 5, bottom: 5 }, { width: maat, height: dik, right: 0, bottom: 0 }, { width: dik, height: maat, right: 0, bottom: 0 })}
    </>
  );
}

/** Een paneel dat als voorwerp leest. Zie de toelichting bovenaan dit bestand. */
export function Paneel({
  children,
  style,
  padding = 14,
  hoeken = true,
  accent = GOUD[2],
}: {
  children: ReactNode;
  style?: CSSProperties;
  padding?: number | string;
  hoeken?: boolean;
  accent?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        padding: 1.5,
        background: `linear-gradient(168deg, ${withAlpha(accent, 0.8)} 0%, ${withAlpha(accent, 0.25)} 32%, rgba(0,0,0,.5) 70%, ${withAlpha(accent, 0.38)} 100%)`,
        boxShadow: "0 14px 30px rgba(0,0,0,.45), 0 3px 8px rgba(0,0,0,.3)",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 16.5,
          padding,
          overflow: "hidden",
          backgroundImage: [
            "radial-gradient(120% 90% at 50% 0%, rgba(255,243,181,.08), transparent 62%)",
            "radial-gradient(130% 110% at 50% 44%, transparent 50%, rgba(6,3,18,.55) 100%)",
            "linear-gradient(180deg, #2E1F52 0%, #241641 46%, #170D2E 100%)",
          ].join(", "),
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "14%",
            right: "14%",
            top: 0,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${withAlpha("#FFF3B5", 0.7)}, transparent)`,
          }}
        />
        {hoeken && <Hoeken />}
        {children}
      </div>
    </div>
  );
}

/** Sierlijn met een ruitje aan weerszijden van het opschrift. */
export function SierKop({ label }: { label: string }) {
  const lijn = (naar: string): CSSProperties => ({
    flex: 1,
    height: 1,
    background: `linear-gradient(${naar}, transparent, ${withAlpha(GOUD[2], 0.5)})`,
  });
  const ruit = (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        flexShrink: 0,
        transform: "rotate(45deg)",
        background: goudVlak,
        boxShadow: `0 0 6px ${withAlpha(GOUD[2], 0.55)}`,
      }}
    />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={lijn("90deg")} />
      {ruit}
      <span style={{ fontFamily: font.wide, fontSize: 14, letterSpacing: 1.8, color: colors.ink, whiteSpace: "nowrap" }}>
        {label}
      </span>
      {ruit}
      <span style={{ ...lijn("270deg") }} />
    </div>
  );
}

/** Kop van een sectie met een doorverwijzing rechts. */
export function SectieKop({ label, actie, onActie }: { label: string; actie?: string; onActie?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1, fontFamily: font.wide, fontSize: 15, letterSpacing: 1.4, color: colors.ink }}>{label}</span>
      {actie && (
        <button
          onClick={onActie}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: font.ui,
            fontSize: 12.5,
            color: colors.sub,
          }}
        >
          {actie}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/** Een statistiek als kaartje: teken boven, groot getal in goud, label eronder.
 *  Het getal is de held; in een spel wil je het CIJFER zien, want dat is wat je
 *  verzamelt. In een app zou het label leiden.
 *
 *  De lijst is echte art (`/ui/stat-frame.webp`) en geen getekende rand, en ze
 *  ligt er als `border-image` op. Dat is de enige manier waarop de gesmede
 *  hoeken hun maat houden terwijl de zijkanten meerekken: een gewone
 *  achtergrond zou het hele plaatje uitrekken en dan worden de hoekstenen
 *  ovaal. De snede is 70 van de 429 pixels, precies tot voorbij de hoeksteen. */
export function StatKaart({ icoon, art, waarde, label }: { icoon: ReactNode; art?: string; waarde: ReactNode; label: string }) {
  return (
    <div
      style={{
        // De lijst is vierkant getekend, dus het kaartje is vierkant. Zonder
        // deze verhouding bepaalt de inhoud de hoogte en dan trekt de rand met
        // de tekst mee scheef.
        position: "relative",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        boxSizing: "border-box",
        textAlign: "center",
        borderStyle: "solid",
        borderWidth: 9,
        borderImage: "url(/ui/stat-frame.webp) 70 fill stretch",
        filter: "drop-shadow(0 4px 9px rgba(0,0,0,.45))",
      }}
    >
      {art ? (
        <img src={art} alt="" aria-hidden style={{ width: 19, height: 19, objectFit: "contain", flexShrink: 0 }} />
      ) : (
        <span style={{ color: GOUD[2], height: 19, display: "grid", placeItems: "center", flexShrink: 0 }}>{icoon}</span>
      )}
      {/* Het cijfer is wit en niet goud: het goud zit al in de lijst en in het
          teken, dus een derde gouden ding maakt het kaartje één brij. Wit is
          hier het felste wat er is en trekt het oog dus vanzelf naar het
          getal, precies waar het hoort. */}
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: 22,
          lineHeight: 1,
          color: "#FFFFFF",
          textShadow: "0 2px 4px rgba(0,0,0,.55)",
        }}
      >
        {waarde}
      </div>
      <div style={{ fontFamily: font.ui, fontWeight: 500, fontSize: 9.5, lineHeight: 1.15, color: withAlpha("#FFFFFF", 0.92) }}>{label}</div>
    </div>
  );
}

/** De plaatsingspenning links in een potje-rij. Goud voor de eerste plek, zilver
 *  en brons daarna, en daarna paars: alleen het podium verdient metaal. */
export function PlekWapen({ plek }: { plek: number }) {
  const metaal =
    plek === 1
      ? [GOUD[3], GOUD[2], GOUD[1]]
      : plek === 2
        ? ["#EDE6FF", "#B9A6E8", "#6E5AA8"]
        : plek === 3
          ? ["#F3C69A", "#CE8B4E", "#8A5325"]
          : null;
  return (
    <span
      style={{
        width: 44,
        height: 46,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        // Een wapenschild: recht van boven, punt naar beneden.
        clipPath: "polygon(0% 0%, 100% 0%, 100% 72%, 50% 100%, 0% 72%)",
        background: metaal
          ? `linear-gradient(162deg, ${metaal[0]} 0%, ${metaal[1]} 45%, ${metaal[2]} 100%)`
          : "linear-gradient(162deg, rgba(255,255,255,.2), rgba(0,0,0,.4))",
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: 15,
        color: plek === 1 ? "#3A2500" : plek === 2 ? "#241640" : plek === 3 ? "#3A1C05" : colors.sub,
        textShadow: metaal ? "0 1px 0 rgba(255,255,255,.4)" : "none",
      }}
    >
      {plek}e
    </span>
  );
}

/** Een prestatie als zeshoekige penning. Behaald is goud met een vinkje, nog te
 *  halen is grijs met een slot; met een teller eronder als er iets te tellen
 *  valt. Een lege plek in een verzameling is precies wat je wilt opvullen. */
export function Prestatie({
  icoon,
  art,
  naam,
  behaald,
  nu,
  doel,
}: {
  icoon: ReactNode;
  /** Eigen art voor deze penning. Bestaat het bestand niet, dan haalt hij
   *  zichzelf weg en blijft het getekende teken eronder staan. Zo is nieuwe art
   *  neerzetten genoeg: er hoeft geen lijst bijgehouden te worden van welke
   *  badges al een plaatje hebben en welke nog niet. */
  art?: string;
  naam: string;
  behaald: boolean;
  nu?: number;
  doel?: number;
}) {
  const HEX = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  const deel = doel && doel > 0 ? Math.min(1, (nu ?? 0) / doel) : 0;
  return (
    <div style={{ width: 84, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: 66, height: 72 }}>
        {art ? (
          // Eigen art brengt zijn eigen lijst mee, dus de getekende zeshoek gaat
          // eruit: twee randen om hetzelfde vlak leest als een fout. Nog niet
          // verdiend is dezelfde penning in grijs, zodat je ziet WAT je mist en
          // niet alleen DAT je iets mist.
          <img
            src={art}
            alt=""
            aria-hidden
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              // Grijs maken op een DONKERE achtergrond betekent lichter maken,
              // niet donkerder: verzadiging eraf en helderheid omhoog, anders
              // verdwijnt de vorm in de achtergrond en zie je alleen een vlek.
              filter: behaald ? "drop-shadow(0 3px 7px rgba(0,0,0,.5))" : "grayscale(1) brightness(1.5) contrast(.75)",
              opacity: behaald ? 1 : 0.4,
            }}
          />
        ) : (
          <>
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                clipPath: HEX,
                background: behaald ? goudVlak : "linear-gradient(160deg, #8E8AA0 0%, #5C5870 48%, #35324A 100%)",
                filter: behaald ? `drop-shadow(0 0 8px ${withAlpha(GOUD[2], 0.35)})` : "none",
              }}
            />
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 4,
                clipPath: HEX,
                display: "grid",
                placeItems: "center",
                backgroundImage: behaald
                  ? "radial-gradient(80% 60% at 50% 14%, rgba(255,243,181,.2), transparent 66%), linear-gradient(180deg, #4A2A78 0%, #24123F 100%)"
                  : "linear-gradient(180deg, #2C2740 0%, #1A172A 100%)",
                boxShadow: "inset 0 -8px 14px rgba(5,2,14,.5)",
                color: behaald ? GOUD[3] : withAlpha(colors.faint, 0.9),
              }}
            >
              {icoon}
            </span>
          </>
        )}
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 10, lineHeight: 1.2, textAlign: "center", color: behaald ? colors.ink : colors.faint }}>
        {naam}
      </span>
      {behaald ? (
        <span
          style={{
            width: 17,
            height: 17,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(160deg, #6BE39A, #1F9E58)",
            color: "#04240F",
          }}
        >
          <Check size={11} strokeWidth={3.2} />
        </span>
      ) : doel ? (
        <span style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontFamily: font.ui, fontSize: 9.5, color: colors.faint }}>
            {nu ?? 0} / {doel}
          </span>
          <span style={{ width: "78%", height: 3, borderRadius: 999, background: "rgba(0,0,0,.45)", overflow: "hidden" }}>
            <span style={{ display: "block", width: `${deel * 100}%`, height: "100%", background: `linear-gradient(90deg, ${GOUD[1]}, ${GOUD[2]})` }} />
          </span>
        </span>
      ) : (
        <Lock size={12} color={colors.faint} />
      )}
    </div>
  );
}
