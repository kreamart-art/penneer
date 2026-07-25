// The emote tray above the chat composer: one section per pack. Owned packs are
// tappable (sends the emote straight away); locked packs are dimmed with a hint
// that they live in the shop, so people see what they could have.
import { Lock, X } from "lucide-react";
import { EMOTE_PACKS, EMOTE_SRC } from "./emotes";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export function EmotePicker({
  unlocked,
  onPick,
  onClose,
}: {
  unlocked: Set<string>;   // packs this player may send from (free/earned/bought)
  onPick: (emote: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const allUnlocked = EMOTE_PACKS.every((p) => unlocked.has(p.id));

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.hairline}`,
        background: withAlpha("#000000", 0.22),
        maxHeight: 260,
        overflowY: "auto",
        padding: "10px 12px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ flex: 1, fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
          {t("emoteTitle")}
        </span>
        <button
          onClick={onClose}
          aria-label={t("back")}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
        >
          <X size={16} />
        </button>
      </div>

      {!allUnlocked && (
        <p style={{ margin: "0 0 10px", fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>
          {t("emoteLockedHint")}
        </p>
      )}

      {EMOTE_PACKS.map((pack) => {
        const has = unlocked.has(pack.id);
        return (
          <div key={pack.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
              <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: has ? colors.gold : colors.faint }}>
                {t(pack.name)}
              </span>
              {!has && <Lock size={11} color={colors.faint} />}
              {!has && (
                <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{t(pack.how)}</span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              {pack.emotes.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    if (!has) return;
                    sound.uiTap();
                    onPick(id);
                  }}
                  aria-label={id}
                  className={has ? "pressable" : undefined}
                  style={{
                    aspectRatio: "1 / 1",
                    minWidth: 0,
                    padding: 3,
                    borderRadius: 10,
                    border: `1px solid ${colors.panelBorder}`,
                    background: withAlpha("#000000", 0.2),
                    cursor: has ? "pointer" : "default",
                    display: "grid",
                    placeItems: "center",
                    boxSizing: "border-box",
                  }}
                >
                  <img
                    src={EMOTE_SRC(id)}
                    alt=""
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      opacity: has ? 1 : 0.3,
                      filter: has ? "none" : "grayscale(0.6)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
