// In-room chat: a bubble button (with unread badge) that opens a bottom-sheet
// panel. Lets players ask what a word means without leaving the app. Lives in
// the TopBar, so it's reachable on every in-room screen.
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./CloseIcon";
import { TelHex } from "./TelHex";
import { ChatIcoon } from "./ChatIcoon";
import { WALLPAPERS, wallpaperKlasse, wallpaperStijl, wallpaperVan, wallpaperZet, type WallpaperId } from "./Wallpaper";
import type { GameApi } from "../net/socket";
import { MicButton } from "./MicButton";
import { BeeldKnop } from "./BeeldKnop";
import { VerstuurKnop } from "./VerstuurKnop";
import { VoiceNote } from "./VoiceNote";
import { EmotePicker } from "./EmotePicker";
import { EMOTE_SRC, FREE_EMOTE_PACKS } from "./emotes";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export function ChatButton({ game }: { game: GameApi }) {
  const { t } = useT();
  const chat = game.state.chat;
  const open = game.state.chatOpen;
  const unread = open ? 0 : Math.max(0, chat.length - game.state.chatSeen);
  // Op de ROL-pagina gaat de chat op slot. Hij viel al dicht zodra de rol begon
  // te draaien, maar je kon hem daarna meteen weer openen en dan zat je achter
  // een paneel te wachten terwijl de letter viel. Chatten hoort voor en na het
  // rollen, niet tijdens.
  const opSlot = game.state.room?.phase === "reveal";

  return (
    <>
      <button
        onClick={() => { if (!opSlot) game.openChat(); }}
        disabled={opSlot}
        aria-label={t("chat")}
        title={t("chat")}
        className="pressable"
        style={{
          position: "relative",
          background: "transparent",
          border: "none",
          cursor: opSlot ? "default" : "pointer",
          opacity: opSlot ? 0.35 : 1,
          padding: 0,
          lineHeight: 0,
          display: "flex",
        }}
      >
        <ChatIcoon licht={unread > 0} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -6, right: -7 }}>
            <TelHex n={unread} />
          </span>
        )}
      </button>
      {open && <ChatPanel game={game} onClose={() => game.closeChat()} />}
    </>
  );
}

function ChatPanel({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [emotesOpen, setEmotesOpen] = useState(false);
  const chat = game.state.chat;
  const myId = game.state.playerId;
  // Het behang. Dezelfde voorkeur als in je gesprekken (hij staat in
  // localStorage), en hier ook te WISSELEN: dan hoef je de room niet uit om je
  // achtergrond te veranderen, en wat je hier kiest geldt meteen ook daar.
  const [behang, setBehang] = useState<WallpaperId>(wallpaperVan);
  const [behangOpen, setBehangOpen] = useState(false);
  const roomCode = game.state.room?.code ?? "";

  // Upload a memo to this room, then post it as a chat message.
  const uploadVoice = async (blob: Blob, mime: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/voice/${roomCode}?player=${encodeURIComponent(myId ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!res.ok) return null;
      return (await res.json()).id as string;
    } catch {
      return null;
    }
  };
  // En hetzelfde voor een foto of sticker. Het plaatje leeft in de room, dus
  // hij verdwijnt met de room; dat is precies goed voor een potje.
  const uploadBeeld = async (blob: Blob, mime: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/image/${roomCode}?player=${encodeURIComponent(myId ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!res.ok) return null;
      return (await res.json()).id as string;
    } catch {
      return null;
    }
  };
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingRef = useRef(0);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const [, setTick] = useState(0);

  // Stick to the bottom as messages arrive, and focus the input on open.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat.length]);
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, []);
  // Tick every second so stale "typing" entries fade out; on close, make sure
  // others learn we stopped typing.
  useEffect(() => {
    const iv = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(idleTimerRef.current);
      if (lastTypingRef.current) game.sendChatTyping(false);
    };
  }, [game]);

  function signalTyping() {
    const now = Date.now();
    if (now - lastTypingRef.current > 1500) {
      game.sendChatTyping(true);
      lastTypingRef.current = now;
    }
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(stopTyping, 2500);
  }
  function stopTyping() {
    window.clearTimeout(idleTimerRef.current);
    if (lastTypingRef.current) {
      game.sendChatTyping(false);
      lastTypingRef.current = 0;
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    game.sendChat(text);
    setDraft("");
    stopTyping();
  }

  // Tap a sender's name to address them: inserts "@Naam " into the composer.
  function mention(name: string) {
    setDraft((d) => `${d}${d && !d.endsWith(" ") ? " " : ""}@${name} `);
    inputRef.current?.focus();
  }

  const now = Date.now();
  const typers = Object.entries(game.state.chatTyping)
    .filter(([id, v]) => id !== myId && now - v.ts < 4000)
    .map(([, v]) => v.name);

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
            onClick={() => { sound.uiTap(); setBehangOpen((v) => !v); }}
            aria-label={t("wallpaperTitle")}
            title={t("wallpaperTitle")}
            className="pressable"
            style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", padding: 4, marginLeft: "auto" }}
          >
            <img src="/ui/wallpaper.webp" alt="" aria-hidden style={{ width: 22, height: 22, objectFit: "contain", display: "block", opacity: behangOpen ? 1 : 0.75 }} />
          </button>
          <button
            onClick={onClose}
            aria-label={t("back")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
          >
            <CloseIcon size={26} />
          </button>
        </div>

        {/* Dezelfde behangknop als in een gesprek: de kiezer is een strook van
            staaltjes die opzij schuift, geen raster, want dat duwt de berichten
            weg zodra je hem opent. */}
        {behangOpen && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", overflowX: "auto", overflowY: "hidden",
              WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
              flexShrink: 0,
            }}
          >
            {WALLPAPERS.map((w) => {
              const aan = behang === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => { sound.uiTap(); setBehang(w.id); wallpaperZet(w.id); }}
                  aria-label={w.naam}
                  title={w.naam}
                  aria-pressed={aan}
                  className="pressable"
                  style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: 11,
                    border: "none", padding: 0, cursor: "pointer",
                    // De ring ligt OM het staaltje, niet erop, dus je ziet het
                    // behang zelf helemaal.
                    boxShadow: aan
                      ? `0 0 0 2px #160D30, 0 0 0 4px #FFC23D, 0 0 14px ${withAlpha("#FFC23D", 0.5)}`
                      : `0 0 0 1.5px ${withAlpha("#C8A0FF", 0.28)}`,
                    ...wallpaperStijl(w.id),
                    backgroundAttachment: "scroll",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* messages */}
        {/* Hetzelfde behang als in je gesprekken: de keuze staat in
            localStorage, dus het is EEN voorkeur voor allebei en niet twee
            instellingen die uit elkaar kunnen lopen. */}
        <div
          ref={listRef}
          className={`zachtscroll ${wallpaperKlasse(behang)}`}
          style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, ...wallpaperStijl(behang) }}
        >
          {chat.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: colors.faint, fontFamily: font.ui, fontSize: 14, maxWidth: 260, lineHeight: 1.5 }}>
              {t("chatEmpty")}
            </div>
          ) : (
            chat.map((m) => {
              const mine = m.player_id === myId;
              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  {mine ? (
                    <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 700, color: colors.gold, padding: "0 4px 2px" }}>
                      {t("chatYou")}
                    </span>
                  ) : (
                    <button
                      onClick={() => mention(m.name)}
                      title={`@${m.name}`}
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: font.ui, fontSize: 11, fontWeight: 700, color: m.color, padding: "0 4px 2px", textDecoration: "underline", textUnderlineOffset: 2 }}
                    >
                      {m.name}
                    </button>
                  )}
                  <div
                    style={{
                      maxWidth: "82%",
                      padding: m.emote || m.image_id ? 4 : m.voice_id ? "8px 12px" : "9px 14px",
                      // Dezelfde pil als in de privéberichten, zodat een bericht
                      // er overal in de app hetzelfde uitziet.
                      borderRadius: m.emote || m.image_id ? 14 : 20,
                      borderTopRightRadius: m.emote || m.image_id ? 14 : mine ? 6 : 20,
                      borderTopLeftRadius: m.emote || m.image_id ? 14 : mine ? 20 : 6,
                      background: m.emote || m.image_id
                        ? "transparent"
                        : mine
                          ? `linear-gradient(180deg, ${withAlpha(colors.gold, 0.22)}, ${withAlpha(colors.gold, 0.12)})`
                          : "linear-gradient(180deg, rgba(24,12,50,.88), rgba(14,7,34,.88))",
                      boxShadow: m.emote || m.image_id
                        ? undefined
                        : mine
                          ? `inset 0 0 0 1.4px ${withAlpha("#FFC23D", 0.75)}, 0 0 12px ${withAlpha("#FFC23D", 0.22)}`
                          : `inset 0 0 0 1.4px ${withAlpha("#A868F5", 0.65)}, 0 0 12px ${withAlpha("#8B45E8", 0.22)}`,
                      color: colors.ink,
                      fontFamily: font.ui,
                      fontSize: 14.5,
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.emote ? (
                      <img src={EMOTE_SRC(m.emote)} alt="" width={84} height={84} style={{ width: 84, height: 84, display: "block", objectFit: "contain" }} />
                    ) : m.image_id ? (
                      // Kaal, zoals een sticker: een stickerknipsel in een pil
                      // met een rand eromheen ziet eruit als een fout.
                      <img
                        src={`/api/image/${roomCode}/${m.image_id}`}
                        alt=""
                        style={{ maxWidth: "100%", maxHeight: 220, width: "auto", height: "auto", display: "block", borderRadius: 12 }}
                      />
                    ) : m.voice_id ? (
                      <VoiceNote src={`/api/voice/${roomCode}/${m.voice_id}`} duration={m.voice_dur ?? 0} mine={mine} />
                    ) : (
                      m.text
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* typing indicator */}
        {typers.length > 0 && (
          <div style={{ padding: "0 16px 6px", fontFamily: font.ui, fontSize: 12.5, fontStyle: "italic", color: colors.faint }}>
            {typers.length === 1 ? t("typingOne", { name: typers[0] }) : t("typingMany", { names: typers.join(", ") })}
            <span style={{ letterSpacing: 1 }}>…</span>
          </div>
        )}

        {/* composer */}
        {emotesOpen && (
          <EmotePicker
            unlocked={new Set(game.state.account?.emote_packs ?? FREE_EMOTE_PACKS)}
            onPick={(id) => { game.sendChat("", undefined, id); setEmotesOpen(false); }}
            onClose={() => setEmotesOpen(false)}
          />
        )}

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
          <button
            type="button"
            onClick={() => { sound.uiTap(); setEmotesOpen((v) => !v); }}
            aria-label={t("emoteTitle")}
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: emotesOpen ? 1 : 0.82,
            }}
          >
            {/* De eerste sticker uit het Blij-pak, kaal. Zie de privéberichten:
                de sticker IS de knop. */}
            <img src={EMOTE_SRC("ce01")} alt="" aria-hidden style={{ width: 38, height: 38, objectFit: "contain", display: "block" }} />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);
              if (v.trim()) signalTyping();
              else stopTyping();
            }}
            placeholder={t("chatPlaceholder")}
            maxLength={280}
            enterKeyHint="send"
            style={{
              flex: 1,
              minWidth: 0,
              // Dezelfde pil als in de privéberichten: rond, met een violette
              // lijn die je ziet. Overal waar je iets zegt hoort hetzelfde vak.
              background: "rgba(6,3,18,.55)",
              border: "none",
              boxShadow: `inset 0 0 0 1px ${withAlpha("#A868F5", draft.trim() ? 0.6 : 0.42)}, 0 0 4px ${withAlpha("#8B45E8", 0.1)}`,
              borderRadius: 999,
              padding: "11px 16px",
              color: colors.ink,
              fontFamily: font.ui,
              fontSize: 15,
              outline: "none",
            }}
          />
          {draft.trim() ? (
            <VerstuurKnop submit label={t("chatSend")} />
          ) : (
            <>
              <BeeldKnop upload={uploadBeeld} onSent={(id) => game.sendChat("", undefined, undefined, id)} />
              <MicButton upload={uploadVoice} onSent={(id, dur) => game.sendChat("", { id, dur })} />
            </>
          )}
        </form>
      </div>
    </div>
  );
}
