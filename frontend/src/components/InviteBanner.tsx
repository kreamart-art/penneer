// A small banner that slides down from the top when a room invite or challenge
// arrives, over whatever screen you're on, so you can join right away. Not a
// full-screen modal — a compact strip with Accept / Decline.
import { useEffect, useState } from "react";
import { Swords, UserPlus, X } from "lucide-react";
import { Avatar } from "./Avatar";
import type { InboxItem } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

export function InviteBanner({
  invite,
  onAccept,
  onDecline,
  onClose,
}: {
  invite: InboxItem;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = window.setTimeout(onClose, 15000); // auto-dismiss, stays in inbox
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite.id]);

  const isChallenge = invite.type === "challenge";
  const line = isChallenge ? t("challengedYou") : `${t("invitedYouTo")} ${invite.room_code}`;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: "center",
        padding: "calc(8px + env(safe-area-inset-top)) 10px 0",
        pointerEvents: "none",
        transform: shown ? "translateY(0)" : "translateY(-130%)",
        transition: "transform .38s cubic-bezier(.2,1,.3,1)",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 440,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px 9px 12px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #241738, #180F30)",
          border: `1px solid ${withAlpha(colors.gold, 0.5)}`,
          boxShadow: `0 14px 40px rgba(0,0,0,.55), 0 0 22px ${withAlpha(colors.gold, 0.18)}`,
        }}
      >
        <Avatar name={invite.from_name} color={invite.from_color} size={38} userId={invite.from_id} hasAvatar={invite.has_avatar} avatarVer={invite.avatar_ver} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {isChallenge ? <Swords size={13} color={colors.gold} /> : <UserPlus size={13} color={colors.gold} />}
              {invite.from_name}
            </span>
          </div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</div>
        </div>
        <button
          onClick={onAccept}
          style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          {t("joinBtn")}
        </button>
        <button
          onClick={onDecline}
          aria-label={t("declineBtn")}
          style={{ flexShrink: 0, width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 10, border: `1px solid ${colors.hairline}`, background: "transparent", color: colors.faint, cursor: "pointer" }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
