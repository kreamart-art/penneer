// Lobby — room code, live players (+ bots/spectators), host settings (time incl.
// no-timer, rounds, categories + deelcode, hard letters, max players, spectators),
// testbots, and per-device language + sound toggles.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, History, Minus, Plus, Send, Share2, UserPlus, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { NeonText } from "../components/NeonText";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { InfoDot } from "../components/InfoDot";
import { MusicToggle } from "../components/MusicToggle";
import { Toggle } from "../components/Toggle";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import { GlasRij, Lijst, ProfileViewModal, ZoekKnop } from "./Hub";
import type { GameApi, PublicUser } from "../net/socket";
import { ALL_CATEGORY_KEYS, subLabelKey, useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { decodeDeelcode, encodeDeelcode } from "../util/deelcode";
import { colors, font, withAlpha } from "../theme/tokens";

const TIMES = [0, 30, 60, 90];
const ROUNDS = [3, 5, 7];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: font.ui, fontSize: 14, color: colors.ink }}>{label}</span>
      {children}
    </div>
  );
}

/** Een persoon in de uitnodigenlijst. Vrienden en oud-medespelers tekenen
 *  hetzelfde, dus dit staat op EEN plek; het enige verschil is een regeltje
 *  eronder met hoe vaak je samen speelde. */
function Rij({
  u, sent, bij, onInvite,
}: {
  u: PublicUser; sent: boolean; bij?: string; onInvite: () => void;
}) {
  const { t } = useT();
  return (
    <GlasRij dun>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar name={u.name} color={u.color} size={28} userId={u.id} hasAvatar={u.has_avatar} avatarVer={u.avatar_ver} />
        <span style={{ position: "absolute", bottom: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: u.online ? colors.green : colors.faint, border: `2px solid ${colors.bg1}` }} />
      </div>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
        {bij && <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{bij}</span>}
      </span>
      {sent ? (
        <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.green }}>{t("inviteSentShort")}</span>
      ) : (
        <button
          onClick={onInvite}
          className="pressable"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
        >
          <Send size={11} /> {t("inviteToRoom")}
        </button>
      )}
    </GlasRij>
  );
}

// Invite online friends into this room (accounts only; guests see nothing).
function InviteFriends({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  const room = game.state.room!;
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!account) return;
    game.refreshFriends();
    game.refreshCoplayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!account]);

  if (!account) return null;
  const inRoom = new Set(room.players.map((p) => p.user_id).filter(Boolean));
  const candidates = game.state.friends.filter((f) => f.status === "accepted" && !inRoom.has(f.id));
  const oud = game.state.coplayers.filter((c) => !inRoom.has(c.id));
  if (candidates.length === 0 && oud.length === 0) return null;
  // Search only earns its place once there are more than three to scroll through.
  const searchable = candidates.length > 3;
  const shown = q.trim() ? candidates.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : candidates;

  return (
    <Card style={{ padding: "11px 7px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, minHeight: 30, paddingInline: 6 }}>
        <span style={{ flex: 1, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, display: "flex", alignItems: "center", gap: 6 }}>
          <UserPlus size={13} /> {candidates.length ? t("inviteFriends") : t("invitePeople")}
        </span>
        {searchable && <ZoekKnop waarde={q} onWaarde={setQ} />}
      </div>
      <Lijst n={shown.length} rij={38} toon={3}>
        {shown.length === 0 && (
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint, padding: "4px 6px" }}>{t("searchNoMatch")}</span>
        )}
        {shown.map((f) => (
          <Rij key={f.id} u={f} sent={!!sent[f.id]} onInvite={() => { game.inviteSend(f.id, "invite"); setSent((s) => ({ ...s, [f.id]: true })); }} />
        ))}
      </Lijst>

      {/* Oud-medespelers. Speel je een leuk potje met iemand die je niet als
          vriend hebt, dan is die daarna onvindbaar: je zou zijn naam moeten
          onthouden, hem opzoeken, een verzoek sturen en wachten tot hij
          accepteert. Hier staat hij gewoon. */}
      {oud.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "13px 6px 8px" }}>
            <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, display: "flex", alignItems: "center", gap: 6 }}>
              <History size={13} /> {t("invitePlayedBefore")}
            </span>
            <span style={{ flex: 1, height: 1, background: colors.hairline }} />
          </div>
          <Lijst n={oud.length} rij={38} toon={3}>
            {oud.map((c) => (
              <Rij
                key={c.id}
                u={c}
                sent={!!sent[c.id]}
                bij={c.samen > 1 ? t("invitePlayedN", { n: c.samen }) : undefined}
                onInvite={() => { game.inviteSend(c.id, "invite"); setSent((s) => ({ ...s, [c.id]: true })); }}
              />
            ))}
          </Lijst>
        </>
      )}
    </Card>
  );
}

export function Lobby({ game }: { game: GameApi }) {
  const room = game.state.room!;
  const { settings } = room;
  const isHost = game.isHost;
  const { t, tCat, lang, setLang } = useT();
  const [copied, setCopied] = useState(false);
  const [deelInput, setDeelInput] = useState("");
  const [deelErr, setDeelErr] = useState("");
  const [shared, setShared] = useState(false);
  // Het profiel van de medespeler op wie je hebt getikt.
  const [viewing, setViewing] = useState<string | null>(null);

  const players = room.players.filter((p) => !p.is_spectator);
  const spectators = room.players.filter((p) => p.is_spectator);

  // Play a join sound when the room grows (not on your own first render).
  const prevCount = useRef(room.players.length);
  useEffect(() => {
    if (room.players.length > prevCount.current) sound.playerJoin();
    prevCount.current = room.players.length;
  }, [room.players.length]);

  // Share just the code + a short message via the native share sheet (WhatsApp
  // etc.). Deliberately NO url: people with the app installed should copy the
  // code into the app, not be sent to the website. On desktop (no share sheet)
  // it copies the code + message to the clipboard instead.
  const shareCode = async () => {
    const text = `${room.code}\n\n${t("shareCodeMsg")}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* user cancelled the share sheet */
      }
      return;
    }
    // Desktop (no share sheet): copy the code + message to the clipboard.
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const toggleCategory = (key: string) => {
    if (!isHost) return;
    const has = settings.categories.includes(key);
    const next = has ? settings.categories.filter((c) => c !== key) : [...settings.categories, key];
    if (next.length < 3 || next.length > 6) return;
    game.updateSettings({ categories: next });
  };

  const loadDeelcode = () => {
    const cats = decodeDeelcode(deelInput);
    if (!cats) {
      setDeelErr(t("badCode"));
      return;
    }
    setDeelErr("");
    setDeelInput("");
    game.updateSettings({ categories: cats });
  };

  const shareDeelcode = async () => {
    try {
      await navigator.clipboard.writeText(encodeDeelcode(settings.categories));
    } catch {
      /* ignore */
    }
    setShared(true);
    setTimeout(() => setShared(false), 1400);
  };

  // Eigen categorieen die JIJ mag aanzetten (gratis, gekocht of zelf gemaakt).
  // Alleen de HOST hoeft ze te bezitten: zodra hij er een aanzet zit hij in
  // room.settings.categories en spelen alle anderen gewoon mee.
  const [myCats, setMyCats] = useState<string[]>([]);
  useEffect(() => {
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/categories", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => setMyCats((d.categories ?? []).filter((c: { owned: boolean }) => c.owned).map((c: { name: string }) => c.name)))
      .catch(() => {});
  }, [game.state.account?.id]);

  const customCats = settings.categories.filter((c) => !ALL_CATEGORY_KEYS.includes(c));
  const ownedExtra = myCats.filter((c) => !ALL_CATEGORY_KEYS.includes(c) && !customCats.includes(c));
  const chipKeys = [...ALL_CATEGORY_KEYS, ...customCats, ...(isHost ? ownedExtra : [])];

  const canStart = isHost && players.length >= 1;
  const isCustomRounds = !ROUNDS.includes(settings.rounds);

  return (
    <Screen top={<TopBar code={room.code} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* language + sound (per device) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["nl", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  fontFamily: font.ui,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  padding: "5px 11px",
                  borderRadius: 999,
                  cursor: "pointer",
                  color: lang === l ? colors.bg0 : colors.sub,
                  background: lang === l ? colors.gold : "transparent",
                  border: `1px solid ${lang === l ? "transparent" : colors.panelBorder}`,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <MusicToggle />
        </div>

        {/* Room code */}
        <Card style={{ textAlign: "center" }}>
          <SectionLabel>{t("roomcode")}</SectionLabel>
          <button onClick={shareCode} aria-label={t("shareCode")} style={{ display: "inline-flex", gap: 8, alignItems: "center", background: "transparent", border: "none", cursor: "pointer" }}>
            {/* De code die je doorgeeft, met dezelfde behandeling als de letter
                op de rol: een gouden verloop over de letters met de gloed als
                vervaagde kopie erachter. Op dit formaat leest dat als metaal;
                klein zou hetzelfde verloop de letters juist dof maken. */}
            <NeonText
              accent={colors.gold}
              blur={20}
              glow={0.7}
              style={{ fontFamily: font.display, fontWeight: 700, fontSize: 56, letterSpacing: 10, lineHeight: 1 }}
            >
              {room.code}
            </NeonText>
            <span style={{ color: copied ? colors.green : colors.faint }}>{copied ? <Check size={22} /> : <Share2 size={21} />}</span>
          </button>
          <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 13, color: colors.sub }}>{t("codeHint")}</p>
        </Card>

        {/* Players */}
        <Card>
          <SectionLabel>
            {t("inRoom")} · {players.length}
            {spectators.length > 0 ? ` (+${spectators.length})` : ""}
          </SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...players, ...spectators].map((p) => {
              // Tik op een medespeler en je ziet zijn korte profiel: level,
              // statistieken, onderling resultaat, prestaties. Alleen voor wie
              // een account heeft; een gast of een bot heeft niets te tonen.
              const opent = !!p.user_id && !p.is_bot;
              return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() => { if (!opent) return; sound.uiTap(); game.viewProfile(p.user_id!); setViewing(p.user_id!); }}
                  disabled={!opent}
                  aria-label={p.name}
                  style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: opent ? "pointer" : "default" }}
                >
                <Avatar name={p.name} color={p.color} size={38} crown={p.is_host} dim={!p.connected || p.is_spectator} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} frame={p.frame} />
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 15, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                    {p.id === game.me?.id && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                  </span>
                  {(() => {
                    const sub = subLabelKey(p.title, p.rank);
                    return sub ? (
                      <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>
                        {t(sub)} · lvl {p.level}
                      </span>
                    ) : null;
                  })()}
                </div>
                </button>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {p.is_bot && <Badge text="bot" color={colors.violet} />}
                  {p.is_spectator && <Badge text={t("watching")} color={colors.faint} />}
                  {p.is_host && <Badge text={t("host")} color={colors.gold} />}
                  {isHost && p.is_bot && (
                    <button onClick={() => game.removeBot(p.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          {/* Computer players only exist in a room started from "Tegen de
              computer"; a room made to play with friends never offers them. */}
          {isHost && room.settings.cpu_game && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <Button variant="ghost" onClick={() => { sound.uiTap(); game.addBot(); }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={16} /> {t("addBot")}
                </span>
              </Button>
              <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>{t("addBotHint")}</p>
            </div>
          )}
        </Card>

        <InviteFriends game={game} />

        {/* Settings */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <SectionLabel>{t("timePerRound")}</SectionLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TIMES.map((tm) => (
                <Chip key={tm} active={settings.round_time === tm} disabled={!isHost} onClick={() => game.updateSettings({ round_time: tm })}>
                  {tm === 0 ? t("noTimer") : `${tm}s`}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>{t("roundsLabel")}</SectionLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {ROUNDS.map((r) => (
                <Chip key={r} active={settings.rounds === r} disabled={!isHost} onClick={() => game.updateSettings({ rounds: r })}>
                  {r}
                </Chip>
              ))}
              <Chip active={isCustomRounds} disabled={!isHost} onClick={() => { if (!isCustomRounds) game.updateSettings({ rounds: 10 }); }}>
                {t("roundsCustom")}
              </Chip>
              {isCustomRounds && (
                <Stepper value={settings.rounds} min={2} max={20} disabled={!isHost} onChange={(v) => game.updateSettings({ rounds: v })} />
              )}
            </div>
            {isCustomRounds && (
              <p style={{ margin: "8px 0 0", fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("roundsCustomHint")}</p>
            )}
          </div>
          <div>
            <SectionLabel>{t("categoriesLabel")}</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {chipKeys.map((key) => (
                <Chip key={key} active={settings.categories.includes(key)} disabled={!isHost} onClick={() => toggleCategory(key)}>
                  {ALL_CATEGORY_KEYS.includes(key) ? tCat(key) : key}
                </Chip>
              ))}
            </div>
          </div>

          {/* Deelcode */}
          <div>
            <SectionLabel>{t("customCats")}</SectionLabel>
            {isHost && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={deelInput}
                  onChange={(e) => setDeelInput(e.target.value)}
                  placeholder={t("pasteCode")}
                  style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13, color: colors.ink, background: withAlpha("#000000", 0.25), border: `1.5px solid ${colors.panelBorder}`, borderRadius: 10, padding: "9px 12px" }}
                />
                <Button variant="ghost" onClick={loadDeelcode}>
                  {t("load")}
                </Button>
              </div>
            )}
            {deelErr && <p style={{ color: colors.red, fontFamily: font.ui, fontSize: 12, margin: "0 0 8px" }}>{deelErr}</p>}
            <Button variant="ghost" onClick={shareDeelcode}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {shared ? <Check size={15} /> : <Copy size={15} />} {shared ? t("copied") : t("shareCats")}
              </span>
            </Button>
          </div>

          {/* booleans + max players */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Row label={t("hardLetters")}>
              <Toggle on={settings.hard_letters} disabled={!isHost} onChange={(v) => game.updateSettings({ hard_letters: v })} />
            </Row>
            <Row label={t("allowSpectators")}>
              <Toggle on={settings.allow_spectators} disabled={!isHost} onChange={(v) => game.updateSettings({ allow_spectators: v })} />
            </Row>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.ui, fontSize: 14, color: colors.ink }}>
                {t("lenientSpelling")}
                <InfoDot title={t("lenientSpelling")} text={t("lenientSpellingHint")} />
              </span>
              <Toggle on={settings.lenient_spelling} disabled={!isHost} onChange={(v) => game.updateSettings({ lenient_spelling: v })} />
            </div>
            <Row label={t("maxPlayers")}>
              <Stepper
                value={settings.max_players}
                min={Math.max(2, players.length)}
                max={16}
                disabled={!isHost}
                onChange={(v) => game.updateSettings({ max_players: v })}
              />
            </Row>
          </div>
        </Card>

        {isHost ? (
          <Button variant="gold" full disabled={!canStart} onClick={game.startGame}>
            {t("startGame")}
          </Button>
        ) : (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.sub }}>{game.isSpectator ? t("spectatorNote") : t("waitHost")}</p>
        )}
        <Button variant="ghost" full onClick={game.leaveRoom}>
          {t("leaveRoom")}
        </Button>
      </div>
      {viewing && <ProfileViewModal game={game} userId={viewing} onClose={() => setViewing(null)} />}
    </Screen>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, color, padding: "2px 8px", borderRadius: 999, background: withAlpha(color, 0.14) }}>
      {text}
    </span>
  );
}

function Stepper({ value, min, max, disabled, onChange }: { value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void }) {
  const btn = (icon: React.ReactNode, delta: number, off: boolean) => (
    <button
      onClick={() => !disabled && !off && onChange(Math.max(min, Math.min(max, value + delta)))}
      disabled={disabled || off}
      style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${colors.panelBorder}`, background: withAlpha("#000000", 0.2), color: colors.ink, cursor: disabled || off ? "default" : "pointer", display: "grid", placeItems: "center", opacity: off ? 0.4 : 1 }}
    >
      {icon}
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {btn(<Minus size={15} />, -1, value <= min)}
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink, width: 22, textAlign: "center" }}>{value}</span>
      {btn(<Plus size={15} />, 1, value >= max)}
    </div>
  );
}
