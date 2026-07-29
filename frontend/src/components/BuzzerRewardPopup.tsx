// Victory popup for EVERYTHING you earn: level-reward buzzer skins, avatar
// frames, milestone emote packs, titles and the coin drops. The server marks
// each one claimed once it has been celebrated, so a card pops exactly once.
// Bought items never appear here, the shop already confirms a purchase.
//
// One card at a time, in a fixed queue: buzzer skins (lowest level first, so on
// level 10 the spin button comes before the coins), then the other earned
// rewards, then the coins.
import { useEffect, useRef, useState } from "react";
import { KnopPlaat } from "./KnopPlaat";
import { KADER_LIJN_GOUD, NeonKader } from "./ProfileHero";
import { CloseIcon } from "./CloseIcon";
import { Button } from "./Button";
import { EMOTE_PACKS, EMOTE_SRC } from "./emotes";
import type { GameApi, PendingReward } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** The shared shell: veil, card and the staggered entrance. */
function RewardCard({
  onClose,
  closeLabel,
  children,
  maxWidth = 340,
}: {
  onClose?: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      className="reward-veil"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 96,
        background: "rgba(6,3,18,.8)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "grid",
        placeItems: "center",
        padding: 22,
      }}
    >
      {/* Dezelfde lijst als om elke sectie: een gouden verlooplijn die rondloopt
          met kappen op de uiteindes. Dit was nog een eigen gouden ring met een
          eigen vulling. De entree zit op de LIJST en niet op de inhoud: schaalt
          de inhoud binnen een lijst met `overflow: hidden`, dan zie je tijdens
          die halve seconde de lijst zelf langs de randen doorschemeren. */}
      <NeonKader
        radius={24}
        dik={0.9}
        lijn={KADER_LIJN_GOUD}
        gloed="verloop"
        animeer
        eindkap
        vulling="geen"
        className="reward-card"
        style={{ width: "100%", maxWidth }}
        binnen={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "26px 22px 20px",
          textAlign: "center",
          // Licht dat van bovenaf in het vlak valt, en randverdonkering zodat
          // het bol leest. Dit is het moment waarop iets waardevol moet voelen.
          backgroundImage: [
            "linear-gradient(180deg, rgba(255,243,181,.12) 0%, transparent 16%)",
            `radial-gradient(90% 55% at 50% 0%, ${withAlpha(colors.gold, 0.14)}, transparent 66%)`,
            "radial-gradient(130% 105% at 50% 46%, transparent 54%, rgba(6,3,18,.5) 100%)",
            "linear-gradient(180deg, #33235A 0%, #241748 46%, #140C2C 100%)",
          ].join(", "),
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label={closeLabel}
            style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}
          >
            <CloseIcon size={26} />
          </button>
        )}
        {children}
      </NeonKader>
    </div>
  );
}

/** The prize itself: a breathing glow with the artwork popping in on top. */
function RewardArt({ src, size = 180 }: { src: string; size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.35)}, transparent 68%)`, animation: "breath-glow 3s ease-in-out infinite" }} />
      <img className="reward-art" src={src} alt="" style={{ position: "relative", width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 10px 24px rgba(0,0,0,.55))" }} />
    </div>
  );
}

export function BuzzerRewardPopup({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  const buzzers = (account?.buzzer_rewards ?? []).filter((r) => r.unlocked && !r.claimed).sort((a, b) => a.level - b.level);
  const buzzer = buzzers[0] ?? null;
  const earned: PendingReward | null = !buzzer ? (account?.pending_rewards ?? [])[0] ?? null : null;
  const coinsPending = account?.coins_pending ?? 0;
  const showCoins = !buzzer && !earned && coinsPending > 0;

  const [visible, setVisible] = useState(false);
  const celebrated = useRef(false);
  const key = buzzer?.skin ?? earned?.id ?? (showCoins ? "coins" : "none");

  useEffect(() => {
    const active = !!buzzer || !!earned || showCoins;
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

  // ---- coin reward card (last in the queue) ----
  if (showCoins) {
    const ackCoins = () => {
      game.ackCoinReward(account!.level.level);
      celebrated.current = false;
    };
    return (
      <RewardCard>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 21, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>{t("coinsRewardTitle")}</span>
        <RewardArt src="/coin.webp" size={140} />
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 30, color: colors.ink }}>+{coinsPending}</span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("coinsRewardBody")}</p>
        <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: colors.gold }}>{t("coinsBalance", { n: account!.coins })}</span>
        <KnopPlaat breed={104} onClick={ackCoins} label={t("coinsOk")} />
      </RewardCard>
    );
  }

  // ---- earned frame / emote pack / title ----
  if (earned) {
    const done = (equip: boolean) => {
      game.claimReward(earned.id, equip);
      celebrated.current = false; // re-arm the sound for the next card in the queue
    };
    const pack = EMOTE_PACKS.find((p) => p.id === earned.id);
    const heading =
      earned.kind === "frame" ? t("rewardFrameTitle")
      : earned.kind === "emotes" ? t("rewardEmotesTitle")
      : t("rewardTitleTitle");
    const body =
      earned.kind === "frame" ? t("rewardFrameBody")
      : earned.kind === "emotes" ? t("rewardEmotesBody")
      : t("rewardTitleBody");
    const label =
      earned.kind === "emotes" && pack ? t(pack.name)
      : earned.kind === "title" ? t(`title_${earned.name}`)
      : t(earned.name);

    return (
      <RewardCard onClose={() => done(false)} closeLabel={t("claimLater")} maxWidth={360}>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>{heading}</span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{body}</p>

        {/* Emote packs celebrate with a row of stickers; the rest with one big
            piece of art. Titles have no artwork, so the title IS the art. */}
        {earned.kind === "emotes" && pack ? (
          <div className="reward-art" style={{ display: "flex", gap: 4, padding: "4px 0" }}>
            {pack.emotes.slice(0, 3).map((id) => (
              <img key={id} src={EMOTE_SRC(id)} alt="" style={{ width: 84, height: 84, objectFit: "contain", filter: "drop-shadow(0 8px 18px rgba(0,0,0,.5))" }} />
            ))}
          </div>
        ) : earned.art ? (
          <RewardArt src={earned.art} />
        ) : (
          <div className="reward-art" style={{ position: "relative", margin: "10px 0 4px", padding: "10px 22px", borderRadius: 999, border: `1px solid ${withAlpha(colors.gold, 0.55)}`, background: withAlpha(colors.gold, 0.12), boxShadow: `0 0 34px ${withAlpha(colors.gold, 0.25)}` }}>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, color: colors.gold, letterSpacing: 0.4 }}>{label}</span>
          </div>
        )}

        {earned.kind !== "title" && (
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.ink }}>{label}</span>
        )}

        {earned.kind === "frame" ? (
          <>
            <Button variant="gold" full onClick={() => done(true)}>{t("rewardFrameEquip")}</Button>
            <button onClick={() => done(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: "4px 4px 0" }}>
              {t("claimLater")}
            </button>
          </>
        ) : (
          <KnopPlaat breed={104} onClick={() => done(false)} label={t("coinsOk")} />
        )}
      </RewardCard>
    );
  }

  // `visible` can lag one render behind the account update (it is set in the
  // effect): guard the buzzer card so we never touch a null `buzzer`.
  if (!buzzer) return null;

  const done = (equip: boolean) => {
    game.claimBuzzerReward(buzzer.skin, equip);
    celebrated.current = false; // re-arm the sound for the next reward in the queue
  };

  return (
    <RewardCard onClose={() => done(false)} closeLabel={t("claimLater")} maxWidth={360}>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>
        {t("claimTitle", { n: buzzer.level })}
      </span>
      <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("claimBody")}</p>
      <RewardArt src={`/buzzers/${buzzer.skin}.webp`} />
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.ink }}>{t(buzzer.name)}</span>
      <Button variant="gold" full onClick={() => done(true)}>{t("claimEquip")}</Button>
      <button onClick={() => done(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: "4px 4px 0" }}>
        {t("claimLater")}
      </button>
    </RewardCard>
  );
}
