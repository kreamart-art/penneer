// Victory popup for level-reward buzzer skins. Watches the account for any
// reward that is unlocked (level reached) but not yet claimed, and shows a
// celebratory modal one at a time. "Gebruik deze knop" claims + equips it,
// "Later kiezen" claims without equipping (so it stops popping up but the
// player keeps their current buzzer). Players already past a milestone see it
// on their next visit — that is the intended "claim what you earned" moment.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export function BuzzerRewardPopup({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  const rewards = account?.buzzer_rewards ?? [];
  // The next reward to celebrate: unlocked, not claimed, lowest level first.
  const pending = rewards.filter((r) => r.unlocked && !r.claimed).sort((a, b) => a.level - b.level);
  const current = pending[0] ?? null;

  const [visible, setVisible] = useState(false);
  const celebrated = useRef(false);

  useEffect(() => {
    if (current && !visible) {
      setVisible(true);
      if (!celebrated.current) {
        celebrated.current = true;
        sound.badge();
        sound.haptic?.([20, 40, 20]);
      }
    }
    if (!current) {
      setVisible(false);
      celebrated.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.skin]);

  if (!current || !visible) return null;

  const done = (equip: boolean) => {
    game.claimBuzzerReward(current.skin, equip);
    celebrated.current = false; // re-arm the sound for the next reward in the queue
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(6,3,18,.8)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}>
      <div
        className="pop-in"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "26px 22px 20px",
          borderRadius: 24,
          background: "linear-gradient(180deg, #2a1c48, #160D30)",
          border: `1px solid ${withAlpha(colors.gold, 0.5)}`,
          boxShadow: `0 24px 80px rgba(0,0,0,.65), 0 0 60px ${withAlpha(colors.gold, 0.2)}`,
          textAlign: "center",
        }}
      >
        <button onClick={() => done(false)} aria-label={t("claimLater")} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
          <X size={19} />
        </button>

        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>
          {t("claimTitle", { n: current.level })}
        </span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("claimBody")}</p>

        {/* the shiny reward itself, with a soft radial glow behind it */}
        <div style={{ position: "relative", width: 180, height: 180, display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.35)}, transparent 68%)`, animation: "breath-glow 3s ease-in-out infinite" }} />
          <img src={`/buzzers/${current.skin}.webp`} alt="" style={{ position: "relative", width: 180, height: 180, objectFit: "contain", filter: "drop-shadow(0 10px 24px rgba(0,0,0,.55))" }} />
        </div>

        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.ink }}>{t(current.name)}</span>

        <Button variant="gold" full onClick={() => done(true)}>{t("claimEquip")}</Button>
        <button onClick={() => done(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: "4px 4px 0" }}>
          {t("claimLater")}
        </button>
      </div>
    </div>
  );
}
