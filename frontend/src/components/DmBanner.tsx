// Slide-down banner for an incoming DM, over whatever screen you're on — the
// message counterpart to InviteBanner. You see the text right away (or can play
// a voice note), and a press-and-hold opens the thread to reply.
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./CloseIcon";
import { KADER_LIJN_GOUD, NeonKader } from "./ProfileHero";
import { MessageCircle } from "lucide-react";
import { Avatar } from "./Avatar";
import { VoiceNote } from "./VoiceNote";
import { EMOTE_SRC } from "./emotes";
import type { DmMessage } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font } from "../theme/tokens";

export function DmBanner({
  dm,
  sender,
  onReply,
  onClose,
}: {
  dm: DmMessage;
  sender: { id: string; name: string; color: string; has_avatar?: boolean; avatar_ver?: number };
  onReply: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [shown, setShown] = useState(false);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = window.setTimeout(onClose, 15000); // auto-dismiss (stays in the thread)
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm.id]);

  // Press-and-hold (500ms) anywhere on the message opens the thread to reply.
  const startHold = () => {
    if (holdTimer.current) return;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      sound.haptic?.([15, 30]);
      onReply();
    }, 500);
  };
  const cancelHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

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
        transform: shown ? "translateY(0)" : "translateY(-130%)",
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
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "manipulation",
        }}
      >
        {/* Indrukken-en-vasthouden zit op een eigen laag over de hele rij: de
            lijst zelf tekent alleen, hij vangt geen aanraking. */}
        <span
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          style={{ position: "absolute", inset: 0 }}
        />
        <Avatar name={sender.name} color={sender.color} size={38} userId={sender.id} hasAvatar={sender.has_avatar} avatarVer={sender.avatar_ver} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: font.ui, fontWeight: 700, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <MessageCircle size={13} color={colors.gold} style={{ flexShrink: 0 }} /> {sender.name}
          </div>
          {dm.emote ? (
            <div style={{ marginTop: 3 }}>
              <img src={EMOTE_SRC(dm.emote)} alt="" width={44} height={44} style={{ width: 44, height: 44, display: "block", objectFit: "contain" }} />
            </div>
          ) : dm.voice_id ? (
            <div style={{ marginTop: 3 }}>
              <VoiceNote src={`/api/dm/voice/${dm.voice_id}`} duration={dm.voice_dur ?? 0} />
            </div>
          ) : (
            <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dm.text}</div>
          )}
          <div style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint, marginTop: 2 }}>{t("dmBannerHint")}</div>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label={t("declineBtn")}
          style={{ flexShrink: 0, display: "grid", placeItems: "center", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <CloseIcon size={30} />
        </button>
      </NeonKader>
    </div>
  );
}
