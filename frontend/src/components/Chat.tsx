// In-room chat: a bubble button (with unread badge) that opens a bottom-sheet
// panel. Lets players ask what a word means without leaving the app. Lives in
// the TopBar, so it's reachable on every in-room screen.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./CloseIcon";
import { TelHex } from "./TelHex";
import { ChatIcoon } from "./ChatIcoon";
import { WALLPAPERS, wallpaperKlasse, wallpaperStijl, wallpaperVan, wallpaperZet, type WallpaperId } from "./Wallpaper";
import type { ChatMessage, GameApi } from "../net/socket";
import { MicButton } from "./MicButton";
import { BeeldKnop } from "./BeeldKnop";
import { VerstuurKnop } from "./VerstuurKnop";
import { KNOP_GOUD_VERLOOP, goudHaarlijn } from "./GlasKnop";
import { CANVAS, useCanvasKleur } from "../lib/canvaskleur";
import { useBlijfOnderaan, useVakLaag, useZichtbaarVak } from "../lib/zichtbaarvak";
import { AntwoordBalk, BerichtHuls, Citaat, citaatTekst } from "./Berichtgebaren";
import { Livestream } from "./Livestream";
import { VoiceNote } from "./VoiceNote";
import { EmotePicker } from "./EmotePicker";
import { EMOTE_SRC, FREE_EMOTE_PACKS } from "./emotes";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** Hoeveel van het scherm de lade pakt zolang er een uitzending boven staat. */
const LADE_PROCENT = 66;
const LADE_MAXHOOGTE = 580;
const LADE_HOOGTE = `min(${LADE_PROCENT}vh, ${LADE_MAXHOOGTE}px)`;
/** Onder deze hoogte is een uitzending geen venster meer maar een reepje. */
const STREAM_MINIMUM = 140;

export function ChatButton({ game }: { game: GameApi }) {
  const { t } = useT();
  const chat = game.state.chat;
  const open = game.state.chatOpen;
  const unread = open ? 0 : Math.max(0, chat.length - game.state.chatSeen);

  return (
    <>
      <button
        onClick={() => game.openChat()}
        aria-label={t("chat")}
        title={t("chat")}
        className="pressable"
        style={{
          position: "relative",
          background: "transparent",
          border: "none",
          cursor: "pointer",
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
      {/* Het paneel gaat rechtstreeks onder de BODY hangen en niet hier, waar de
          knop staat. De knop zit in de bovenbalk, en die bovenbalk is een eigen
          stapelcontext; alles wat erin staat blijft daarbinnen, hoe hoog je zijn
          z-index ook zet. De rol en de draaiknop van de rol-pagina zitten in een
          BUURcontext die later in het document komt, en die won daardoor altijd:
          precies de skins en objecten die over de chat heen kwamen. Vanaf de
          body is er niets meer om onder te liggen. */}
      {open && createPortal(<ChatPanel game={game} onClose={() => game.closeChat()} />, document.body)}
    </>
  );
}

/** Hangt dit bericht KAAL in de lijst, zonder pil eromheen? Een sticker of een
 *  foto wel, want een knipsel in een pil met een rand eromheen ziet eruit als
 *  een fout. Staat er een citaat boven, dan niet: dat citaat heeft iets nodig
 *  om op te liggen. */
const kaal = (m: ChatMessage) => !!(m.emote || m.image_id) && !m.reply;

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
  // De gouden ring om de lade gaat weg zodra het TOETSENBORD op staat, en komt
  // terug zodra je het wegtikt. Tijdens het typen is de lade geen voorwerp meer
  // dat over het spel ligt maar het enige waar je naar kijkt, en dan is een
  // lijst eromheen alleen nog een streep tussen jou en je bericht. De gouden
  // strepen tussen de stroken blijven wel: die verdelen de lade, ze omlijsten
  // hem niet.
  //
  // Op het TOETSENBORD en niet op de focus van het invulveld: de chat zet die
  // focus zelf al bij het openen, dus op focus was de ring meteen weg voordat
  // je ook maar iets gedaan had.
  const vak = useZichtbaarVak();
  const { laag, onder } = useVakLaag();
  // Waar je op gaat antwoorden, of niets. Blijft staan tot je verstuurt of het
  // kruisje raakt, want tussendoor mag je gewoon je zin afmaken.
  const [antwoord, setAntwoord] = useState<ChatMessage | null>(null);
  // De strook onder de pagina krijgt de kleur van de invulbalk: op iOS valt de
  // onderrand van het scherm soms buiten de pagina, en dan hoort daar de balk
  // door te lopen en niet het decor van het scherm erachter.
  useCanvasKleur(CANVAS.chat);
  // Past er nog een uitzending boven de lade?
  //
  // De schermhoogte wordt ÉÉN keer gemeten, bij het openen van de chat. Op iOS
  // krimpt `clientHeight` in de geïnstalleerde app mee met het toetsenbord (zie
  // lib/zichtbaarvak.ts), dus een verse meting zou zeggen dat het scherm ineens
  // 450 hoog is, dat de lade dus 300 wil zijn, en dat er dus nog ruimte over is
  // voor een uitzending. Precies het strookje dat er niet hoort te staan. Deze
  // maat is bovendien waar de 66vh hieronder toch al tegen afgezet wordt, en
  // die verandert niet omdat er een toetsenbord opkomt.
  const [scherm] = useState(() => document.documentElement.clientHeight || window.innerHeight);
  const ladeWil = Math.min((LADE_PROCENT / 100) * scherm, LADE_MAXHOOGTE);
  const toonStream = vak.hoogte - ladeWil >= STREAM_MINIMUM;
  // Rolt de spelleider? Dan komt de rol de chat IN, in een eigen strook bovenin.
  // Niet als doorkijkje naar het scherm eronder maar als een tweede, kleinere
  // weergave van dezelfde toestand: dezelfde skin, dezelfde letters, dezelfde
  // beweging, alleen op zijn eigen schaal. Zo ligt er niets over de chat heen
  // en valt er ook niets te repareren aan wat voor of achter hoort.
  const kamer = game.state.room;
  // Zolang de uitzending erboven staat is de lade geen zwevend paneel maar de
  // ONDERSTE HELFT van een pagina: rechte hoeken, zodat hij aansluit op de
  // sectie erboven. De uitzending staat er in elke fase van een potje, dus in
  // de praktijk is dat altijd; de overgang blijft staan voor het moment dat er
  // ooit geen sectie is.
  const rolt = !!kamer;
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
  // Dezelfde regel als het toetsenbord opkomt: de lijst krimpt en zou anders
  // midden in het gesprek blijven staan.
  useBlijfOnderaan(listRef);
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
    game.sendChat(text, undefined, undefined, undefined, antwoord?.id);
    setDraft("");
    setAntwoord(null);
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
    // Twee lagen, zie de privéberichten: de verduistering vult altijd het hele
    // scherm en beweegt nooit, de lade erbovenop volgt het zichtbare vak. Zo
    // kijk je nooit in een kier naar het scherm eronder terwijl het toetsenbord
    // en de viewport het nog niet eens zijn.
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(6,3,18,.55)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
    {/* De strook onder het zichtbare vak, in de kleur van de invulbalk: het
        toetsenbord van iOS is doorschijnend en je keek er dwars doorheen naar
        de lobby. Nu loopt de balk optisch door tot onderaan de telefoon. */}
    <div ref={onder} aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#271A4A" }} />
    <div
      ref={laag}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
      }}
    >
      {/* De uitzending: alles wat er in het spel gebeurt, in de ruimte boven de
          lade. Zie components/Livestream.tsx.

          Weg zodra het toetsenbord opkomt. Wat er anders overblijft is een
          strookje uitzending van een paar tellen hoog waar de inhoud half in
          past, en dat las als een half weggeschoven scherm in plaats van als
          een venster. Wie typt kijkt naar zijn eigen zin, niet naar de studio. */}
      {toonStream && <Livestream game={game} />}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          // Met uitzending erboven een vaste hoogte, zonder uitzending de VOLLE
          // zichtbare band: anders houdt de lade zijn 66% en staat het gat waar
          // de uitzending stond leeg naar de verduistering te kijken.
          height: toonStream ? LADE_HOOGTE : "100%",
          maxHeight: vak.hoogte,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #1B1245 0%, #140C33 100%)",
          // Tijdens het rollen wordt de lade een PAGINA: de hoeken lopen recht
          // en de rolstrook sluit aan op de bovenrand van het scherm. Daarna
          // rollen ze weer terug. De gouden lijn hieronder doet exact hetzelfde,
          // dus de rand blijft en verandert alleen van vorm.
          borderTopLeftRadius: rolt ? 0 : 22,
          borderTopRightRadius: rolt ? 0 : 22,
          transition: "height .2s cubic-bezier(.2,1,.3,1), max-height .2s cubic-bezier(.2,1,.3,1), border-radius .28s cubic-bezier(.2,1,.3,1)",
          // Knippen op de ronding: de kopbalk kreeg in v2.84.3 een eigen
          // dekkende kleur, en die schilderde als rechthoek OVER de afgeronde
          // hoeken heen. Wat je overhield waren twee scherpe puntjes bovenaan
          // waar de ronding hoorde te zitten.
          overflow: "hidden",
          boxShadow: "0 -18px 60px rgba(0,0,0,.5)",
          position: "relative",
        }}
      >
        {/* Dezelfde gouden lijn als op de glazen knoppen erin: de lade en zijn
            knoppen komen uit een stuk metaal. Als eigen laag met het masker,
            want een border kan geen verloop volgen. Alleen boven en opzij:
            onderaan zit de lade aan het scherm vast. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderTopLeftRadius: rolt ? 0 : 22,
            borderTopRightRadius: rolt ? 0 : 22,
            padding: "1px 1px 0",
            background: KNOP_GOUD_VERLOOP,
            opacity: vak.gekrompen ? 0 : 0.85,
            transition: "opacity .22s ease, border-radius .28s cubic-bezier(.2,1,.3,1)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            maskComposite: "exclude",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            // Zie de privéberichten: met toetsenbord staat de kop tegen de
            // statusbalk van de telefoon aan, dus dan schuift de inhoud daar
            // onderuit. Met een overgang, zodat hij meegroeit met de lade in
            // plaats van er een beeldje later bovenop te springen.
            padding: vak.gekrompen ? "calc(10px + env(safe-area-inset-top)) 16px 10px" : "14px 16px 10px",
            transition: "padding .2s cubic-bezier(.2,1,.3,1)",
            // Zie de gesprekspagina: eigen kleur, zodat de kop en de invulbalk
            // niet uit elkaar kleuren als het toetsenbord de lade inkort. Een
            // KLEUR en geen verloop, want de gouden haarlijn is een
            // background-image en die zou het verloop overschrijven.
            backgroundColor: "#271A4A",
            ...goudHaarlijn("bottom"),
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
            <img src="/ui/wallpaper.webp" alt="" aria-hidden style={{ width: 26, height: 26, objectFit: "contain", display: "block", opacity: behangOpen ? 1 : 0.75 }} />
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
              ...goudHaarlijn("bottom"),
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
                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "100%" }}>
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
                  <BerichtHuls
                    mine={mine}
                    breedte="82%"
                    onReageer={() => { sound.uiTap(); setAntwoord(m); inputRef.current?.focus(); }}
                    onVerwijder={() => { sound.uiTap(); game.deleteChat(m.id); }}
                    labels={{ reageer: t("berichtReageer"), verwijder: t("berichtVerwijder") }}
                  >
                  <div
                    style={{
                      // Een sticker of een foto hangt KAAL in de lijst: een
                      // knipsel in een pil met een rand eromheen ziet eruit als
                      // een fout. Behalve als er een citaat boven staat, want
                      // dat citaat heeft wel iets nodig om op te liggen.
                      padding: kaal(m) ? 4 : m.voice_id ? "8px 12px" : "9px 14px",
                      // Dezelfde pil als in de privéberichten, zodat een bericht
                      // er overal in de app hetzelfde uitziet.
                      borderRadius: kaal(m) ? 14 : 20,
                      borderTopRightRadius: kaal(m) ? 14 : mine ? 6 : 20,
                      borderTopLeftRadius: kaal(m) ? 14 : mine ? 20 : 6,
                      background: kaal(m)
                        ? "transparent"
                        : mine
                          ? `linear-gradient(180deg, ${withAlpha(colors.gold, 0.22)}, ${withAlpha(colors.gold, 0.12)})`
                          : "linear-gradient(180deg, rgba(24,12,50,.88), rgba(14,7,34,.88))",
                      boxShadow: kaal(m)
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
                    {/* Waar dit een antwoord op was. Ook boven een sticker of
                        een spraakbericht, want ook daarmee kun je reageren. */}
                    {m.reply && (
                      <Citaat
                        naam={m.reply.name}
                        tekst={citaatTekst(m.reply.text, m.reply.soort, { spraak: t("voiceMemo"), foto: t("berichtFoto"), sticker: t("stickerOne") })}
                        kleur={mine ? colors.gold : "#C79BFF"}
                      />
                    )}
                    {m.emote ? (
                      <img src={EMOTE_SRC(m.emote)} alt="" width={84} height={84} style={{ width: 84, height: 84, display: "block", objectFit: "contain" }} />
                    ) : m.image_id ? (
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
                  </BerichtHuls>
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
            onPick={(id) => { game.sendChat("", undefined, id, undefined, antwoord?.id); setAntwoord(null); setEmotesOpen(false); }}
            onClose={() => setEmotesOpen(false)}
          />
        )}

        {/* Waar je op gaat antwoorden. Boven het invulveld en niet erin: hij
            hoort bij wat je gaat sturen, niet bij wat je typt. */}
        {antwoord && (
          <AntwoordBalk
            naam={antwoord.player_id === myId ? t("chatYou") : antwoord.name}
            tekst={citaatTekst(antwoord.text, antwoord.emote ? "emote" : antwoord.image_id ? "image" : antwoord.voice_id ? "voice" : "text", { spraak: t("voiceMemo"), foto: t("berichtFoto"), sticker: t("stickerOne") })}
            onWeg={() => setAntwoord(null)}
            weg={t("berichtAntwoordWeg")}
          />
        )}

        <form
          onSubmit={submit}
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 12px",
            paddingBottom: vak.gekrompen ? 8 : "calc(8px + env(safe-area-inset-bottom))",
            backgroundColor: "#271A4A",
            ...goudHaarlijn("top"),
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
              boxShadow: `inset 0 0 0 1px ${withAlpha("#A868F5", draft.trim() ? 0.6 : 0.42)}, 0 0 3px ${withAlpha("#8B45E8", 0.18)}`,
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
              <BeeldKnop upload={uploadBeeld} onSent={(id) => { game.sendChat("", undefined, undefined, id, antwoord?.id); setAntwoord(null); }} />
              <MicButton upload={uploadVoice} onSent={(id, dur) => { game.sendChat("", { id, dur }, undefined, undefined, antwoord?.id); setAntwoord(null); }} />
            </>
          )}
        </form>
      </div>
    </div>
    </div>
  );
}
