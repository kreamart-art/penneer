// Een kist openen, als moment.
//
// De popup verschijnt zodra het account een dichte kist draagt. Twee fasen:
// eerst de DICHTE kist met een zachte gloed en de knop, dan (na het antwoord
// van de server) de OPEN kist met de lichtbundel uit de art en wat erin zat.
// De inhoud komt van de server bij het openen, niet vooraf: wat je ziet is wat
// je kreeg, en een herladen popup kan nooit iets anders beweren.
import { useState } from "react";
import { GOUD } from "./ProfileHero";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

export function KistPopup({ kist, onClose }: {
  kist: { id: number; kist: string };
  onClose: () => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<{ coins: number } | null>(null);
  const [bezig, setBezig] = useState(false);

  const doeOpen = () => {
    if (bezig) return;
    setBezig(true);
    sound.uiTap();
    fetch("/api/kist/open", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id: kist.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) { setOpen({ coins: d.coins ?? 0 }); sound.win(); }
        else onClose();
      })
      .catch(() => onClose());
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 97,
        background: "rgba(6,3,18,.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 300, textAlign: "center" }}>
        <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: GOUD[3] }}>
          {open ? t("kistOpenTitel") : t("kistDichtTitel")}
        </span>

        {/* De kist zelf, met een eigen halo-laag eronder in plaats van een
            drop-shadow-filter: die rastert op iOS de doos van de laag mee. */}
        <div style={{ position: "relative", width: 210, height: 210, display: "grid", placeItems: "center" }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: -30,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${withAlpha(colors.gold, open ? 0.4 : 0.22)} 0%, transparent 62%)`,
              transition: "opacity .4s ease",
              animation: open ? undefined : "kist-adem 2.2s ease-in-out infinite",
            }}
          />
          <img
            key={open ? "open" : "dicht"}
            src={`/ui/${kist.kist}${open ? "-open" : ""}.webp?v=1`}
            alt=""
            className={open ? "kist-knal" : undefined}
            style={{ position: "relative", maxWidth: 200, maxHeight: 200, objectFit: "contain", display: "block" }}
          />
        </div>

        {open ? (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: font.display, fontWeight: 800, fontSize: 28, color: GOUD[3] }}>
              <img src="/coins-stack.webp" alt="" aria-hidden style={{ height: 26, width: "auto", display: "block" }} />
              +{open.coins}
            </span>
            <button
              onClick={() => { sound.uiTap(); onClose(); }}
              className="pressable"
              style={{ border: "none", borderRadius: 999, padding: "12px 34px", cursor: "pointer", background: `linear-gradient(180deg, ${GOUD[3]}, ${GOUD[1]})`, color: "#2A1A05", fontFamily: font.ui, fontSize: 15, fontWeight: 800 }}
            >
              {t("kistTop")}
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, lineHeight: 1.4, color: colors.sub }}>{t("kistDichtBody")}</p>
            <button
              onClick={doeOpen}
              disabled={bezig}
              className="pressable"
              style={{ border: "none", borderRadius: 999, padding: "12px 34px", cursor: bezig ? "default" : "pointer", opacity: bezig ? 0.6 : 1, background: `linear-gradient(180deg, ${GOUD[3]}, ${GOUD[1]})`, color: "#2A1A05", fontFamily: font.ui, fontSize: 15, fontWeight: 800 }}
            >
              {t("kistOpenKnop")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
