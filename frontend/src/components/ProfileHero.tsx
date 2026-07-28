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
import { useEffect, useId, useRef, useState } from "react";
import { chamferPath } from "../theme/reelSkins";
import { ChevronRight, Check, Lock } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";
import { HexArt } from "./HexArt";


export const GOUD = ["#4A2E04", "#B07C17", "#FFC23D", "#FFEBB8"] as const;

const goudVlak = `linear-gradient(160deg, ${GOUD[3]} 0%, ${GOUD[2]} 38%, ${GOUD[1]} 72%, ${GOUD[0]} 100%)`;

/** Het paneel van de heldenkaart: de art uit de UI-map, ongeknipt en onvervormd.
 *
 *  De verhouding staat vast op die van het bestand (3835 op 2289). Daardoor
 *  wordt er niets uitgerekt en blijven de hoekstenen en de ruit precies zoals ze
 *  getekend zijn. De prijs is dat de INHOUD zich naar het paneel moet voegen en
 *  niet andersom: het is een breed vlak, dus de indeling is breed. Vandaar het
 *  portret links en alles wat je over jezelf leest rechts.
 *
 *  De randen in procenten, gemeten aan de art zelf: de lijst is 2% van de
 *  breedte, 6,3% van de hoogte bovenaan (daar steekt de ruit doorheen) en 4,2%
 *  onderaan. Er zit wat lucht bij opgeteld zodat tekst niet tegen goud plakt. */
export const PANEEL_VERHOUDING = 3835 / 2289;

export function Paneel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: `${3835} / ${2289}`,
        backgroundImage: "url(/ui/profile-frame.webp)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 12px 26px rgba(0,0,0,.5))",
        ...style,
      }}
    >
      {/* De inhoud ligt er als LOSSE laag overheen en zit niet in de doos.
          Twee redenen, allebei een keer misgegaan:
          1. Met padding groeit het paneel mee zodra de inhoud een haar te hoog
             is, en dan rekt de art alsnog uit. Zo werd de sectie op een echte
             telefoon langer dan hier.
          2. Procentuele PADDING rekent boven en onder met de BREEDTE, maar
             `top` en `bottom` rekenen met de HOOGTE. De randen die ik aan de
             art heb gemeten zijn hoogtes, dus alleen zo kloppen ze. */}
      <div style={{ position: "absolute", top: "8.6%", left: "5%", right: "5%", bottom: "4.9%" }}>
        {children}
      </div>
    </div>
  );
}

/** Het portret in de gouden ring, met het level op een schild eronder.
 *
 *  Alle maten komen uit de art zelf, gemeten aan de bestanden, en staan in
 *  verhoudingen in plaats van vaste pixels. Zo klopt het op elk formaat en hoeft
 *  er niets bijgesteld te worden als de ring straks groter of kleiner moet:
 *
 *    ring     720 op 708, het gat is 68,8% van de breedte en het midden van dat
 *             gat ligt op 49,9% / 44,1% (dus iets boven het midden, want de
 *             lauwertak onderaan hoort bij de ring en niet bij het gat).
 *    schild   821 op 972.
 *
 *  De percentages staan met opzet niet in CSS maar worden hier uitgerekend: in
 *  CSS rekent `top` in procenten met de HOOGTE en `left` met de BREEDTE, en dan
 *  klopt één paar getallen nooit voor allebei de assen. */
const RING_VERH = 708 / 720;
const RING_GAT = 0.688;
const RING_GAT_X = 0.499;
const RING_GAT_Y = 0.441;
const SCHILD_VERH = 972 / 821;

export const SCHILD_KLEUREN = ["paars", "blauw", "lichtblauw", "groen", "rood", "zwart", "zilver"] as const;
export type SchildKleur = (typeof SCHILD_KLEUREN)[number];

export function RingPortret({
  maat,
  level,
  kleur = "paars",
  onSchild,
  children,
}: {
  /** De breedte van de ring. De rest volgt daaruit. */
  maat: number;
  level: number;
  kleur?: SchildKleur;
  /** Tikken op het schild: opent de kleurkiezer. Zonder deze is het geen knop. */
  onSchild?: () => void;
  children: ReactNode;
}) {
  const ringH = maat * RING_VERH;
  const gat = maat * RING_GAT;
  const schildB = maat * 0.24;
  const schildH = schildB * SCHILD_VERH;
  // Het schild zit op de ONDERRAND VAN HET PORTRET, niet onder de hele ring:
  // zijn hart ligt precies waar het gat ophoudt, zodat hij half over de foto en
  // half over de gouden band valt. Hing hij onder de lauwertak, dan bungelde
  // hij los van het geheel.
  const gatOnder = ringH * RING_GAT_Y + gat / 2;
  const schildTop = gatOnder - schildH * 0.22;
  return (
    <div style={{ position: "relative", width: maat, height: Math.max(ringH, schildTop + schildH), flexShrink: 0 }}>
      {/* Het portret eerst, de ring erbovenop. Zo dekt de ring een randje van
          het portret af en zie je geen naad tussen de twee. */}
      <span
        style={{
          position: "absolute",
          left: maat * RING_GAT_X - gat / 2,
          top: ringH * RING_GAT_Y - gat / 2,
          width: gat,
          height: gat,
          borderRadius: "50%",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          background: "#140B26",
        }}
      >
        {children}
      </span>
      <img src="/ui/ring.webp" alt="" aria-hidden style={{ position: "absolute", left: 0, top: 0, width: maat, height: ringH, pointerEvents: "none" }} />
      <span
        onClick={onSchild ? (e) => { e.stopPropagation(); onSchild(); } : undefined}
        role={onSchild ? "button" : undefined}
        style={{
          position: "absolute",
          left: maat / 2 - schildB / 2,
          top: schildTop,
          width: schildB,
          height: schildH,
          cursor: onSchild ? "pointer" : undefined,
        }}
      >
        <img src={`/ui/shield/${kleur}.webp`} alt="" aria-hidden style={{ width: "100%", height: "100%", display: "block" }} />
        {/* Het schild loopt onderin in een punt, dus het cijfer staat hoger dan
            het midden van de doos; anders lijkt het te laag te hangen. */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            paddingBottom: schildH * 0.16,
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: schildB * 0.5,
            lineHeight: 1,
            color: "#FFFFFF",
            textShadow: "0 1px 3px rgba(20,4,40,.8)",
          }}
        >
          {level}
        </span>
      </span>
    </div>
  );
}

/** Het portret zelf, passend in de ring: rond en tot de rand gevuld.
 *
 *  Niet de gewone `Avatar`, want die is een afgeronde VIERKANT met een eigen
 *  rand en een gekleurde vulling eromheen. In een rond gat zie je die vulling
 *  als een ring om de foto, en dat is precies de "badge" die er hier niet hoort:
 *  de gouden ring IS al de omlijsting. */
export function RingFoto({ userId, versie, heeftFoto, naam, kleur }: { userId: string; versie: number; heeftFoto: boolean; naam: string; kleur: string }) {
  if (heeftFoto) {
    return (
      <img
        src={`/api/avatar/${userId}?v=${versie}`}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <span
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: `radial-gradient(120% 100% at 50% 0%, ${withAlpha(kleur, 0.55)}, ${withAlpha(kleur, 0.16)} 70%, rgba(0,0,0,.35) 100%)`,
        fontFamily: font.display,
        fontWeight: 800,
        fontSize: "42%",
        color: "#FFFFFF",
      }}
    >
      {(naam.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

/** De lijst om een rij, laag voor laag naar de referentie.
 *
 *  Elke laag doet EEN ding en is los te regelen. Eén rand of één box-shadow die
 *  alles tegelijk moet doen komt er niet in de buurt: dan kun je de gloed niet
 *  anders sturen dan de lijn, en de bovenrand niet anders dan de onderrand.
 *
 *  Van achter naar voren:
 *    1. buitengloed   violet, strak om de vorm, plus een gewone schaduw eronder
 *    2. paneel        donker en doorschijnend, zodat de nevel erachter meedoet
 *    3. hoeklicht     warm, linksboven, want daar komt het licht vandaan
 *    4. de lijn       een haarlijn als RING, geknipt met een masker
 *    5. binnenglans   een wit streepje net binnen de bovenrand, kort
 *
 *  Blurwaarden: een ontwerpprogramma noemt 22, CSS rekent met de
 *  standaardafwijking en dat is de helft. Een op een overnemen maakt alles twee
 *  keer zo wazig als bedoeld. */
const KADER_R = 15;

// De lijn loopt van lavendel bovenaan naar diep violet onderaan, met een warme
// gloed in de linkerbovenhoek waar het licht vandaan komt.
const KADER_LIJN = [
  "radial-gradient(58% 150% at 3% 8%, rgba(255,196,90,.85) 0%, rgba(255,196,90,.25) 34%, transparent 62%)",
  "linear-gradient(180deg, #C09AFF 0%, #9159E8 30%, #6A38BE 66%, #3E1E78 100%)",
].join(", ");

// Een tweede lijn voor de buitenste lijst: een diagonale wandeling van goud
// linksboven, via violet in het midden, naar roze rechtsonder. Diagonaal en niet
// van boven naar beneden, want op een breed en laag vlak zie je een verticaal
// verloop nauwelijks: de zijkanten zijn te kort om er iets van te tonen.
export const KADER_LIJN_KLEUR = [
  "radial-gradient(52% 150% at 2% 4%, rgba(255,214,110,.9) 0%, rgba(255,196,90,.3) 30%, transparent 58%)",
  "linear-gradient(115deg, #FFCF4A 0%, #FFB347 13%, #C88BFF 42%, #9A4BF0 60%, #FF6FBC 85%, #E0409A 100%)",
].join(", ");

// Textuur over de lijn: fel bij de UITEINDEN, gedoofd in het MIDDEN van de
// lange randen. Zo houdt licht zich op een gesmede lijst: het blijft hangen in
// de hoeken, waar het metaal een knik maakt, en op de lange rechte stukken is er
// niets om het te vangen.
//
// Vandaar horizontaal en niet diagonaal. Een diagonaal verloop zet de dofste
// plek in een hoek, en dat is precies waar hij het felst hoort te zijn.
// De korte zijkanten pakken de waarde op 0 en 100 procent, dus die blijven vol.
const KADER_TEXTUUR = [
  "linear-gradient(90deg,",
  "#000 0%, #000 10%,",
  "rgba(0,0,0,.30) 26%, rgba(0,0,0,.16) 40%, rgba(0,0,0,.16) 60%, rgba(0,0,0,.30) 74%,",
  "#000 90%, #000 100%)",
].join(" ");

// De XP-balk: rood, via roze en violet naar goud. Vier kleuren over een lange
// smalle vorm, dus horizontaal; verticaal zou je er niets van zien.
export const KADER_LIJN_XP =
  "linear-gradient(90deg, #FF3B5C 0%, #FF5FA8 22%, #C86BFF 46%, #8A3DE8 66%, #FFC13A 88%, #FFE08A 100%)";

// Dezelfde wandeling, maar rond: hij eindigt op de kleur waarmee hij begint,
// zodat de lus naadloos is. Zonder dat zie je bij elke ronde een sprong.
export const KADER_LIJN_LOOP =
  "linear-gradient(115deg, #FFCF4A 0%, #FFB347 9%, #C88BFF 30%, #9A4BF0 44%, #FF6FBC 62%, #E0409A 74%, #C88BFF 86%, #FFCF4A 100%)";

// De glans: bijna wit, en ALLEEN in het midden van de boven- en onderrand. Daar
// vangt de lijn het licht; naar de uiteinden toe hoort er niets te zitten.
const KADER_GLANS =
  "linear-gradient(90deg, transparent 26%, rgba(255,250,235,.55) 50%, transparent 74%)";

// De lichte KERN in het midden van de lijn, zoals de energielijn boven "jij
// draait deze ronde" op het draaischerm. Daar is de lijn overal donker en licht
// alleen het midden op. Dat leest als een gloeiende draad in plaats van als een
// getekend randje.
//
// Het profiel is een PIEK en geen heuvel: de stops staan steil op elkaar naar
// het midden toe en op het hoogste punt zit een speldenknop bijna-wit (de
// radiaal). Een gelijkmatig verloop leest als een vage lichte zone; dit leest
// als een punt waar het licht ZIT.
const KERN_STREEP = [
  "radial-gradient(4px 1.6px at 50% 50%, rgba(255,255,255,.95) 0%, rgba(255,246,223,.55) 45%, transparent 72%)",
  "linear-gradient(90deg, transparent 26%, rgba(138,80,240,.28) 38%, rgba(196,158,255,.5) 47%, rgba(255,250,238,.85) 50%, rgba(196,158,255,.5) 53%, rgba(138,80,240,.28) 62%, transparent 74%)",
].join(", ");
// De losse punt die bij de veeg langs de rand glijdt.
const KERN_VEEG =
  "radial-gradient(closest-side, rgba(255,255,255,.9) 0%, rgba(255,246,223,.45) 55%, transparent 100%)";
// De onderrand krijgt de gloed WEL maar de punt NIET: het licht komt van boven,
// dus het piekpunt hoort alleen daar. Onder blijft een zachte heuvel.
const KERN_STREEP_ZACHT =
  "linear-gradient(90deg, transparent 28%, rgba(138,80,240,.24) 40%, rgba(196,158,255,.42) 50%, rgba(138,80,240,.24) 60%, transparent 72%)";

/** De schuine hoek van de rol-skin, maar dan in procenten EN pixels door
 *  elkaar, zodat hij meeschaalt met de doos. `polygon()` accepteert lengtes, dus
 *  de afsnijding blijft even groot terwijl het vlak breder of smaller wordt.
 *  De rol gebruikt `path()` met een kwartbocht per hoek, maar die rekent in echte
 *  pixels en kan dus niet meeschalen. */
export const schuin = (cut: number) =>
  `polygon(${cut}px 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, ${cut}px 100%, 0 calc(100% - ${cut}px), 0 ${cut}px)`;

/** De gemeenschappelijke opmaak van een ring-laag: een doos met opvulling,
 *  waarvan het midden met een masker wordt weggehaald. Wat overblijft is de
 *  rand. */
const ringLaag = (r: number, dik: number): CSSProperties => ({
  position: "absolute",
  inset: 0,
  borderRadius: r,
  padding: dik,
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  maskComposite: "exclude",
  pointerEvents: "none",
});

export function NeonKader({
  children,
  style,
  binnen,
  radius = KADER_R,
  vulling = "licht",
  dik = 0.5,
  lijn = KADER_LIJN,
  hoek,
  gloed = "0 0 10px rgba(139,83,255,.26), 0 3px 12px rgba(0,0,0,.38)",
  animeer = false,
  sterkte = 1,
  eindkap = false,
  adem,
  veeg = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** Opvulling binnen de lijst. */
  binnen?: CSSProperties;
  /** De hoekronding. Een lijst OM andere lijsten krijgt er een paar bij, zodat
   *  de binnenste er netjes in valt in plaats van ertegenaan te botsen. */
  radius?: number;
  /** Het verloop van de lijn. */
  lijn?: string;
  /** De buitengloed. Een box-shadow, of het woord "verloop": dan wordt het een
   *  vervaagde kopie van de lijn zelf, met een rookmasker eroverheen. Gebruik
   *  dat zodra de lijn meer dan twee kleuren heeft, anders gloeit er iets anders
   *  dan er staat. */
  gloed?: string;
  /** Laat de kleuren van de lijn rondlopen. Gebruik dan een reeks die eindigt
   *  op de kleur waarmee hij begint, anders zie je elke ronde een sprong. */
  animeer?: boolean;
  /** Hoe hard de lijn aanstaat, van 0 tot 1. Alle ringlagen schalen mee, dus de
   *  verhouding tussen lijn, bloom en glans blijft staan en alleen het geheel
   *  zakt weg. Terugdraaien op de lijn zelf zou die verhouding kapotmaken. */
  sterkte?: number;
  /** Gouden kappen op de twee schuine uiteindes, zoals de pijlen naast "jij
   *  draait deze ronde": geen kader maar hetzelfde principe. Alleen met een
   *  afsnijding, want de kap volgt precies die contour. */
  eindkap?: boolean;
  /** Laat de piek op de bovenrand ademen. Het getal is de fasevertraging in
   *  seconden: geef elke rij een andere, anders pompen ze synchroon en leest
   *  het als een machine in plaats van als licht. */
  adem?: number;
  /** De lichtveeg: het piekpunt glijdt af en toe langs de bovenrand. Voor EEN
   *  rij tegelijk, meer wordt onrustig. */
  veeg?: boolean;
  /** De afsnijding van de hoeken, in pixels, zoals de rol-skin. Zonder deze
   *  blijft het een gewone ronding. Met een afsnijding wordt de lijst glazig:
   *  een dun waas met een vervaging erachter, want glas hoort iets te doen met
   *  wat erachter ligt. */
  hoek?: number;
  /** "geen" laat de achtergrond volledig door: dan is de lijst puur lijn en
   *  licht. "licht" legt er een heel dun paars waas onder. */
  vulling?: "geen" | "licht";
  /** De dikte van de lijn. Onder de pixel: dat mag, een scherm van drie keer
   *  tekent er nog anderhalve echte pixel van en op een gewoon scherm wordt het
   *  een vervaagd streepje. Precies wat je wilt bij een lijn die er eerder moet
   *  zijn dan opvallen. */
  dik?: number;
}) {
  const KADER_R = radius;
  const vorm = hoek ? { clipPath: schuin(hoek) } : { borderRadius: KADER_R };
  // Bij een AFSNIJDING kan de gewone ringtruc niet. Die maakt het gat met een
  // masker op de content-doos, en die doos is rechthoekig: de buitenkant volgt
  // dan wel de schuine hoek maar de binnenkant niet, dus in de hoeken loopt de
  // lijn dood.
  //
  // `mix-blend-mode: destination-out` om er een gat in te slaan werkt ook niet:
  // Chrome ondersteunt de compositie-modi daar niet, en dan wordt die laag
  // gewoon zwart. Geprobeerd, en het hele vlak werd zwart.
  //
  // Wat wel werkt is hoe de rol-skin het doet: EEN pad met twee contouren, de
  // buitenste en de binnenste, met de even-oneven-regel. Dat vraagt echte
  // pixels, dus de doos meet zichzelf op.
  const doos = useRef<HTMLDivElement | null>(null);
  const kapId = useId();
  const [maat, setMaat] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = doos.current;
    if (!hoek || !el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setMaat({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hoek]);
  const ringPad = (d: number): string | undefined => {
    if (!hoek || !maat) return undefined;
    const buiten = chamferPath(maat.w, maat.h, hoek, 2);
    const binnen = chamferPath(maat.w - d * 2, maat.h - d * 2, Math.max(1, hoek - d), 2);
    // De binnenste contour verschoven naar zijn plek, zodat de wand overal even
    // dik is.
    return `path(evenodd, "${buiten} M ${d} ${d} ${binnen.replace(/^M /, "m ").replace(/M /g, "m ")}")`;
  };
  const ring = (d: number): CSSProperties => ringLaag(KADER_R, d);
  return (
    <div ref={doos} style={{ position: "relative", ...style }}>
      {/* 1. zachte buitengloed. Met een afsnijding kan dit geen box-shadow zijn,
          want die volgt de rechthoek en niet de vorm; dan is het een vervaagde
          kopie van de vorm zelf. */}
      {gloed === "verloop" ? (
        // Een box-shadow kan geen verloop dragen, dus dit is een vervaagde kopie
        // van de LIJN zelf: dan gloeit er precies wat er staat, op de plek waar
        // het staat.
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -3,
            ...(hoek ? { clipPath: schuin(hoek) } : { borderRadius: KADER_R + 3 }),
            backgroundImage: lijn,
            filter: "blur(7px)",
            opacity: 0.5,
            ...(animeer ? { backgroundSize: "200% 100%", animation: "kader-loop 11s linear infinite" } : null),
            pointerEvents: "none",
          }}
        />
      ) : hoek ? (
        <span
          aria-hidden
          style={{ position: "absolute", inset: -1, ...vorm, backgroundImage: lijn, filter: "blur(6px)", opacity: 0.22, pointerEvents: "none" }}
        />
      ) : (
        <span
          aria-hidden
          style={{ position: "absolute", inset: 0, borderRadius: KADER_R, boxShadow: gloed, pointerEvents: "none" }}
        />
      )}
      {/* 2. het paneel. Bij "geen" is het echt leeg; met een afsnijding is het
          glas: een dun waas MET een vervaging erachter, want glas hoort iets te
          doen met wat erachter ligt. */}
      <div
        style={{
          position: "relative",
          ...vorm,
          overflow: "hidden",
          // GLAS, geen mist. Alleen vervagen is niet genoeg: op een donkere
          // achtergrond wordt dat een vlek. Wat het glas maakt zijn drie dingen
          // erbij:
          //   `saturate`, want glas versterkt de kleur die erdoorheen komt en
          //   een blur alleen wast die juist uit;
          //   een schuine glans van linksboven, want dat is de weerspiegeling;
          //   en een binnenschaduw onderaan, waardoor het dikte krijgt.
          // Met een afsnijding EN "geen" is het puur lijn: dan hoort er ook geen
          // glas te zitten, want een vervaging zonder vulling is nog steeds een
          // vlek over de achtergrond.
          backdropFilter: hoek && vulling !== "geen" ? "blur(7px) saturate(170%)" : undefined,
          WebkitBackdropFilter: hoek && vulling !== "geen" ? "blur(7px) saturate(170%)" : undefined,
          boxShadow: hoek && vulling !== "geen" ? "inset 0 -6px 10px rgba(8,3,22,.22), inset 0 1px 0 rgba(255,255,255,.08)" : undefined,
          backgroundImage:
            vulling === "geen"
              ? undefined
              : hoek
                ? [
                    // Rond de vijf procent. Genoeg om te zien dat er iets voor
                    // de achtergrond hangt, te weinig om een vlak te worden. Het
                    // GLAS zit hem niet in de dekking maar in de vervaging en de
                    // verzadiging hieronder; die blijven dus staan.
                    "linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 34%, rgba(255,255,255,0) 56%)",
                    "linear-gradient(180deg, rgba(150,110,235,.05) 0%, rgba(40,18,80,.05) 60%, rgba(14,6,32,.08) 100%)",
                  ].join(", ")
                : "linear-gradient(180deg, rgba(66,36,116,.20) 0%, rgba(30,14,58,.26) 50%, rgba(16,7,34,.30) 100%)",
          ...binnen,
        }}
      >
        {/* 3. hoekverlichting: warm, linksboven, want daar komt het licht vandaan */}
        <span
          aria-hidden
          style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(70% 150% at 5% 0%, rgba(255,190,90,.10) 0%, transparent 55%)", pointerEvents: "none" }}
        />
        {/* 4. binnenglans: kort en alleen langs de bovenrand. Over de halve rand
            licht leest niet als licht maar als een gekleurd vlak. */}
        <span
          aria-hidden
          style={{ position: "absolute", left: "8%", right: "8%", top: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)", pointerEvents: "none" }}
        />
        {children}
      </div>
      {/* 5 en 6. De lijn als drie ringen, met de textuur als masker over de hele
          stapel. Zie references/lagen.md in de skill neon-kader. */}
      <span
        aria-hidden
        style={{ position: "absolute", inset: 0, WebkitMaskImage: KADER_TEXTUUR, maskImage: KADER_TEXTUUR, pointerEvents: "none" }}
      >
        {hoek ? (
          <>
            <span aria-hidden style={{ position: "absolute", inset: 0, clipPath: ringPad(Math.max(1, dik + 1.4)), backgroundImage: lijn, filter: "blur(3px)", opacity: 0.3 * sterkte, pointerEvents: "none" }} />
            <span aria-hidden style={{ position: "absolute", inset: 0, clipPath: ringPad(Math.max(0.8, dik)), backgroundImage: lijn, opacity: 0.85 * sterkte, pointerEvents: "none" }} />
            <span aria-hidden style={{ position: "absolute", inset: 0, clipPath: ringPad(Math.max(0.8, dik)), backgroundImage: KADER_GLANS, opacity: sterkte, pointerEvents: "none" }} />
          </>
        ) : (
          <>
            <span className={animeer ? "kader-loop" : undefined} aria-hidden style={{ ...ring(dik + 1.4), backgroundImage: lijn, filter: "blur(3px)", opacity: 0.26 * sterkte }} />
            <span className={animeer ? "kader-loop" : undefined} aria-hidden style={{ ...ring(dik), backgroundImage: lijn, opacity: 0.68 * sterkte }} />
            <span aria-hidden style={{ ...ring(dik), backgroundImage: KADER_GLANS, opacity: sterkte }} />
          </>
        )}
      </span>
      {/* De KERN, buiten het textuurmasker. Dat masker dooft juist het midden van
          de lange randen, en dat is precies waar deze hoort te zitten: eronder
          zou hij weggepoetst worden door de laag die hem moet dragen.

          Twee LOSSE strepen, boven en onder, in plaats van een gradient door het
          ringmasker: op een wand van 0,8 pixel rondt de browser zo'n masker per
          rand net anders af en dan gloeit de ene rand wel en de andere amper.
          Zo staan ze er allebei gegarandeerd, met dezelfde piek. */}
      {hoek &&
        ([[{ top: 0 }, KERN_STREEP], [{ bottom: 0 }, KERN_STREEP_ZACHT]] as const).map(([kant, streep], i) => {
          const boven = i === 0;
          return (
            <span
              key={i}
              aria-hidden
              className={boven && adem !== undefined ? "kern-adem" : undefined}
              style={{
                position: "absolute",
                left: hoek + 2,
                right: hoek + 2,
                height: 1.2,
                ...kant,
                backgroundImage: streep,
                pointerEvents: "none",
                // Negatief, zodat elke rij meteen midden in zijn eigen fase
                // begint in plaats van allemaal tegelijk bij nul.
                ...(boven && adem !== undefined ? { animationDelay: `${-adem}s` } : null),
              }}
            >
              {/* de gloed: dezelfde streep, iets hoger en vervaagd */}
              <span aria-hidden style={{ position: "absolute", left: 0, right: 0, top: -1, height: 3, backgroundImage: streep, filter: "blur(1.6px)", opacity: 0.55 }} />
              {boven && veeg && (
                <span aria-hidden className="kern-veeg" style={{ position: "absolute", top: -0.6, height: 2.2, width: 46, marginLeft: -23, backgroundImage: KERN_VEEG, pointerEvents: "none" }} />
              )}
            </span>
          );
        })}
      {/* De gouden eindkappen: de contour van het schuine uiteinde als los
          sieraad, zoals de pijlen naast "jij draait deze ronde". Zelfde
          principe als daar en als de lijn zelf: een vervaagde kopie eronder als
          gloed, het goud erop, en een lichte kern op de staander. Buiten het
          textuurmasker, want een kap die halverwege dooft is geen kap. */}
      {eindkap && hoek && maat && (() => {
        const c = hoek;
        const { w, h } = maat;
        const arm = 5; // hoe ver de kap over de lange rand doorloopt
        // Een halve lijndikte naar binnen: een pad OP de rand steekt met zijn
        // halve dikte buiten de doos, en dat randje kwam boven het wapen uit.
        const i = 0.5;
        const links = `M ${c + arm} ${i} L ${c} ${i} L ${i} ${c} L ${i} ${h - c} L ${c} ${h - i} L ${c + arm} ${h - i}`;
        const rechts = `M ${w - c - arm} ${i} L ${w - c} ${i} L ${w - i} ${c} L ${w - i} ${h - c} L ${w - c} ${h - i} L ${w - c - arm} ${h - i}`;
        const kap = (extra?: CSSProperties) => (
          <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none", ...extra }}>
            <defs>
              <linearGradient id={kapId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFEBB8" />
                <stop offset="38%" stopColor="#FFCF4A" />
                <stop offset="72%" stopColor="#E2A33C" />
                <stop offset="100%" stopColor="#9C6B1F" />
              </linearGradient>
            </defs>
            <path d={links} fill="none" stroke={`url(#${kapId})`} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
            <path d={rechts} fill="none" stroke={`url(#${kapId})`} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
            {/* de kern: alleen de staander vangt het licht, niet de armen */}
            <path d={`M ${i} ${c + 3} L ${i} ${h - c - 3}`} fill="none" stroke="#FFF6DF" strokeWidth={0.5} opacity={0.8} strokeLinecap="round" />
            <path d={`M ${w - i} ${c + 3} L ${w - i} ${h - c - 3}`} fill="none" stroke="#FFF6DF" strokeWidth={0.5} opacity={0.8} strokeLinecap="round" />
          </svg>
        );
        return (
          <>
            {/* De gloed is een vervaagde kopie erachter, geen drop-shadow: die
                laat iOS de laag apart rasteren en dan zie je zijn rechthoek. */}
            <span aria-hidden style={{ position: "absolute", inset: 0, filter: "blur(3px)", opacity: 0.65, pointerEvents: "none" }}>{kap()}</span>
            {kap()}
          </>
        );
      })()}
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
/** De zijde van een kaartje. Even hoog als het kaartje vóór het vierkant werd,
 *  zodat het raster op één scherm blijft passen. */
const MAAT = 74;

export function StatKaart({ icoon, art, waarde, label }: { icoon: ReactNode; art?: string; waarde: ReactNode; label: string }) {
  return (
    <div
      style={{
        // De lijst is vierkant getekend, dus het kaartje is vierkant. Zonder
        // deze verhouding bepaalt de inhoud de hoogte en dan trekt de rand met
        // de tekst mee scheef.
        position: "relative",
        aspectRatio: "1 / 1",
        // Vierkant EN klein: op vier kolommen zou een kaartje 86 breed worden en
        // dan is het blok twee rijen van 86 hoog, waardoor het scherm overloopt.
        // Deze bovengrens houdt het kaartje even hoog als voordat het vierkant
        // werd; wat overblijft is lucht tussen de kolommen.
        maxWidth: MAAT,
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // De inhoud hangt aan de BOVENkant en staat niet in het midden: het
        // teken hoort vlak onder de lijst te zitten, met de lucht onderaan.
        // Zwevend in het midden lijkt het kaartje half leeg.
        justifyContent: "flex-start",
        gap: 1,
        boxSizing: "border-box",
        textAlign: "center",
        borderStyle: "solid",
        // De randbreedte MOET meeschalen met het kaartje: de snede is 70 van de
        // 429 pixels, dus de lijst beslaat 16% van de zijde. Houd je de rand op
        // een vaste 9 terwijl het kaartje krimpt, dan wordt de lijst te dun ten
        // opzichte van de rest en leest de art als uitgerekt.
        borderWidth: Math.round(MAAT * (70 / 429)),
        borderImage: "url(/ui/stat-frame.webp) 70 fill stretch",
        filter: "drop-shadow(0 4px 9px rgba(0,0,0,.45))",
      }}
    >
      {/* Het teken groeit OMHOOG: het schuift met een negatieve marge de
          binnenrand in en wordt even veel groter. Zo blijven het cijfer en het
          label precies waar ze stonden en heeft alleen het teken meer ruimte. */}
      {art ? (
        <img src={art} alt="" aria-hidden style={{ width: 28, height: 28, marginTop: -6, objectFit: "contain", flexShrink: 0 }} />
      ) : (
        <span style={{ color: GOUD[2], height: 28, marginTop: -6, display: "grid", placeItems: "center", flexShrink: 0 }}>{icoon}</span>
      )}
      {/* Het cijfer is wit en niet goud: het goud zit al in de lijst en in het
          teken, dus een derde gouden ding maakt het kaartje één brij. Wit is
          hier het felste wat er is en trekt het oog dus vanzelf naar het
          getal, precies waar het hoort. */}
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: 16,
          lineHeight: 1,
          color: "#FFFFFF",
          textShadow: "0 2px 4px rgba(0,0,0,.55)",
        }}
      >
        {waarde}
      </div>
      {/* Het label blijft op één regel. Wikkelt er eentje om, dan is dat kaartje
          hoger van binnen dan de rest en moet het teken overal kleiner om die
          ene uitzondering; liever knijpt de letter dan het teken. */}
      <div
        style={{
          maxWidth: "100%",
          fontFamily: font.ui,
          fontWeight: 500,
          fontSize: 8,
          lineHeight: 1.15,
          color: withAlpha("#FFFFFF", 0.92),
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** De plaatsingspenning links in een potje-rij. Goud voor de eerste plek, zilver
 *  en brons daarna, en daarna paars: alleen het podium verdient metaal. */
// De wimpel uit de UI-map. De verhouding komt van de art zelf; de zilveren en
// bronzen versie zijn dezelfde tekening in een ander metaal, zodat alle drie
// hetzelfde licht en dezelfde vorm hebben. Dat is precies wat een set
// podiumplaatsen moet doen.
const WAPEN_VERH = 1875 / 1201;
// Bump zodra je de art op DEZELFDE naam vervangt: de service worker bewaart
// plaatjes cache-first en ruimt pas op bij zijn volgende activatie.
const WAPEN_ART = 5;

export function PlekWapen({ plek, maat = 38 }: { plek: number; maat?: number }) {
  // Het podium is DRIE, daaronder dezelfde wimpel in rood. Zo houdt de rij zijn
  // ritme (een los zwevend cijfer naast drie wimpels leest als een ontbrekend
  // plaatje) en blijft het onderscheid staan: goud, zilver en brons zijn metaal,
  // de rest is dat niet.
  const metaal = plek === 1 ? "goud" : plek === 2 ? "zilver" : plek === 3 ? "brons" : plek > 0 ? "overig" : null;
  const hoog = Math.round(maat * WAPEN_VERH);
  return (
    <span style={{ position: "relative", width: maat, height: hoog, flexShrink: 0, display: "grid", placeItems: "center" }}>
      {metaal ? (
        <img
          src={`/ui/wapen/${metaal}.webp?v=${WAPEN_ART}`}
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(0% 0%, 100% 0%, 100% 72%, 50% 100%, 0% 72%)",
            background: "linear-gradient(162deg, rgba(255,255,255,.2), rgba(0,0,0,.4))",
          }}
        />
      )}
      {/* De wimpel loopt onderin in een punt, dus het cijfer staat HOGER dan het
          midden van de doos; in het midden zou het half op die punt vallen. */}
      <span
        style={{
          position: "relative",
          paddingBottom: hoog * 0.24,
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: Math.round(maat * (17 / 38)),
          lineHeight: 1,
          // Per metaal de donkerste tint van dat metaal zelf, niet zomaar een
          // donkere kleur: op het neutrale grijs van de zilveren wimpel zou het
          // oude paars als een vlek leggen.
          // Per metaal de donkerste tint van dat metaal zelf. De rode wimpel is
          // juist donker van waarde, dus daar draait het om: een licht cijfer op
          // een vol vlak.
          color: plek === 1 ? "#4A2E00" : plek === 2 ? "#2A2A33" : plek === 3 ? "#3A1C05" : plek > 0 ? "#FFE9E2" : colors.sub,
          textShadow: plek > 3 ? "0 1px 2px rgba(70,6,0,.65)" : metaal ? "0 1px 0 rgba(255,255,255,.45)" : "none",
        }}
      >
        {plek}e
      </span>
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
  const deel = doel && doel > 0 ? Math.min(1, (nu ?? 0) / doel) : 0;
  return (
    <div style={{ width: 61, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ position: "relative", width: 54, height: 59 }}>
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
          <span style={{ filter: behaald ? "none" : "grayscale(1) brightness(1.4)", opacity: behaald ? 1 : 0.45 }}>
            <HexArt maat={62}>
              <span style={{ display: "grid", placeItems: "center", color: GOUD[3] }}>{icoon}</span>
            </HexArt>
          </span>
        )}
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 8.5, lineHeight: 1.15, textAlign: "center", color: behaald ? colors.ink : colors.faint }}>
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
