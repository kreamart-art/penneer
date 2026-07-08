// First-visit prompt for guests: a prominent card to create a profile, instead
// of only the small corner button. Dismissible — you can keep playing as guest.
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./Button";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, radius, withAlpha } from "../theme/tokens";

const SEEN_KEY = "penneer.profilePromptSeen";

export function ProfilePrompt({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useT();
  const [name, setName] = useState("");

  // Close automatically once an account exists (created here or logged in).
  useEffect(() => {
    if (game.state.account) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.state.account]);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        background: "rgba(6,3,18,.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 22,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "26px 22px 22px",
          borderRadius: 22,
          background: "linear-gradient(180deg, #241738, #160D30)",
          border: `1px solid ${withAlpha(colors.gold, 0.4)}`,
          boxShadow: "0 24px 70px rgba(0,0,0,.6)",
          textAlign: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <Logo size={72} />
          <span style={{ position: "absolute", right: -6, bottom: -2, width: 26, height: 26, borderRadius: 9, display: "grid", placeItems: "center", background: colors.gold, color: colors.bg0 }}>
            <UserRound size={15} />
          </span>
        </div>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.ink }}>{t("makeProfile")}</span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.5 }}>{t("makeProfileHint")}</p>

        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("yourName")}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: font.ui,
            fontSize: 16,
            color: colors.ink,
            background: withAlpha("#000000", 0.25),
            border: `1.5px solid ${colors.panelBorder}`,
            borderRadius: radius.button,
            padding: "13px 15px",
            textAlign: "center",
          }}
        />
        <Button variant="gold" full disabled={name.trim().length < 2} onClick={() => game.createAccount(name)}>
          {t("makeProfile")}
        </Button>
        <button
          onClick={dismiss}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: 4 }}
        >
          {t("continueGuest")}
        </button>
      </div>
    </div>
  );
}

export function profilePromptSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
