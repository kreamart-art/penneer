// Lobby — room code, live players (+ bots/spectators), host settings (time incl.
// no-timer, rounds, categories + deelcode, hard letters, max players, spectators),
// testbots, and per-device language + sound toggles.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, History, Minus, Plus, Share2, UserPlus, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { BredeKnop } from "../components/BredeKnop";
import { Chip } from "../components/Chip";
import { InfoDot } from "../components/InfoDot";
import { Toggle } from "../components/Toggle";
import { TeamKnop } from "../components/Teams";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import { GlasRij, ProfileViewModal, ZoekKnop } from "./Hub";
import { GoudKader } from "../components/GoudKader";
import { Tv } from "../components/Tv";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { GlasVeld } from "../components/GlasVeld";
import { KnopPlaat } from "../components/KnopPlaat";
import type { GameApi, PublicUser } from "../net/socket";
import { ALL_CATEGORY_KEYS, subLabelKey, useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { decodeDeelcode, encodeDeelcode } from "../util/deelcode";
import { colors, font, withAlpha } from "../theme/tokens";

const TIMES = [0, 30, 60, 90];
const ROUNDS = [3, 5, 7];

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 10, ...style }}>
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
        <Avatar name={u.name} color={u.color} size={28} userId={u.id} hasAvatar={u.has_avatar} avatarVer={u.avatar_ver} divisie={u.divisie} />
        <span style={{ position: "absolute", bottom: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: u.online ? colors.green : colors.faint, border: `2px solid ${colors.bg1}` }} />
      </div>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
        {bij && <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{bij}</span>}
      </span>
      {sent ? (
        <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.green }}>{t("inviteSentShort")}</span>
      ) : (
        <KnopPlaat breed={88} onClick={onInvite} label={t("inviteToRoom")} />
      )}
    </GlasRij>
  );
}

/** Het kopje boven een lijstje in de popup. */
function Kopje({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, display: "flex", alignItems: "center", gap: 6 }}>
      {children}
    </span>
  );
}

// Vrienden uitnodigen (alleen met een profiel; een gast ziet hier niets).
//
// EEN KNOP EN EEN POPUP, en niet meer een sectie in de lobby zelf. De lijst met
// vrienden plus die met oud-medespelers besloeg een half scherm, terwijl je hem
// hooguit één keer per potje nodig hebt: je nodigt uit en dan ben je klaar. In
// de lobby staat nu alleen de knop, en de lijst komt erboven te liggen op het
// moment dat je hem vraagt.
function InviteFriends({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  const room = game.state.room!;
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!account) return;
    game.refreshFriends();
    game.refreshCoplayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!account]);

  // Escape sluit hem ook. De knop en de tik naast het venster doen hetzelfde;
  // dit is er voor wie op een toetsenbord speelt.
  useEffect(() => {
    if (!open) return;
    const toets = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", toets);
    return () => window.removeEventListener("keydown", toets);
  }, [open]);

  if (!account) return null;
  const inRoom = new Set(room.players.map((p) => p.user_id).filter(Boolean));
  const candidates = game.state.friends.filter((f) => f.status === "accepted" && !inRoom.has(f.id));
  const oud = game.state.coplayers.filter((c) => !inRoom.has(c.id));
  if (candidates.length === 0 && oud.length === 0) return null;
  // Search only earns its place once there are more than three to scroll through.
  const searchable = candidates.length > 3;
  const shown = q.trim() ? candidates.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : candidates;
  const nodig = (id: string) => { game.inviteSend(id, "invite"); setSent((s) => ({ ...s, [id]: true })); };
  const titel = candidates.length ? t("inviteFriends") : t("invitePeople");

  return (
    <>
      {/* KAAL, geen plaat en geen pil. Hij staat op de regel van het kopje, en
          een knop met een eigen achtergrond zou daar de zwaarste vorm in de
          hele kaart zijn terwijl het maar een ingang is. Goud omdat het kopje
          ernaast grijs is: in dezelfde tint zou hij niet als knop lezen. */}
      <button
        onClick={() => { sound.uiTap(); setOpen(true); }}
        className="pressable"
        style={{
          flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.4,
          color: colors.gold, whiteSpace: "nowrap",
        }}
      >
        <UserPlus size={14} /> {titel}
      </button>

      {open && (
        <div
          onClick={() => { sound.uiTap(); setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 94,
            background: "rgba(6,3,18,.82)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
            display: "grid", placeItems: "center", padding: 18,
          }}
        >
          {/* De achthoek van de voortgangssectie op Ontdekken, met dezelfde
              gouden hoeken en lichtpunten. Alleen de binnenkant is anders: daar
              zit art in plaats van het verloop, op de vorm geknipt. */}
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360 }}>
            <GoudKader
              hoek={13} kleur="violet" dik={0.6} gloed
              vullingArt="/ui/profile-bg.webp"
              binnenlijn hoekAccent="#F3B53E" puntjes padding={12}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, minHeight: 30 }}>
                <Kopje>
                  <UserPlus size={13} /> {titel}
                </Kopje>
                <span style={{ flex: 1 }} />
                {searchable && <ZoekKnop waarde={q} onWaarde={setQ} />}
                <button
                  onClick={() => { sound.uiTap(); setOpen(false); }}
                  aria-label={t("ontdekkenSluiten")}
                  className="pressable"
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: colors.faint, display: "flex", lineHeight: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* EEN scroller en niet één per lijstje: twee schuifvakken onder
                  elkaar in een venster dat zelf al kan schuiven is niet te
                  bedienen met een duim. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "min(64vh, 520px)", overflowY: "auto", overscrollBehavior: "contain" }}>
                {shown.length === 0 && (
                  <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint, padding: "4px 2px" }}>{t("searchNoMatch")}</span>
                )}
                {shown.map((f) => (
                  <Rij key={f.id} u={f} sent={!!sent[f.id]} onInvite={() => nodig(f.id)} />
                ))}

                {/* Oud-medespelers. Speel je een leuk potje met iemand die je
                    niet als vriend hebt, dan is die daarna onvindbaar: je zou
                    zijn naam moeten onthouden, hem opzoeken, een verzoek sturen
                    en wachten tot hij accepteert. Hier staat hij gewoon. */}
                {oud.length > 0 && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "7px 0 1px" }}>
                      <Kopje>
                        <History size={13} /> {t("invitePlayedBefore")}
                      </Kopje>
                      <span style={{ flex: 1, height: 1, background: colors.hairline }} />
                    </div>
                    {oud.map((c) => (
                      <Rij
                        key={c.id}
                        u={c}
                        sent={!!sent[c.id]}
                        bij={c.samen > 1 ? t("invitePlayedN", { n: c.samen }) : undefined}
                        onInvite={() => nodig(c.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            </GoudKader>
          </div>
        </div>
      )}
    </>
  );
}

export function Lobby({ game }: { game: GameApi }) {
  const room = game.state.room!;
  const { settings } = room;
  const isHost = game.isHost;
  const { t, tCat } = useT();
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

  // De lobby, de dagronde en het oefenen delen hetzelfde decor: de arena met de
  // gouden hoekstukken en de horizon die oplicht.
  useEffect(() => {
    document.body.classList.add("arena");
    return () => document.body.classList.remove("arena");
  }, []);

  const canStart = isHost && players.length >= 1;
  const isCustomRounds = !ROUNDS.includes(settings.rounds);

  return (
    <Screen top={<TopBar code={room.code} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* De NL/EN-pil stond hier en is eruit: je taal kies je bij het
            binnenkomen en daarna staat hij in Instellingen. In een lobby waar
            je op mensen wacht is het geen keuze die je nog maakt, en hij nam de
            hele bovenregel in beslag. */}
        {/* De roomcode staat op de TV, dezelfde als in een ronde en in Oefenen.
            Het is het enige op dit scherm dat je aan iemand anders geeft, dus
            het mag het grootste ding zijn dat er staat.
            Een tik erop opent het deelblad; het deel-teken staat eronder, want
            op het scherm zelf zou het naast de code komen te staan en dan is
            de code niet meer het midden. */}
        <div>
          <Tv
            code={room.code}
            label={t("roomcode")}
            onClick={shareCode}
            knopLabel={t("shareCode")}
            onder={t("codeHint")}
            naast={
              <span style={{ color: copied ? colors.green : colors.faint, display: "flex" }}>
                {copied ? <Check size={22} /> : <Share2 size={21} />}
              </span>
            }
          />
        </div>

        {/* Players */}
        <Card>
          {/* Het kopje en de uitnodigen-link op EEN regel. Een knop op volle
              breedte onder de lijst kostte een hele regel voor iets wat je
              hooguit één keer per potje doet; hier staat hij naast het kopje
              waar hij over gaat, en hij eet geen hoogte. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <SectionLabel style={{ flex: 1, marginBottom: 0 }}>
              {t("inRoom")} · {players.length}
              {spectators.length > 0 ? ` (+${spectators.length})` : ""}
            </SectionLabel>
            <InviteFriends game={game} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginInline: -11 }}>
            {[...players, ...spectators].map((p) => {
              // Tik op een medespeler en je ziet zijn korte profiel: level,
              // statistieken, onderling resultaat, prestaties. Alleen voor wie
              // een account heeft; een gast of een bot heeft niets te tonen.
              const opent = !!p.user_id && !p.is_bot;
              return (
              <GlasRij key={p.id}>
                <button
                  onClick={() => { if (!opent) return; sound.uiTap(); game.viewProfile(p.user_id!); setViewing(p.user_id!); }}
                  disabled={!opent}
                  aria-label={p.name}
                  style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: opent ? "pointer" : "default" }}
                >
                <Avatar name={p.name} color={p.color} size={34} crown={p.is_host} dim={!p.connected || p.is_spectator} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} frame={p.frame} divisie={p.divisie} />
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
                  {!!(settings.teams ?? 0) && !p.is_spectator && (
                    <TeamKnop
                      team={p.team ?? 0}
                      aantal={settings.teams ?? 0}
                      mag={p.id === game.me?.id || isHost}
                      onWissel={(next) => game.setTeam(next, p.id === game.me?.id ? undefined : p.id)}
                    />
                  )}
                  {p.is_bot && <Badge text="bot" color={colors.violet} />}
                  {p.is_spectator && <Badge text={t("watching")} color={colors.faint} />}
                  {p.is_host && <Badge text={t("host")} color={colors.gold} />}
                  {isHost && p.is_bot && (
                    <button onClick={() => game.removeBot(p.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              </GlasRij>
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
                <GlasVeld
                  gevuld={!!deelInput.trim()}
                  value={deelInput}
                  onChange={(e) => setDeelInput(e.target.value)}
                  placeholder={t("pasteCode")}
                  kaderStyle={{ flex: 1, minWidth: 0 }}
                  style={{ fontSize: 13, padding: "9px 11px" }}
                />
                <KnopPlaat breed={86} kleur="paars" onClick={loadDeelcode} label={t("load")} />
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
            {/* Samen tegen samen. Staat bij de schakelaars en niet bij de
                categorieen, want het verandert niet WAT je speelt maar tegen
                WIE. Een getal en geen aan/uit: met zes man wil je soms drie
                kampen in plaats van twee van drie. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.ui, fontSize: 14, color: colors.ink }}>
                {t("teamsLabel")}
                <InfoDot title={t("teamsLabel")} text={t("teamsHint")} />
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 2, 3].map((n) => (
                  <Chip key={n} active={(settings.teams ?? 0) === n} disabled={!isHost} onClick={() => game.updateSettings({ teams: n })}>
                    {n === 0 ? t("teamsOff") : String(n)}
                  </Chip>
                ))}
              </div>
            </div>
            {isHost && (settings.teams ?? 0) > 0 && (
              <Button variant="ghost" onClick={() => { sound.uiTap(); game.verdeelTeams(); }}>
                {t("teamShuffle")}
              </Button>
            )}
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
          // Dezelfde brede gouden plaat als op de dagronde: dit is de knop
          // waarmee een potje begint, en die hoort er overal hetzelfde uit te
          // zien.
          <BredeKnop disabled={!canStart} onClick={game.startGame}>
            {t("startGame").toUpperCase()}
          </BredeKnop>
        ) : (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.sub }}>{game.isSpectator ? t("spectatorNote") : t("waitHost")}</p>
        )}
        {/* Zo breed als zijn eigen tekst: een knop die iets ongedaan maakt hoort
            niet net zo groot te zijn als de knop waarmee je begint. */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <NeonKader radius={999} dik={0.5} vulling="zwart" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
            <button
              onClick={game.leaveRoom}
              className="pressable"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 18px" }}
            >
              {t("leaveRoom")}
            </button>
          </NeonKader>
        </div>
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
