// In-room chat: a bubble button (with unread badge) that opens a bottom-sheet
// panel. Lets players ask what a word means without leaving the app. Lives in
// the TopBar, so it's reachable on every in-room screen.
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

export function ChatButton({ game }: { game: GameApi }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const chat = game.state.chat;
  const unread = open ? 0 : Math.max(0, chat.length - seen);

  // While open, keep "seen" pinned to the latest so closing clears the badge.
  useEffect(() => {
    if (open) setSeen(chat.length);
  }, [open, chat.length]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("chat")}
        title={t("chat")}
        style={{
          position: "relative",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: colors.faint,
          display: "flex",
          padding: 2,
        }}
      >
        <MessageCircle size={18} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -5,
              minWidth: 15,
              height: 15,
              padding: "0 4px",
              borderRadius: 999,
              background: colors.gold,
              color: colors.bg0,
              fontFamily: font.ui,
              fontSize: 10,
              fontWeight: 800,
              lineHeight: "15px",
              textAlign: "center",
              boxShadow: `0 0 8px ${withAlpha(colors.gold, 0.6)}`,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && <ChatPanel game={game} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChatPanel({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const chat = game.state.chat;
  const myId = game.state.playerId;
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Stick to the bottom as messages arrive, and focus the input on open.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat.length]);
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    game.sendChat(text);
    setDraft("");
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(6,3,18,.55)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          height: "min(72vh, 620px)",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #1B1245 0%, #140C33 100%)",
          borderTop: `1px solid ${colors.panelBorder}`,
          borderLeft: `1px solid ${colors.panelBorder}`,
          borderRight: `1px solid ${colors.panelBorder}`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: "0 -18px 60px rgba(0,0,0,.5)",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${colors.hairline}`,
          }}
        >
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>
            {t("chat")}
          </span>
          <button
            onClick={onClose}
            aria-label={t("back")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* messages */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {chat.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: colors.faint, fontFamily: font.ui, fontSize: 14, maxWidth: 260, lineHeight: 1.5 }}>
              {t("chatEmpty")}
            </div>
          ) : (
            chat.map((m) => {
              const mine = m.player_id === myId;
              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 700, color: mine ? colors.gold : m.color, padding: "0 4px 2px" }}>
                    {mine ? t("chatYou") : m.name}
                  </span>
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: "8px 11px",
                      borderRadius: 14,
                      borderTopRightRadius: mine ? 4 : 14,
                      borderTopLeftRadius: mine ? 14 : 4,
                      background: mine ? withAlpha(colors.gold, 0.16) : colors.panel,
                      border: `1px solid ${mine ? withAlpha(colors.gold, 0.3) : colors.panelBorder}`,
                      color: colors.ink,
                      fontFamily: font.ui,
                      fontSize: 14.5,
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* composer */}
        <form
          onSubmit={submit}
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
            borderTop: `1px solid ${colors.hairline}`,
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("chatPlaceholder")}
            maxLength={280}
            enterKeyHint="send"
            style={{
              flex: 1,
              minWidth: 0,
              background: "rgba(0,0,0,.25)",
              border: `1px solid ${colors.panelBorder}`,
              borderRadius: 999,
              padding: "11px 16px",
              color: colors.ink,
              fontFamily: font.ui,
              fontSize: 15,
              outline: "none",
            }}
          />
          <button
            type="submit"
            aria-label={t("chatSend")}
            disabled={!draft.trim()}
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "none",
              cursor: draft.trim() ? "pointer" : "default",
              background: draft.trim() ? colors.gold : withAlpha(colors.gold, 0.25),
              color: colors.bg0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background .15s",
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
