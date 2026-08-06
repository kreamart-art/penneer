// Fill — everyone types at once on one server clock (or open-ended in no-timer
// mode). Active player owns "Pen neer"; others can flag "Ik ben klaar"; the
// spelleider sees how many are ready. Spectators watch read-only.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Tv } from "../components/Tv";
import { Timer } from "../components/Timer";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { useToetsenbordOp } from "../lib/veldinbeeld";
import { RodeKnop } from "../components/RodeKnop";
import { KreetKiezer } from "../components/Kreten";
import { KreetZwever } from "../components/KreetZwever";
import { colors, font, withAlpha } from "../theme/tokens";

export function Fill({ game }: { game: GameApi }) {
  const { t, tCat } = useT();
  const room = game.state.room!;
  const cats = room.settings.categories;
  const letter = room.round?.letter ?? "";
  const active = room.players.find((p) => p.id === room.active_player_id);
  const others = room.players.filter((p) => p.id !== game.me?.id && !p.is_spectator);
  const noTimer = (room.timer.duration ?? room.settings.round_time) === 0;
  const isSpectator = game.isSpectator;
  // Left the room mid-round and came back: sit this exact round out.
  const satOut = !!(game.me && (room.sat_out ?? []).includes(game.me.id));
  const playingCount = room.players.filter((p) => !p.is_spectator).length;
  const readyCount = room.ready_ids.length;
  const iAmReady = !!(game.me && room.ready_ids.includes(game.me.id));

  const initial = useMemo(() => Object.fromEntries(cats.map((c) => [c, ""])), [cats]);
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const change = (cat: string, value: string) => {
    const next = { ...answers, [cat]: value };
    setAnswers(next);
    game.updateAnswers(next);
  };

  // Submit the complete final answers the moment the server ends the fill
  // phase (even untouched fields), so nothing is lost and scoring isn't delayed.
  const token = game.state.roundEndedToken;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    if (token > 0) game.submitAnswers(answersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // The round ended while this fill was on screen (the token moved during THIS
  // mount): freeze the inputs so typing past the buzzer visibly does nothing.
  const mountToken = useRef(token);
  const roundOver = token > mountToken.current;

  // tick.mp3 is one clean beep; the Timer fires onTick exactly when the shown
  // number changes, so one beep per second stays in sync with the countdown.
  const onTick = (secs: number) => {
    if (secs <= 10 && secs > 0) sound.tick();
  };

  // Floating bottom button: with a timer the TIMER ends the round, so there is
  // no stop button — only "Geen tijd" gives the spelleider the "Pen neer" stop.
  // Everyone else (and the spelleider in timed mode) gets "Ik ben klaar".
  // Zolang je TYPT hoort de zwevende knop er niet te zijn. Hij hangt vast aan de
  // onderkant van de pagina, en die zit met een toetsenbord ergens achter dat
  // toetsenbord: dan ligt zijn donkere band precies over de vakjes waar je in
  // typt. Zodra het toetsenbord weg is staat hij er weer, en tot die tijd komt
  // een ingevuld laatste vakje met Enter ook binnen.
  const toetsenbordOp = useToetsenbordOp();
  const mag = !isSpectator && !satOut && !roundOver;
  const showFloatingStop = mag && game.isActive && noTimer && !toetsenbordOp;
  const showFloatingReady = mag && !(game.isActive && noTimer) && !toetsenbordOp;

  return (
    <Screen top={<TopBar code={room.code} roundNo={room.round_no} totalRounds={room.settings.rounds} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      {/* De kreet van wie klaar gaat, als ballon links in beeld. Zonder dit las
          alleen de uitzending hem, en zat wie aan het typen was er precies naast
          op het moment dat het ertoe doet. */}
      <KreetZwever game={game} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: mag ? 104 : 0 }}>
        {/* De letter op de TV, dezelfde als in de lobby en in Oefenen. De klok
            staat eronder en niet erop: op het scherm zou hij naast de letter om
            aandacht vragen, terwijl de letter is waar je naar kijkt. */}
        <div>
          <Tv letter={letter} label={t("letterIs")} />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            {noTimer ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, lineHeight: 1, color: colors.violet }}>∞</div>
                <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
                  {game.isActive ? t("noLimitYou") : t("noLimitX", { name: active?.name ?? "?" })}
                </span>
              </div>
            ) : (
              // Timed mode: the countdown speaks for itself, nobody keeps time.
              <div style={{ width: "72%" }}>
                <Timer endsAt={room.timer.ends_at} duration={room.timer.duration} onTick={onTick} />
              </div>
            )}
          </div>
        </div>

        {/* other players + ready state */}
        {others.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {others.map((p, i) => {
              const ready = room.ready_ids.includes(p.id);
              return (
                <div key={p.id} style={{ position: "relative", animation: ready ? undefined : `fill-pulse 1.8s ease-in-out ${i * 0.18}s infinite` }}>
                  <Avatar name={p.name} color={p.color} size={30} dim={!p.connected} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} divisie={p.divisie} />
                  {ready && (
                    <span style={{ position: "absolute", bottom: -3, right: -3, background: colors.green, borderRadius: "50%", width: 14, height: 14, display: "grid", placeItems: "center", boxShadow: `0 0 6px ${colors.green}` }}>
                      <Check size={10} color={colors.bg0} strokeWidth={3} />
                    </span>
                  )}
                </div>
              );
            })}
            <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("fillingToo")}</span>
          </div>
        )}

        {/* sat out: left mid-round, back in from the next round */}
        {satOut && (
          <Card style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("satOutTitle")}</span>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("satOutBody")}</p>
          </Card>
        )}

        {/* inputs (players only) */}
        {/* inputs (players only) */}
        {!isSpectator && !satOut && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cats.map((cat, i) => (
              <div key={cat}>
                <label style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: colors.faint, marginLeft: 4 }}>{tCat(cat)}</label>
                {/* Het veld met een pijl erin: naar het volgende vakje zonder
                    het toetsenbord weg te tikken. Op de laatste staat hij niet,
                    want daar is geen volgende. */}
                <div style={{ position: "relative" }}>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={answers[cat] ?? ""}
                  readOnly={roundOver}
                  onChange={(e) => {
                    if (!roundOver) change(cat, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const volgende = inputs.current[i + 1];
                    if (volgende) { volgende.focus(); return; }
                    // Laatste vakje: melden dat je klaar bent, want de zwevende
                    // knop staat er niet zolang het toetsenbord er is.
                    e.currentTarget.blur();
                    if (mag && !(game.isActive && noTimer) && !iAmReady) {
                      sound.ready();
                      game.setReady(true);
                    }
                  }}
                  autoComplete="off"
                  name={`vak${i + 1}`}
                  inputMode="text"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("fillPlaceholder", { cat: tCat(cat), letter })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 4,
                    fontFamily: font.ui,
                    fontSize: 16,
                    color: colors.ink,
                    background: withAlpha("#000000", 0.28),
                    border: "none",
                    // Een PIL, geen afgeschuinde plaat. Een invoerveld is waar je
                    // in TYPT, en dat is de vorm van een tekstregel; de
                    // afgeschuinde hoek is de vorm van een lijstrij en las hier
                    // als een knop. De lijn licht op zodra er iets in staat: dat
                    // is het enige verschil tussen leeg en gevuld, en genoeg.
                    borderRadius: 999,
                    boxShadow: `inset 0 0 0 1.5px ${answers[cat] ? withAlpha(colors.gold, 0.55) : withAlpha("#C8A0FF", 0.22)}`,
                    padding: i + 1 < cats.length ? "12px 46px 12px 18px" : "12px 18px",
                    transition: "box-shadow .12s ease",
                  }}
                />
                {i + 1 < cats.length && !roundOver && (
                  <button
                    type="button"
                    aria-label={t("volgendeVeld")}
                    onClick={() => inputs.current[i + 1]?.focus()}
                    style={{
                      position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                      width: 34, height: 34, display: "grid", placeItems: "center",
                      borderRadius: 999, border: "none", cursor: "pointer",
                      background: withAlpha("#C8A0FF", 0.12), color: colors.sub,
                    }}
                  >
                    <ChevronDown size={18} />
                  </button>
                )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* controls (the action itself is the floating button below) */}
        {satOut ? null : isSpectator ? (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub, margin: "4px 0 0" }}>{t("spectatorNote")}</p>
        ) : game.isActive && noTimer ? (
          readyCount > 0 && (
            <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>{t("readyCount", { n: readyCount, total: playingCount })}</p>
          )
        ) : (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.sub, margin: "2px 0 0", lineHeight: 1.5 }}>
            {iAmReady ? t("youReady") : noTimer ? t("xStopsTime", { name: active?.name ?? "?" }) : t("fillFast")}
          </p>
        )}
      </div>

      {/* Floating "Pen neer" (spelleider) — always reachable, also with a timer */}
      {showFloatingStop && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
            paddingTop: 26,
            background: `linear-gradient(0deg, ${colors.bg0} 55%, transparent)`,
            pointerEvents: "none",
          }}
        >
          <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 18px", pointerEvents: "auto" }}>
            {/* No local click sound: the buzzer plays for EVERYONE (presser
                included) off the server's round_ended broadcast, in App. */}
            <RodeKnop onClick={() => { sound.haptic([15, 40, 15]); game.stopRound(); }}>
              {t("penNeer")}
            </RodeKnop>
          </div>
        </div>
      )}

      {/* Floating ready button (non-active players) so everyone notices it */}
      {showFloatingReady && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
            paddingTop: 26,
            background: `linear-gradient(0deg, ${colors.bg0} 55%, transparent)`,
            pointerEvents: "none",
          }}
        >
          {/* De klaarknop met het kreetteken ernaast. Het teken is klein en staat
              rechts: de knop blijft de daad, de kreet is de franje. Zie
              components/Kreten.tsx. */}
          {/* Even veel ruimte LINKS als het kreetteken rechts inneemt. Zonder
              die tegenwicht staat de knop de breedte van dat teken uit het hart,
              en dat zie je meteen aan een knop die de hele breedte pakt. */}
          <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 18px", pointerEvents: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 44, flexShrink: 0 }} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Button
                variant={iAmReady ? "ghost" : "gold"}
                full
                onClick={() => { if (!iAmReady) { sound.ready(); sound.haptic(12); } game.setReady(!iAmReady); }}
                style={iAmReady ? undefined : { animation: "fill-pulse 1.8s ease-in-out infinite" }}
              >
                {iAmReady ? t("notYet") : t("imReady")}
              </Button>
            </div>
            <KreetKiezer
              onKies={(kreet) => {
                // Een kreet kiezen IS klaar gaan, met die zin erbij. Wie al
                // klaar stond wisselt alleen van zin.
                if (!iAmReady) { sound.ready(); sound.haptic(12); }
                game.setReady(true, kreet);
              }}
            />
          </div>
        </div>
      )}
    </Screen>
  );
}
