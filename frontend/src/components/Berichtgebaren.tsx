// Wat je met een bericht kunt DOEN: erop reageren en het weghalen.
//
// TWEE WEGEN NAAR DEZELFDE TWEE DINGEN, en dat is met opzet. Vegen naar rechts
// is snel en kost geen enkele tik, maar je moet weten dat het kan. Ingedrukt
// houden is trager maar laat zien wat er te kiezen valt. Iedereen die ooit een
// berichten-app heeft gebruikt kent er minstens een van.
//
// NAAR RECHTS EN NIET NAAR LINKS. Links naast een bericht zit in deze app niets,
// rechts zit de rand van het scherm; een veeg naar rechts duwt het bericht dus
// het scherm in en niet eraf. Dat leest als "pak dit op", en dat is precies wat
// antwoorden is.
//
// DE VEEG MAG DE LIJST NIET IN DE WEG ZITTEN. Een chat scroll je verticaal, en
// dat hoort te blijven werken ook als je vinger een beetje schuin gaat. Vandaar
// `touch-action: pan-y` (de browser houdt het verticale scrollen zelf) en een
// drempel die pas kantelt als de beweging duidelijk horizontaal is. Onder die
// drempel gebeurt er niets en scrollt de lijst gewoon door.
//
// ALLEEN JE EIGEN BERICHT KUN JE WEGHALEN. Ook niet als je de host bent: een
// gesprek waarin een ander jouw woorden kan wissen is geen gesprek meer. De
// server controleert het nog een keer, want een knop verbergen is geen slot.
import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, Trash2 } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";

/** Hoever je moet vegen voor het telt. Ver genoeg om niet per ongeluk te gaan,
 *  kort genoeg om met een duim te halen. */
const VEEG = 46;
/** Hoever het bericht hoogstens meeschuift. Daarna trekt het niet verder mee,
 *  zodat de veeg voelt als een veer en niet als slepen. */
const REK = 68;
/** Hoe lang indrukken telt als indrukken houden. */
const HOUD = 460;

type Soort = string | null | undefined;

/** De regel die een geciteerd bericht samenvat. Een spraakbericht of een sticker
 *  heeft geen tekst, en "" citeren leest als een fout. */
export function citaatTekst(tekst: string, soort: Soort, labels: { spraak: string; foto: string; sticker: string }): string {
  if (soort === "voice") return labels.spraak;
  if (soort === "image") return labels.foto;
  if (soort === "emote") return labels.sticker;
  return tekst || "";
}

/** Het blokje IN een bericht dat laat zien waar het een antwoord op is. */
export function Citaat({ naam, tekst, kleur }: { naam: string; tekst: string; kleur?: string }) {
  const lijn = kleur || colors.gold;
  return (
    <span
      style={{
        display: "block", marginBottom: 6, paddingLeft: 8,
        borderLeft: `2.5px solid ${withAlpha(lijn, 0.85)}`,
        opacity: 0.85, maxWidth: "100%",
      }}
    >
      <span style={{ display: "block", fontFamily: font.ui, fontSize: 11, fontWeight: 800, color: lijn, lineHeight: 1.3 }}>
        {naam}
      </span>
      <span
        style={{
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          fontFamily: font.ui, fontSize: 12.5, color: colors.ink, lineHeight: 1.35, wordBreak: "break-word",
        }}
      >
        {tekst}
      </span>
    </span>
  );
}

/** De strook boven het invulveld: waar je op gaat antwoorden, met een kruisje. */
export function AntwoordBalk({ naam, tekst, onWeg, weg }: { naam: string; tekst: string; onWeg: () => void; weg: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 12px 7px 10px",
        background: "linear-gradient(180deg, rgba(28,14,58,.92), rgba(16,8,38,.92))",
        boxShadow: `inset 0 1px 0 ${withAlpha(colors.gold, 0.28)}`,
      }}
    >
      <CornerUpLeft size={16} color={colors.gold} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: font.ui, fontSize: 11, fontWeight: 800, color: colors.gold, lineHeight: 1.3 }}>
          {naam}
        </span>
        <span style={{ display: "block", fontFamily: font.ui, fontSize: 12.5, color: colors.ink, opacity: 0.85, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tekst}
        </span>
      </span>
      <button
        type="button"
        onClick={onWeg}
        aria-label={weg}
        style={{ flexShrink: 0, width: 30, height: 30, display: "grid", placeItems: "center", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.faint} strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
    </div>
  );
}

export function BerichtHuls({
  mine, breedte, onReageer, onVerwijder, labels, children,
}: {
  /** Is dit bericht van jou? Alleen dan mag je het weghalen. */
  mine: boolean;
  /** Hoe breed het bericht hoogstens mag zijn. Staat hier en niet op de bel,
   *  want een percentage in de bel zou tegen deze huls afgemeten worden en die
   *  is precies zo breed als de bel: dat rekent rond in cirkels. */
  breedte?: string;
  onReageer: () => void;
  onVerwijder?: () => void;
  labels: { reageer: string; verwijder: string };
  children: React.ReactNode;
}) {
  const [schuif, setSchuif] = useState(0);
  const [sleept, setSleept] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const doos = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const kant = useRef<"onbekend" | "horizontaal" | "verticaal">("onbekend");
  const klok = useRef(0);

  useEffect(() => () => window.clearTimeout(klok.current), []);

  const stop = () => {
    window.clearTimeout(klok.current);
    start.current = null;
    kant.current = "onbekend";
  };

  const omlaag = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    kant.current = "onbekend";
    window.clearTimeout(klok.current);
    klok.current = window.setTimeout(() => {
      // Ingedrukt houden. De plek van het BERICHT bepaalt waar het menu komt en
      // niet die van je vinger: het menu hoort bij het bericht, en je vinger
      // ligt er middenop.
      const r = doos.current?.getBoundingClientRect();
      if (!r) return;
      navigator.vibrate?.(12);
      setMenu({ x: mine ? r.right : r.left, y: r.top });
      stop();
      setSchuif(0);
    }, HOUD);
  };

  const beweegt = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (kant.current === "onbekend") {
      // Pas kiezen als er genoeg beweging is om iets te kunnen zeggen. Anders
      // pakt de eerste trilling van je vinger de richting.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.3 && dx > 0) {
        kant.current = "horizontaal";
        setSleept(true);
        window.clearTimeout(klok.current);
        // De vangst mag mislukken (een aanwijzer die al losgelaten is bestaat
        // niet meer) en dat mag de veeg niet onderbreken.
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* niet erg */ }
      } else {
        // Verticaal (of naar links): de lijst mag scrollen, wij bemoeien ons
        // er niet meer mee tot de vinger loslaat.
        kant.current = "verticaal";
        window.clearTimeout(klok.current);
        return;
      }
    }
    if (kant.current !== "horizontaal") return;
    // Voorbij de rek gaat het steeds stroever, zodat je voelt dat je er bent.
    const rauw = Math.max(0, dx);
    setSchuif(rauw <= REK ? rauw : REK + (rauw - REK) * 0.18);
  };

  const omhoog = () => {
    const genoeg = schuif >= VEEG;
    stop();
    setSleept(false);
    setSchuif(0);
    if (genoeg) {
      navigator.vibrate?.(10);
      onReageer();
    }
  };

  const knop = (tekst: string, icoon: React.ReactNode, doe: () => void, rood?: boolean) => (
    <button
      type="button"
      onClick={() => { setMenu(null); doe(); }}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer",
        fontFamily: font.ui, fontSize: 14, fontWeight: 600, textAlign: "left",
        color: rood ? "#FF7A6B" : colors.ink,
      }}
    >
      {icoon}
      {tekst}
    </button>
  );

  return (
    <>
      <div
        ref={doos}
        onPointerDown={omlaag}
        onPointerMove={beweegt}
        onPointerUp={omhoog}
        onPointerCancel={() => { stop(); setSleept(false); setSchuif(0); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: "relative", maxWidth: breedte, touchAction: "pan-y",
          // NOOIT selecteerbaar, niet alleen tijdens het slepen: op iOS opent
          // lang indrukken op tekst de selectie-loep, en die springt vóór ons
          // menu. Kopiëren kan een bericht hier dus niet; het gebaar erop wel,
          // en dat is precies de ruil die elke berichten-app maakt.
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        {/* De pijl komt tevoorschijn in de ruimte die het bericht achterlaat. */}
        <span
          aria-hidden
          style={{
            position: "absolute", left: -30, top: 0, bottom: 0, width: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: Math.min(1, schuif / VEEG),
            transform: `scale(${0.7 + 0.3 * Math.min(1, schuif / VEEG)})`,
            pointerEvents: "none",
          }}
        >
          <CornerUpLeft size={18} color={colors.gold} strokeWidth={2.4} />
        </span>
        <div
          style={{
            transform: `translateX(${schuif}px)`,
            transition: sleept ? "none" : "transform 190ms cubic-bezier(.2,.9,.3,1)",
          }}
        >
          {children}
        </div>
      </div>

      {menu && (
        <>
          {/* Alles buiten het menu sluit het. Een `fixed` laag over het hele
              scherm, want de lijst eronder scrollt en een klik-buiten via de
              bel zelf zou daar niet op reageren. */}
          <div
            onPointerDown={(e) => { e.stopPropagation(); setMenu(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 80 }}
          />
          <div
            role="menu"
            style={{
              position: "fixed", zIndex: 81,
              // Boven het bericht als het kan, eronder als het bovenaan hangt.
              top: menu.y > 150 ? undefined : menu.y + 8,
              bottom: menu.y > 150 ? `calc(100% - ${menu.y - 8}px)` : undefined,
              left: mine ? undefined : Math.max(8, menu.x),
              right: mine ? Math.max(8, window.innerWidth - menu.x) : undefined,
              minWidth: 168,
              borderRadius: 14, overflow: "hidden",
              background: "linear-gradient(180deg, rgba(32,16,64,.98), rgba(18,9,42,.98))",
              boxShadow: `inset 0 0 0 1.4px ${withAlpha(colors.gold, 0.55)}, 0 14px 34px rgba(0,0,0,.55)`,
            }}
          >
            {knop(labels.reageer, <CornerUpLeft size={16} strokeWidth={2.2} />, onReageer)}
            {mine && onVerwijder && (
              <>
                <span style={{ display: "block", height: 1, background: withAlpha(colors.gold, 0.2) }} />
                {knop(labels.verwijder, <Trash2 size={16} strokeWidth={2.2} />, onVerwijder, true)}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
