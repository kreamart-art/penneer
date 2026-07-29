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
import { ArtIcoon, type ArtNaam } from "./ArtIcoon";
import { CloseIcon } from "./CloseIcon";
import { KADER_LIJN_GOUD, NeonKader } from "./ProfileHero";
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
 *  hele rij oplichten maakt van een lijst een kerstboom. */
export function MeldingRij({ melding, onOpen }: { melding: Melding; onOpen: () => void }) {
  const { t } = useT();
  return (
    <NeonKader
      hoek={9}
      dik={melding.gelezen ? 0.26 : 0.42}
      sterkte={melding.gelezen ? 0.24 : 0.55}
      vulling="geen"
      eindkap
      style={{ marginInline: 6 }}
      binnen={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", minHeight: 46 }}
    >
      <button
        onClick={onOpen}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <ArtIcoon naam={icoonVan(melding.icoon)} size={20} gloed={!melding.gelezen} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: font.ui, fontWeight: melding.gelezen ? 600 : 700, fontSize: 13, color: melding.gelezen ? colors.sub : colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {melding.titel}
          </span>
          <span style={{ display: "block", fontFamily: font.ui, fontSize: 11.5, color: colors.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {melding.body}
          </span>
        </span>
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{geleden(melding.created_at, t)}</span>
          {!melding.gelezen && (
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors.gold, boxShadow: `0 0 7px ${withAlpha(colors.gold, 0.8)}` }} />
          )}
        </span>
      </button>
    </NeonKader>
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
