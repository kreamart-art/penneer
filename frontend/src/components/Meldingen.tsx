// Meldingen in de app zelf: de balk die binnenvalt, en de lijst waar ze
// blijven staan.
//
// De app had drie losse banners (uitnodiging, bericht, prestatie) en verder
// niets: alles wat je niet toevallig zag was weg. Nu komt elke melding uit
// dezelfde catalogus (backend/app/meldingen.py), valt hij binnen als balk en
// blijft hij in de lijst tot je 'm gelezen hebt.
//
// De balk toont er ÉÉN tegelijk. Een stapel banners over elkaar leest als een
// storing; wat er nog achter staat wacht gewoon zijn beurt.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { ArtIcoon, type ArtNaam } from "./ArtIcoon";
import { CloseIcon } from "./CloseIcon";
import { KnopPlaat } from "./KnopPlaat";
import { KADER_LIJN_GOUD, NeonKader, schuin } from "./ProfileHero";
import type { Melding } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const ICOON: Record<string, ArtNaam> = {
  sterren: "sterren", boek: "boek", kroon: "kroon", potjes: "potjes",
  vlam: "vlam", beker: "beker", schild: "schild", krans: "krans",
};

function icoonVan(naam: string | null | undefined): ArtNaam {
  return ICOON[naam || ""] ?? "sterren";
}

/** Hoe lang geleden, kort. "nu", "12 min", "3 u", "2 d". */
export function geleden(ts: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return t("meldNu");
  if (s < 3600) return t("meldMin", { n: Math.floor(s / 60) });
  if (s < 86400) return t("meldUur", { n: Math.floor(s / 3600) });
  return t("meldDag", { n: Math.floor(s / 86400) });
}

/** De balk die van boven binnenschuift. Tik erop om ernaartoe te gaan. */
export function MeldingBanner({
  melding,
  onOpen,
  onClose,
}: {
  melding: Melding;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [binnen, setBinnen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setBinnen(true));
    const klok = window.setTimeout(onClose, 9000);
    sound.uiTap();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(klok);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [melding.id]);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 91,
        display: "flex",
        justifyContent: "center",
        padding: "calc(8px + env(safe-area-inset-top)) 10px 0",
        pointerEvents: "none",
        transform: binnen ? "translateY(0)" : "translateY(-130%)",
        transition: "transform .38s cubic-bezier(.2,1,.3,1)",
      }}
    >
      <NeonKader
        radius={16}
        dik={0.7}
        lijn={KADER_LIJN_GOUD}
        gloed="verloop"
        animeer
        eindkap
        style={{ pointerEvents: "auto", width: "100%", maxWidth: 440 }}
        binnen={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px 9px 12px",
          background: "linear-gradient(180deg, rgba(36,23,56,.94), rgba(24,15,48,.94))",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <button
          onClick={onOpen}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
        >
          <ArtIcoon naam={icoonVan(melding.icoon)} size={26} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: font.ui, fontWeight: 700, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {melding.titel}
            </span>
            <span style={{ display: "block", fontFamily: font.ui, fontSize: 12.5, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {melding.body}
            </span>
          </span>
        </button>
        <button
          onClick={onClose}
          aria-label={t("declineBtn")}
          style={{ flexShrink: 0, display: "grid", placeItems: "center", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <CloseIcon size={28} />
        </button>
      </NeonKader>
    </div>
  );
}

/** Eén regel in de meldingenlijst. Ongelezen krijgt een gouden stip, want een
 *  hele rij oplichten maakt van een lijst een kerstboom.
 *
 *  Een tik VOUWT HEM OPEN. De tekst stond op één regel met puntjes erachter en
 *  de tik ging meteen ergens heen, dus je kon nooit lezen wat er stond: je werd
 *  weggestuurd voor je het gelezen had. Nu klapt hij open, staat de hele tekst
 *  er, en pas dan kun je met de knop eronder naar waar hij over gaat. */
/** Een kleine knop in de kop van de meldingenlijst: "Alles gelezen" en "Alles
 *  wissen". Klein en rustig, want ze staan naast een titel en niet onder een
 *  scherm; de rode variant vraagt eerst om bevestiging en licht dan op. */
export function MeldKnop({ label, onClick, rood = false, actief = false }: {
  label: string;
  onClick: () => void;
  rood?: boolean;
  actief?: boolean;
}) {
  const kleur = rood ? "#FF8E86" : "#FFE7A8";
  return (
    <button
      onClick={onClick}
      className="pressable"
      style={{
        flexShrink: 0,
        background: actief ? withAlpha(colors.red, 0.22) : "rgba(255,255,255,.05)",
        border: `1px solid ${actief ? withAlpha(colors.red, 0.7) : withAlpha(kleur, 0.28)}`,
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
        fontFamily: font.ui,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        color: kleur,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function MeldingRij({
  melding, nieuw, onOpen, onWeg,
}: {
  melding: Melding;
  /** Overschrijft het gelezen-vlaggetje voor het OOG. Het vak zet zijn meldingen op
   *  gelezen zodra je erop staat, en dan zou de gouden stip verdwijnen op het
   *  moment dat je hem las. Met deze vlag blijft hij staan zolang je er bent. */
  nieuw?: boolean;
  onOpen: () => void;
  onWeg?: () => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const gelezen = nieuw ? false : melding.gelezen;

  // Vegen om weg te gooien. De rij schuift naar links tot de prullenbak eronder
  // vandaan komt en STOPT daar: hij mag de sectie niet uit. Een rij die je van
  // het scherm af kunt schuiven voelt alsof hij al weg is, en dan verwacht je
  // geen bevestiging meer; hier blijft hij liggen tot je de bak aantikt.
  const BAK = 64;
  const [x, setX] = useState(0);
  const start = useRef<{ x: number; y: number; basis: number } | null>(null);
  const vergrendeld = useRef<"geen" | "veeg" | "scroll">("geen");
  // Alleen meldingen die ergens over gaan krijgen een knop. "Ongelezen bericht"
  // zonder afzender heeft geen bestemming, en een knop die niets doet is erger
  // dan geen knop.
  let data: Record<string, string> = {};
  try { data = melding.data ? JSON.parse(melding.data) : {}; } catch { /* rommel is geen reden om niets te tonen */ }
  const heeftDoel = !!data.user_id || melding.naar === "duel" || melding.naar === "dagronde" || melding.naar === "profiel";

  const raakStart = (e: React.PointerEvent) => {
    if (!onWeg) return;
    start.current = { x: e.clientX, y: e.clientY, basis: x };
    vergrendeld.current = "geen";
  };
  const raakBeweeg = (e: React.PointerEvent) => {
    const st = start.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    // Pas beslissen welke richting het wordt als er echt beweging is: anders
    // pikt de rij een verticale scroll af.
    if (vergrendeld.current === "geen") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      vergrendeld.current = Math.abs(dx) > Math.abs(dy) ? "veeg" : "scroll";
    }
    if (vergrendeld.current !== "veeg") return;
    setX(Math.max(-BAK, Math.min(0, st.basis + dx)));
  };
  const raakEind = () => {
    if (!start.current) return;
    start.current = null;
    // Voorbij de helft blijft de bak staan, eronder veert hij terug. Geen derde
    // uitkomst: half open is geen toestand.
    setX((v) => (v < -BAK / 2 ? -BAK : 0));
  };

  return (
    // De veeg zit op de WIKKEL en niet op een laag over de rij heen. Zo'n laag
    // was er eerst, met inset 0, en die ving elke tik af: een gepositioneerd
    // element tekent boven de (ongepositioneerde) knop, wat de DOM-volgorde ook
    // is. Pointer-events bubbelen toch wel, dus de laag was ook nog eens
    // overbodig. De knop-click checkt zelf of er net geveegd is.
    <div
      onPointerDown={raakStart}
      onPointerMove={raakBeweeg}
      onPointerUp={raakEind}
      onPointerCancel={raakEind}
      style={{ position: "relative", marginInline: 6 }}
    >
      {/* De prullenbak ligt ONDER de rij en komt eronder vandaan. Hij staat er
          altijd; je ziet hem pas als de rij opzij gaat. */}
      {onWeg && (
        <button
          onClick={() => { sound.uiTap(); onWeg(); }}
          aria-label={t("meldingWeg")}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: BAK,
            display: "grid",
            placeItems: "center",
            border: "none",
            cursor: "pointer",
            padding: 0,
            clipPath: schuin(9),
            background: `linear-gradient(180deg, ${withAlpha(colors.red, 0.3)}, ${withAlpha(colors.red, 0.16)})`,
            boxShadow: `inset 0 0 0 1px ${withAlpha(colors.red, 0.5)}`,
            color: colors.red,
            opacity: x < -8 ? 1 : 0,
            transition: "opacity .12s ease",
            pointerEvents: x < -8 ? "auto" : "none",
          }}
        >
          <Trash2 size={18} />
        </button>
      )}
    <NeonKader
      hoek={9}
      dik={gelezen && !open ? 0.26 : 0.42}
      sterkte={gelezen && !open ? 0.24 : 0.55}
      vulling="geen"
      eindkap
      style={{
        transform: `translateX(${x}px)`,
        transition: start.current ? "none" : "transform .22s cubic-bezier(.2,.8,.3,1)",
        touchAction: "pan-y",
      }}
      binnen={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "8px 10px",
        minHeight: 46,
        // Ondoorzichtig, anders zie je de bak door de rij heen liggen.
        background: "linear-gradient(180deg, #241740, #1A1035)",
      }}
    >
      <button
        onClick={() => {
          if (vergrendeld.current === "veeg") { vergrendeld.current = "geen"; return; }
          if (x !== 0) { setX(0); return; }
          sound.uiTap(); setOpen((v) => !v);
        }}
        aria-expanded={open}
        style={{ width: "100%", minWidth: 0, display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <ArtIcoon naam={icoonVan(melding.icoon)} size={20} gloed={!gelezen} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: font.ui, fontWeight: gelezen ? 600 : 700, fontSize: 13, color: gelezen ? colors.sub : colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {melding.titel}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: font.ui,
              fontSize: 11.5,
              lineHeight: open ? 1.45 : undefined,
              color: colors.faint,
              overflow: open ? undefined : "hidden",
              textOverflow: open ? undefined : "ellipsis",
              whiteSpace: open ? "normal" : "nowrap",
            }}
          >
            {melding.body}
          </span>
        </span>
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{geleden(melding.created_at, t)}</span>
          {!gelezen && (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors.gold, boxShadow: `0 0 7px ${withAlpha(colors.gold, 0.8)}` }} />
          )}
          <ChevronDown
            size={14}
            color={colors.faint}
            style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .18s ease" }}
          />
        </span>
      </button>
      {open && heeftDoel && (
        <span style={{ display: "flex", justifyContent: "flex-end" }}>
          <KnopPlaat breed={92} onClick={onOpen} label={t("meldingOpen")} />
        </span>
      )}
    </NeonKader>
    </div>
  );
}

/** De wachtrij: houdt bij welke melding nu in beeld staat en welke nog volgen.
 *
 *  Een eigen haak omdat het scherm er niets van hoeft te weten: het krijgt één
 *  melding of niets, en zodra die weg is schuift de volgende aan. */
export function useMeldingWachtrij(nieuw: Melding | null) {
  const [rij, setRij] = useState<Melding[]>([]);
  const gezien = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!nieuw || gezien.current.has(nieuw.id)) return;
    gezien.current.add(nieuw.id);
    setRij((r) => [...r, nieuw]);
  }, [nieuw]);

  const huidig = rij[0] ?? null;
  const volgende = () => setRij((r) => r.slice(1));
  return { huidig, volgende };
}
