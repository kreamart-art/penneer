// De onderdelen die van het profiel een vitrine maken in plaats van een scherm.
//
// Het uitgangspunt: op de main page is alles GEMAAKT van iets. Goud, glas,
// geborsteld metaal. Het profiel was het enige scherm waar nog vlakke paarse
// rechthoeken stonden, en daardoor leest het als een instellingenpagina van een
// app terwijl de rest een spel is. Deze onderdelen brengen dezelfde materialen
// naar het profiel: verlooprand, korte glans, randverdonkering, en goud dat
// alleen daar zit waar iets verdiend is.
//
// Wat je hier NIET vindt: een nieuwe achtergrond. Die klopt al.
import type { CSSProperties, ReactNode } from "react";
import { colors, font, withAlpha } from "../theme/tokens";

/** De goudreeks: donker, midden, licht, fel. Rand, cijfer en gloed komen hier
 *  allemaal uit, en daarom horen ze bij elkaar. */
export const GOUD = ["#4A2E04", "#B07C17", "#FFC23D", "#FFEBB8"] as const;

/** Een sierlijn met een ruitje in het midden, zoals boven de tegels op de main
 *  page. Hij deelt het scherm in zonder een kop te hoeven zijn: een streep zegt
 *  "hier begint iets nieuws" zonder een regel tekst te kosten. */
export function GoudLijn({ label, style }: { label?: string; style?: CSSProperties }) {
  const lijn = (kant: "l" | "r"): CSSProperties => ({
    flex: 1,
    height: 1,
    background:
      kant === "l"
        ? `linear-gradient(90deg, transparent, ${withAlpha(GOUD[2], 0.55)})`
        : `linear-gradient(90deg, ${withAlpha(GOUD[2], 0.55)}, transparent)`,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, ...style }}>
      <span style={lijn("l")} />
      {label ? (
        <span
          style={{
            fontFamily: font.wide,
            fontSize: 12.5,
            letterSpacing: 1.5,
            color: colors.sub,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            transform: "rotate(45deg)",
            background: `linear-gradient(150deg, ${GOUD[3]}, ${GOUD[1]})`,
            boxShadow: `0 0 6px ${withAlpha(GOUD[2], 0.6)}`,
          }}
        />
      )}
      <span style={lijn("r")} />
    </div>
  );
}

/** Een paneel dat als voorwerp leest en niet als vlak.
 *
 *  Vier lagen, en ze hebben elk een taak. De verlooprand is een laag ERONDER
 *  die net groter is; wat eruit steekt IS de lijn, want een `border` kan geen
 *  verloop. De vulling loopt van licht bovenaan naar donker onderaan, want het
 *  licht komt van boven. De randverdonkering maakt het vlak bol in plaats van
 *  plat. En de glans is een kort streepje langs de bovenrand, niet een halve
 *  kaart die oplicht: licht is kort, anders leest het als een gekleurd vlak. */
export function Plaat({
  children,
  style,
  accent = GOUD[2],
  padding = 14,
}: {
  children: ReactNode;
  style?: CSSProperties;
  accent?: string;
  padding?: number | string;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        padding: 1.5,
        background: `linear-gradient(168deg, ${withAlpha(accent, 0.85)} 0%, ${withAlpha(accent, 0.28)} 30%, rgba(0,0,0,.45) 72%, ${withAlpha(accent, 0.4)} 100%)`,
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
            "radial-gradient(120% 90% at 50% 0%, rgba(255,243,181,.09), transparent 60%)",
            "radial-gradient(130% 110% at 50% 44%, transparent 52%, rgba(6,3,18,.5) 100%)",
            "linear-gradient(180deg, #2E1F52 0%, #241641 46%, #170D2E 100%)",
          ].join(", "),
        }}
      >
        {/* De glans: kort, alleen langs de bovenrand, en met een eigen
            begrenzing. Binnen dezelfde `background-image` zou hij die
            begrenzing met de andere lagen delen en dan loopt hij door tot de
            hoeken. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "12%",
            right: "12%",
            top: 0,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${withAlpha("#FFF3B5", 0.75)}, transparent)`,
          }}
        />
        {children}
      </div>
    </div>
  );
}

/** Een statistiek als verzamelkaartje.
 *
 *  Het getal is de held en staat dus groot en in goud; het label eronder is
 *  klein en grijs. Precies andersom als in een gewone app, waar het label
 *  leidend is. In een spel wil je het CIJFER zien: dat is wat je verzamelt. */
export function StatKaart({
  icoon,
  waarde,
  label,
  glans,
}: {
  icoon: ReactNode;
  waarde: ReactNode;
  label: string;
  /** Voor een waarde die iets zegt (een reeks, een record): dan mag hij oplichten. */
  glans?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 13,
        padding: 1,
        background: glans
          ? `linear-gradient(170deg, ${GOUD[3]} 0%, ${GOUD[1]} 45%, rgba(0,0,0,.5) 100%)`
          : `linear-gradient(170deg, ${withAlpha(GOUD[2], 0.5)} 0%, rgba(0,0,0,.4) 55%, ${withAlpha(GOUD[2], 0.22)} 100%)`,
        boxShadow: glans ? `0 0 14px ${withAlpha(GOUD[2], 0.3)}, 0 5px 12px rgba(0,0,0,.4)` : "0 5px 12px rgba(0,0,0,.35)",
      }}
    >
      <div
        style={{
          borderRadius: 12,
          padding: "9px 4px 8px",
          textAlign: "center",
          backgroundImage: [
            "radial-gradient(110% 70% at 50% 0%, rgba(255,243,181,.1), transparent 62%)",
            "linear-gradient(180deg, #2A1C4C 0%, #1B1136 100%)",
          ].join(", "),
          boxShadow: "inset 0 -6px 10px rgba(5,2,14,.45)",
        }}
      >
        <div style={{ display: "grid", placeItems: "center", height: 17, color: withAlpha(GOUD[2], 0.9) }}>{icoon}</div>
        <div
          style={{
            marginTop: 3,
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 18,
            lineHeight: 1,
            backgroundImage: `linear-gradient(168deg, ${GOUD[3]} 0%, ${GOUD[2]} 55%, ${GOUD[1]} 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {waarde}
        </div>
        <div style={{ marginTop: 3, fontFamily: font.ui, fontSize: 9.5, lineHeight: 1.15, color: colors.faint }}>{label}</div>
      </div>
    </div>
  );
}

/** Een prestatie als medaille.
 *
 *  Rond, met een gouden ring en een lint eronder. Een lijstje met vinkjes zegt
 *  "afgevinkt"; een medaille zegt "gewonnen", en dat is hetzelfde feit met een
 *  ander gevoel. Nog niet behaalde medailles staan er grijs bij, want een lege
 *  plek in een verzameling is precies wat je wilt opvullen. */
export function Medaille({ icoon, naam, behaald }: { icoon: ReactNode; naam: string; behaald: boolean }) {
  return (
    <div style={{ width: 78, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          position: "relative",
          width: 58,
          height: 58,
          borderRadius: "50%",
          padding: 2.5,
          background: behaald
            ? `linear-gradient(168deg, ${GOUD[3]} 0%, ${GOUD[2]} 34%, ${GOUD[1]} 66%, ${GOUD[0]} 100%)`
            : "linear-gradient(168deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.06) 60%, rgba(0,0,0,.4) 100%)",
          boxShadow: behaald
            ? `0 0 16px ${withAlpha(GOUD[2], 0.35)}, 0 6px 14px rgba(0,0,0,.45)`
            : "0 4px 10px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: behaald ? GOUD[3] : withAlpha(colors.faint, 0.8),
            backgroundImage: [
              "radial-gradient(80% 60% at 50% 12%, rgba(255,243,181,.18), transparent 66%)",
              behaald
                ? "linear-gradient(180deg, #3A2352 0%, #1E1136 100%)"
                : "linear-gradient(180deg, #241B3C 0%, #171029 100%)",
            ].join(", "),
            boxShadow: "inset 0 -7px 12px rgba(5,2,14,.5)",
            opacity: behaald ? 1 : 0.65,
          }}
        >
          {icoon}
        </div>
      </div>
      <span
        style={{
          fontFamily: font.ui,
          fontSize: 9.5,
          lineHeight: 1.2,
          textAlign: "center",
          color: behaald ? colors.sub : colors.faint,
          opacity: behaald ? 1 : 0.7,
        }}
      >
        {naam}
      </span>
    </div>
  );
}

/** De plaatsing van een potje als penning. Goud voor de eerste, zilver en brons
 *  daarna, en daarna gewoon een cijfer: alleen het podium verdient metaal. */
export function Plek({ plek }: { plek: number }) {
  const metaal =
    plek === 1
      ? ["#FFEBB8", "#FFC23D", "#B07C17"]
      : plek === 2
        ? ["#F2F5FA", "#C3CBD8", "#7C8698"]
        : plek === 3
          ? ["#F3C69A", "#CE8B4E", "#8A5325"]
          : null;
  return (
    <span
      style={{
        width: 30,
        height: 30,
        flexShrink: 0,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: 13,
        color: metaal ? "#2A1802" : colors.sub,
        background: metaal
          ? `linear-gradient(160deg, ${metaal[0]} 0%, ${metaal[1]} 46%, ${metaal[2]} 100%)`
          : "rgba(0,0,0,.28)",
        boxShadow: metaal
          ? `0 0 0 1.4px rgba(0,0,0,.35), 0 3px 7px rgba(0,0,0,.45), inset 0 1.5px 0 rgba(255,255,255,.55)`
          : "inset 0 0 0 1px rgba(255,255,255,.1)",
        textShadow: metaal ? "0 1px 0 rgba(255,240,190,.5)" : "none",
      }}
    >
      {plek}
    </span>
  );
}
