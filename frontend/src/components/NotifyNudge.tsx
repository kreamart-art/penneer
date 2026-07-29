// A slide-down banner from the top asking to enable notifications — the same
// shell as InviteBanner / DmBanner, but it STAYS until the person dismisses it
// (no 15s auto-dismiss), because it is a one-time onboarding nudge, not a
// transient event. Rendered on the main page, so it never covers gameplay.
import { useEffect, useState } from "react";
import { CloseIcon } from "./CloseIcon";
import { KADER_LIJN_GOUD, NeonKader } from "./ProfileHero";
import { Bell } from "lucide-react";
import { useT } from "../i18n/i18n";
import { ensurePushSubscription } from "../pwa/push";
import { colors, font, withAlpha } from "../theme/tokens";

const ASKED_KEY = "penneer.notifAsked";

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && typeof Notification.requestPermission === "function";
}

export function NotifyNudge() {
  const { t } = useT();
  const [hidden, setHidden] = useState(() => {
    try {
      return !supported() || Notification.permission !== "default" || localStorage.getItem(ASKED_KEY) === "1";
    } catch {
      return true;
    }
  });
  const [shown, setShown] = useState(false);

  // Slide it in once we know it's showing. No auto-dismiss timer: it lingers at
  // the top until the person turns notifications on or taps it away.
  useEffect(() => {
    if (hidden) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [hidden]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const enable = () => {
    Notification.requestPermission()
      .then((perm) => {
        // Granted: also register for REAL push (works with the app closed).
        if (perm === "granted") void ensurePushSubscription();
      })
      .finally(dismiss);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 89, // just under InviteBanner (90) / DmBanner (91)
        display: "flex",
        justifyContent: "center",
        padding: "calc(8px + env(safe-area-inset-top)) 10px 0",
        pointerEvents: "none",
        transform: shown ? "translateY(0)" : "translateY(-130%)",
        transition: "transform .38s cubic-bezier(.2,1,.3,1)",
      }}
    >
      {/* Dezelfde lijst als de meldingsbalk: een gouden verlooplijn die
          rondloopt, met kappen op de schuine uiteindes. Deze balk had nog zijn
          eigen gouden ring met een eigen vulling, en dat was een tweede stijl
          voor precies hetzelfde ding. */}
      <NeonKader
        radius={16}
        dik={0.7}
        lijn={KADER_LIJN_GOUD}
        gloed="verloop"
        animeer
        eindkap
        vulling="geen"
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
        <span
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: withAlpha(colors.gold, 0.14),
            border: `1px solid ${withAlpha(colors.gold, 0.4)}`,
          }}
        >
          <Bell size={18} color={colors.gold} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 13.5, color: colors.ink }}>{t("notifTitle")}</div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub, lineHeight: 1.35 }}>{t("notifText")}</div>
        </div>
        <button
          onClick={enable}
          style={{ flexShrink: 0, padding: "8px 13px", borderRadius: 10, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
        >
          {t("notifEnable")}
        </button>
        <button
          onClick={dismiss}
          aria-label={t("notifLater")}
          style={{ flexShrink: 0, display: "grid", placeItems: "center", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <CloseIcon size={30} />
        </button>
      </NeonKader>
    </div>
  );
}

// Fire a local notification (only meaningful while the tab is hidden).
export function localNotify(title: string, body: string) {
  try {
    if (!supported() || Notification.permission !== "granted" || !document.hidden) return;
    new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png" });
  } catch {
    /* some platforms (iOS) do not allow page-scope notifications */
  }
}
