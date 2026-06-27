// Lobby — room code, live players (+ bots/spectators), host settings (time incl.
// no-timer, rounds, categories + deelcode, hard letters, max players, spectators),
// testbots, and per-device language + sound toggles.
import { useState } from "react";
import { Check, Copy, Minus, Plus, Volume2, VolumeX, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Toggle } from "../components/Toggle";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { ALL_CATEGORY_KEYS, useT } from "../i18n/i18n";
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

export function Lobby({ game }: { game: GameApi }) {
  const room = game.state.room!;
  const { settings } = room;
  const isHost = game.isHost;
  const { t, tCat, lang, setLang } = useT();
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());
  const [deelInput, setDeelInput] = useState("");
  const [deelErr, setDeelErr] = useState("");
  const [shared, setShared] = useState(false);

  const players = room.players.filter((p) => !p.is_spectator);
  const spectators = room.players.filter((p) => p.is_spectator);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
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

  const customCats = settings.categories.filter((c) => !ALL_CATEGORY_KEYS.includes(c));
  const chipKeys = [...ALL_CATEGORY_KEYS, ...customCats];

  const canStart = isHost && players.length >= 1;

  return (
    <Screen top={<TopBar code={room.code} connected={game.state.status === "open"} />}>
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
          <button
            onClick={() => {
              const v = !soundOn;
              sound.setEnabled(v);
              setSoundOn(v);
              if (v) sound.lock();
            }}
            title={t("sound")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: soundOn ? colors.gold : colors.faint }}
          >
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>

        {/* Room code */}
        <Card style={{ textAlign: "center" }}>
          <SectionLabel>{t("roomcode")}</SectionLabel>
          <button onClick={copyCode} style={{ display: "inline-flex", gap: 8, alignItems: "center", background: "transparent", border: "none", cursor: "pointer" }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 56, letterSpacing: 10, color: colors.gold, textShadow: `0 0 28px ${withAlpha(colors.gold, 0.5)}` }}>
              {room.code}
            </span>
            <span style={{ color: copied ? colors.green : colors.faint }}>{copied ? <Check size={22} /> : <Copy size={20} />}</span>
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
            {[...players, ...spectators].map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={p.name} color={p.color} size={38} crown={p.is_host} dim={!p.connected || p.is_spectator} />
                <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 15, color: colors.ink }}>
                  {p.name}
                  {p.id === game.me?.id && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {p.is_bot && <Badge text="bot" color={colors.violet} />}
                  {p.is_spectator && <Badge text={t("watching")} color={colors.faint} />}
                  {p.is_host && <Badge text={t("host")} color={colors.gold} />}
                  {game.state.isAdmin && p.is_bot && (
                    <button onClick={() => game.removeBot(p.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {game.state.isAdmin && (
            <div style={{ marginTop: 12 }}>
              <Button variant="ghost" onClick={game.addBot}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={16} /> {t("addBot")}
                </span>
              </Button>
            </div>
          )}
        </Card>

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
            <div style={{ display: "flex", gap: 8 }}>
              {ROUNDS.map((r) => (
                <Chip key={r} active={settings.rounds === r} disabled={!isHost} onClick={() => game.updateSettings({ rounds: r })}>
                  {r}
                </Chip>
              ))}
            </div>
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
