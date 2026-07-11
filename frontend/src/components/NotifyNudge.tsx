// One-time banner asking to enable notifications, shown once you're on the
// app. Local notifications fire while the tab is hidden (chat, invites);
// real push with the app closed is a later step.
import { useState } from "react";
import { Bell } from "lucide-react";
import { useT } from "../i18n/i18n";
import { ensurePushSubscription } from "../pwa/push";
import { colors, font, radius, withAlpha } from "../theme/tokens";

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

  if (hidden) return null;

  const done = () => {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: radius.card,
        background: withAlpha(colors.gold, 0.08),
        border: `1px solid ${withAlpha(colors.gold, 0.3)}`,
      }}
    >
      <Bell size={18} color={colors.gold} style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, flex: 1, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.45 }}>{t("notifText")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => {
            Notification.requestPermission()
              .then((perm) => {
                // Granted: also register for REAL push (works with the app closed).
                if (perm === "granted") void ensurePushSubscription();
              })
              .finally(done);
          }}
          style={{ padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12 }}
        >
          {t("notifEnable")}
        </button>
        <button
          onClick={done}
          style={{ padding: "4px 6px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: colors.faint, fontFamily: font.ui, fontSize: 12 }}
        >
          {t("notifLater")}
        </button>
      </div>
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
