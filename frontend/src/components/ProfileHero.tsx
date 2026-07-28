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

// De glans: bijna wit, en ALLEEN in het midden van de boven- en onderrand. Daar
// vangt de lijn het licht; naar de uiteinden toe hoort er niets te zitten.
const KADER_GLANS =
  "linear-gradient(90deg, transparent 26%, rgba(255,250,235,.55) 50%, transparent 74%)";

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
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** Opvulling binnen de lijst. */
  binnen?: CSSProperties;
  /** De hoekronding. Een lijst OM andere lijsten krijgt er een paar bij, zodat
   *  de binnenste er netjes in valt in plaats van ertegenaan te botsen. */
  radius?: number;
}) {
  const KADER_R = radius;
  return (
    <div style={{ position: "relative", ...style }}>
      {/* 1. buitengloed */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: KADER_R,
          boxShadow: "0 0 10px rgba(139,83,255,.30), 0 3px 12px rgba(0,0,0,.45)",
          pointerEvents: "none",
        }}
      />
      {/* 2. het paneel */}
      <div
        style={{
          position: "relative",
          borderRadius: KADER_R,
          overflow: "hidden",
          backgroundImage: "linear-gradient(180deg, rgba(52,28,92,.60) 0%, rgba(30,14,58,.72) 45%, rgba(16,7,34,.80) 100%)",
          ...binnen,
        }}
      >
        {/* 3. hoeklicht linksboven */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(75% 155% at 5% 0%, rgba(255,190,90,.11) 0%, transparent 56%)",
            pointerEvents: "none",
          }}
        />
        {/* 5. binnenglans: kort, alleen waar het oppervlak het licht vangt */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.20), transparent)",
            pointerEvents: "none",
          }}
        />
        {children}
      </div>
      {/* 4. de lijn: DRIE ringen op elkaar, dezelfde stapeling als de banner
          "Jij draait deze ronde".
            a. een kleine bloom eronder. Klein, want een brede gloed maakt de
               lijn juist vaag in plaats van verlicht.
            b. de lijn zelf, met het verloop.
            c. een bijna-witte glans BOVENOP, maar alleen in het midden. Op de
               donkere flanken mengt bijna-wit tot grijs, en op een lijn van een
               pixel is dat randje bijna de halve lijn; dan wordt de hele lijn
               grijs. Glans hoort alleen te zitten waar de lijn oplicht.
          Alle drie als ring geknipt met hetzelfde masker: een verlooplaag
          eronder schijnt door het doorschijnende paneel heen, en
          `background-clip: border-box` betekent "over de hele doos" en niet
          "alleen de rand". */}
      <span aria-hidden style={{ ...ringLaag(KADER_R, 2.5), backgroundImage: KADER_LIJN, filter: "blur(3px)", opacity: 0.45 }} />
      <span aria-hidden style={{ ...ringLaag(KADER_R, 1), backgroundImage: KADER_LIJN }} />
      <span aria-hidden style={{ ...ringLaag(KADER_R, 1), backgroundImage: KADER_GLANS }} />
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
          <span style={{ filter: behaald ? "none" : "grayscale(1) brightness(1.4)", opacity: behaald ? 1 : 0.45 }}>
            <HexArt maat={62}>
              <span style={{ display: "grid", placeItems: "center", color: GOUD[3] }}>{icoon}</span>
            </HexArt>
          </span>
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
