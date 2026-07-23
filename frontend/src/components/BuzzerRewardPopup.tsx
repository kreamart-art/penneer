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
  // Queue: buzzer milestone rewards first (lowest level up), then, once those
  // are cleared, the coin reward. So on level 10 the spin button shows before
  // the coins, exactly as asked.
  const pending = rewards.filter((r) => r.unlocked && !r.claimed).sort((a, b) => a.level - b.level);
  const current = pending[0] ?? null;
  const coinsPending = account?.coins_pending ?? 0;
  const showCoins = !current && coinsPending > 0;

  const [visible, setVisible] = useState(false);
  const celebrated = useRef(false);
  const key = current?.skin ?? (showCoins ? "coins" : "none");

  useEffect(() => {
    const active = !!current || showCoins;
    setVisible(active);
    if (active && !celebrated.current) {
      celebrated.current = true;
      sound.badge();
      sound.haptic?.([20, 40, 20]);
    }
    if (!active) celebrated.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!visible) return null;

  // ---- coin reward card (after the buzzer queue) ----
  if (showCoins) {
    const ackCoins = () => {
      game.ackCoinReward(account!.level.level);
      celebrated.current = false;
    };
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(6,3,18,.8)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}>
        <div className="pop-in" style={{ position: "relative", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "26px 22px 20px", borderRadius: 24, background: "linear-gradient(180deg, #2a1c48, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.5)}`, boxShadow: `0 24px 80px rgba(0,0,0,.65), 0 0 60px ${withAlpha(colors.gold, 0.2)}`, textAlign: "center" }}>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 21, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>{t("coinsRewardTitle")}</span>
          <div style={{ position: "relative", width: 150, height: 150, display: "grid", placeItems: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.35)}, transparent 68%)`, animation: "breath-glow 3s ease-in-out infinite" }} />
            <img src="/coin.webp" alt="" style={{ position: "relative", width: 140, height: 140, objectFit: "contain", filter: "drop-shadow(0 10px 24px rgba(0,0,0,.55))" }} />
          </div>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 30, color: colors.ink }}>+{coinsPending}</span>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("coinsRewardBody")}</p>
          <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: colors.gold }}>{t("coinsBalance", { n: account!.coins })}</span>
          <Button variant="gold" full onClick={ackCoins}>{t("coinsOk")}</Button>
        </div>
      </div>
    );
  }

  // `visible` can lag one render behind the account update (it is set in the
  // effect): guard the buzzer card so we never touch a null `current`.
  if (!current) return null;

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
          {t("claimTitle", { n: current!.level })}
        </span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("claimBody")}</p>

        {/* the shiny reward itself, with a soft radial glow behind it */}
        <div style={{ position: "relative", width: 180, height: 180, display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.35)}, transparent 68%)`, animation: "breath-glow 3s ease-in-out infinite" }} />
          <img src={`/buzzers/${current!.skin}.webp`} alt="" style={{ position: "relative", width: 180, height: 180, objectFit: "contain", filter: "drop-shadow(0 10px 24px rgba(0,0,0,.55))" }} />
        </div>

        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.ink }}>{t(current!.name)}</span>

        <Button variant="gold" full onClick={() => done(true)}>{t("claimEquip")}</Button>
        <button onClick={() => done(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: "4px 4px 0" }}>
          {t("claimLater")}
        </button>
      </div>
    </div>
  );
}
