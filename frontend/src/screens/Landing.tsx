// Landing — emblem, wordmark, tagline, name input, create / join, rules link.
import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, radius, withAlpha } from "../theme/tokens";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 16,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "13px 15px",
};

export function Landing({ game, onShowRules }: { game: GameApi; onShowRules: () => void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"none" | "join">("none");

  const canCreate = name.trim().length > 0;
  const canJoin = name.trim().length > 0 && code.trim().length === 4;

  const create = () => {
    sound.unlock();
    game.createRoom(name.trim());
  };
  const join = () => {
    sound.unlock();
    game.joinRoom(code.trim().toUpperCase(), name.trim());
  };

  return (
    <Screen>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ animation: "float-soft 4s ease-in-out infinite" }}>
            <Logo size={150} />
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 52,
              letterSpacing: 2,
              color: colors.ink,
              textShadow: `0 0 30px ${withAlpha(colors.violet, 0.7)}, 0 0 10px ${withAlpha(colors.gold, 0.3)}`,
            }}
          >
            PEN NEER
          </h1>
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontFamily: font.ui,
              fontSize: 14.5,
              lineHeight: 1.5,
              color: colors.sub,
              maxWidth: 320,
            }}
          >
            {t("tagline")}
          </p>
        </div>

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inputStyle} placeholder={t("yourName")} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />

          {mode === "none" ? (
            <>
              <Button variant="gold" full disabled={!canCreate} onClick={create}>
                {t("createRoom")}
              </Button>
              <Button variant="ghost" full onClick={() => setMode("join")}>
                {t("joinCta")}
              </Button>
            </>
          ) : (
            <>
              <input
                style={{ ...inputStyle, fontFamily: font.display, letterSpacing: 6, textAlign: "center", textTransform: "uppercase" }}
                placeholder={t("code")}
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
              <Button variant="primary" full disabled={!canJoin} onClick={join}>
                {t("join")}
              </Button>
              <Button variant="ghost" full onClick={() => setMode("none")}>
                {t("back")}
              </Button>
            </>
          )}
        </Card>

        {game.state.error && (
          <p style={{ textAlign: "center", color: colors.red, fontFamily: font.ui, fontSize: 14, margin: 0 }}>{game.state.error}</p>
        )}

        <button
          onClick={onShowRules}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: colors.sub,
            fontFamily: font.ui,
            fontSize: 13.5,
          }}
        >
          <HelpCircle size={16} />
          {t("howItWorks")}
        </button>
      </div>
    </Screen>
  );
}
