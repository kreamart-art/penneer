// Settings + About — reachable from the Landing gear.
//
// Alles wat je hier kunt instellen staat in ÉÉN sectie. Wat je meteen aan- of
// uitzet (look, geluid) schakelt in de rij zelf; wat meer ruimte nodig heeft
// (profiel, taal & spelling, hoe werkt het, contact) opent als eigen pagina en
// de rondleiding als popup. Daarvoor was het een stapel losse kaarten en
// knoppen waarin je moest zoeken waar iets stond.
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Compass, Download, Globe, HelpCircle, Mail, Music, Palette, Share, Trash2, UserCog, Volume2 } from "lucide-react";
import { Logo } from "../components/Logo";
import { KnopPlaat } from "../components/KnopPlaat";
import { Paneel, SierKop } from "../components/ProfileHero";
import { PilKeuze } from "./Hub";
import { Button } from "../components/Button";
import { Toggle } from "../components/Toggle";
import { ontdekAan, zetOntdek } from "../util/ontdekvlag";
import { isEigenaar } from "../util/testers";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { AdminDashboard } from "../components/AdminDashboard";
import { ArtIcoon } from "../components/ArtIcoon";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { canInstall, isIos, isIosInAppBrowser, isStandalone, onInstallChange, promptInstall } from "../pwa/install";
import { APP_VERSION } from "../version";
import { setTileSkin, tileSkinOn } from "../theme/tileSkin";
import { colors, font, withAlpha } from "../theme/tokens";

/** De kop boven een blok instellingen.
 *
 *  Was een grijs regeltje in kapitalen, en dat is precies hoe een instelling er
 *  niet uit hoort te zien in een spel dat verderop overal gouden sierkoppen
 *  heeft. Dezelfde `SierKop` als op het profiel, dus dit scherm hoort er weer
 *  bij in plaats van eronder te hangen. */
/** Een kaart die dichtklapt.
 *
 *  Instellingen groeide door tot een scherm waar je doorheen moest scrollen om
 *  iets terug te vinden. De delen die je zelden nodig hebt (contact, installeren,
 *  admin) staan nu dicht, met alleen hun kop zichtbaar: het scherm past weer in
 *  een oogopslag en wat je zoekt is één tik weg.
 *
 *  De inhoud wordt pas GEMONTEERD als hij open is. Dat scheelt niet alleen werk
 *  bij het tekenen, het voorkomt ook dat een dicht paneel op de achtergrond
 *  netwerkverkeer doet: het admin-dashboard vraagt zijn cijfers op bij het
 *  monteren, en dat hoeft niet zolang niemand kijkt. */
function Inklapbaar({ titel, icoon, open, onWissel, children }: {
  titel: string;
  icoon?: React.ReactNode;
  open: boolean;
  onWissel: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: open ? 12 : 0, padding: open ? 18 : 14 }}>
      <button
        onClick={() => { sound.uiTap(); onWissel(); }}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        {icoon}
        <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{titel}</span>
        {/* De pijl draait mee: open is naar beneden, dicht is naar rechts. Een
            pijl die van vorm wisselt leest als twee knoppen. */}
        <ChevronRight
          size={18}
          color={colors.faint}
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s ease" }}
        />
      </button>
      {open && children}
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <SierKop label={typeof children === "string" ? children : String(children)} />
    </div>
  );
}

/** Eén regel in de instellingenlijst.
 *
 *  Rechts staat wat de regel DOET: een schakelaar als je hem hier meteen om kunt
 *  zetten, een pijl als er een pagina achter zit. Twee soorten regels in één
 *  lijst werken alleen als dat verschil aan de rechterkant meteen te zien is.
 *
 *  De hele regel is de knop, niet alleen het opschrift: een raakvlak van 44
 *  punten hoog is het minimum waar een duim betrouwbaar op mikt. */
function Rij({ icoon, label, rechts, onClick, eerste }: {
  icoon: React.ReactNode;
  label: string;
  rechts?: React.ReactNode;
  onClick?: () => void;
  eerste?: boolean;
}) {
  const inhoud = (
    <>
      <span style={{ display: "flex", color: colors.gold, flexShrink: 0 }}>{icoon}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontWeight: 600, fontSize: 14.5, color: colors.ink, textAlign: "left" }}>
        {label}
      </span>
      {rechts ?? <ChevronRight size={17} color={colors.faint} />}
    </>
  );
  const stijl: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, width: "100%",
    minHeight: 44, padding: "10px 0",
    borderTop: eerste ? "none" : `1px solid ${colors.hairline}`,
    background: "transparent", border: "none", borderRadius: 0,
  };
  // Een schakelaar vangt zijn eigen tik; die regel is dus geen knop, anders
  // krijg je een knop in een knop en zet één tik het ding twee keer om.
  if (!onClick) return <div style={stijl}>{inhoud}</div>;
  return (
    <button
      onClick={() => { sound.uiTap(); onClick(); }}
      className="pressable"
      style={{ ...stijl, cursor: "pointer", padding: "10px 0", textAlign: "left" }}
    >
      {inhoud}
    </button>
  );
}

/** De kop van een onderpagina: terugpijl plus titel, precies zoals het
 *  hoofdscherm er zelf uitziet. */
function SubKop({ titel, onBack }: { titel: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => { sound.uiTap(); onBack(); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.ink, display: "flex" }}>
        <ArrowLeft size={22} />
      </button>
      <h2 style={{ margin: 0, fontFamily: font.display, fontWeight: 700, fontSize: 24, color: colors.ink }}>{titel}</h2>
    </div>
  );
}

/** Taal & spelling: in welke taal de app tegen je praat, en hoe streng er naar
 *  je woorden gekeken wordt. Twee dingen die allebei over TAAL gaan, dus ze
 *  horen op één pagina en niet elk in een eigen hoek van de app. */
function TaalSpelling({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t, lang, setLang } = useT();
  const account = game.state.account;
  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
        <SubKop titel={t("taalSpellingTitel")} onBack={onBack} />

        <Card>
          <SectionLabel>{t("language")}</SectionLabel>
          {/* Dezelfde pil als op de ranglijst en in de winkel: een ring met
              twee knoppen erin. Twee losse pillen naast elkaar lezen als twee
              onafhankelijke schakelaars, en dat zijn ze niet. */}
          <PilKeuze
            actief={lang ?? "nl"}
            onKies={setLang}
            opties={[
              { key: "nl" as const, label: "Nederlands" },
              { key: "en" as const, label: "English" },
            ]}
          />
        </Card>

        {/* Soepele spelling (dyslexie-hulp) voor Oefenen + Dagronde. Hangt aan
            je account, dus zonder profiel valt er niets te kiezen. */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel>{t("spellingKop")}</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: account ? colors.ink : colors.faint }}>
              {t("lenientTitle")}
            </span>
            <Toggle
              on={!!account?.lenient_spelling}
              disabled={!account}
              onChange={(v) => { sound.uiTap(); game.setLenient(v); }}
            />
          </div>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
            {account ? t("lenientHint") : t("lenientGast")}
          </p>
        </Card>
      </div>
    </Screen>
  );
}

/** Contact: hoe je ons bereikt, en waar je aan toe bent. */
function ContactPagina({ onBack, onShowLegal }: { onBack: () => void; onShowLegal: (tab: "privacy" | "terms") => void }) {
  const { t } = useT();
  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
        <SubKop titel={t("contactTitle")} onBack={onBack} />

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, lineHeight: 1.55, color: colors.sub }}>{t("contactHint")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a
              href="mailto:kream.art@gmail.com?subject=Pen%20Neer"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, textDecoration: "none", fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: colors.ink, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.45)}` }}
            >
              <Mail size={15} color={colors.gold} /> {t("contactMail")}
            </a>
            <a
              href="https://artnomad.nl"
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, textDecoration: "none", fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: colors.sub, background: "transparent", border: `1px solid ${colors.panelBorder}` }}
            >
              <Globe size={15} /> {t("contactSite")}
            </a>
          </div>
        </Card>

        {/* Het juridische hoort bij contact: het gaat over dezelfde afspraak
            tussen jou en ons, alleen dan opgeschreven. */}
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <Rij eerste icoon={<ArtIcoon naam="schild" size={18} />} label={t("privacyTitle")} onClick={() => onShowLegal("privacy")} />
          <Rij icoon={<ArtIcoon naam="boek" size={18} />} label={t("termsTitle")} onClick={() => onShowLegal("terms")} />
        </Card>
      </div>
    </Screen>
  );
}

// Eigen categorieen. De naam IS de categorie zoals spelers hem zien; een room
// accepteert al vrije categoriestrings, dus zodra de host er een aanzet spelen
// alle anderen in die room automatisch mee, ook wie hem niet bezit.
//
// De woordenlijst is optioneel: met lijst krijgt de categorie auto-check zoals
// Dier of Land, zonder lijst telt elk woord met de goede letter, zoals Ding.
// Prijs 0 betekent gratis voor iedereen; hoger zet hem in de winkel. De maker
// krijgt hem altijd meteen zelf.
function AdminCategories({ game }: { game: GameApi }) {
  const { t } = useT();
  const cats = game.state.adminCategories;
  const [name, setName] = useState("");
  const [words, setWords] = useState("");
  const [price, setPrice] = useState("0");

  useEffect(() => {
    game.adminCatList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const field: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: font.ui,
    fontSize: 14,
    color: colors.ink,
    background: withAlpha("#000000", 0.25),
    border: `1.5px solid ${colors.panelBorder}`,
    borderRadius: 12,
    padding: "10px 12px",
  };

  const create = () => {
    const n = name.trim();
    if (n.length < 2) return;
    game.adminCatCreate(n, words, Number(price) || 0);
    setName("");
    setWords("");
    setPrice("0");
  };

  return (
    <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 12 }}>
      <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 6 }}>
        {t("catAdminTitle")}
      </div>
      <p style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint, margin: "0 0 10px", lineHeight: 1.5 }}>{t("catAdminHint")}</p>

      {!!cats?.length && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {cats.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: withAlpha("#000000", 0.2), border: `1px solid ${colors.hairline}` }}>
              <span style={{ flex: 1, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: colors.ink }}>{c.name}</span>
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
                {c.words > 0 ? t("catWordsN", { n: c.words }) : t("catOpenList")}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: font.ui, fontSize: 12, fontWeight: 700, color: c.price > 0 ? colors.gold : colors.green }}>
                {c.price > 0 ? <>{c.price}<img src="/coin.webp" alt="" width={12} height={12} /></> : t("catFree")}
              </span>
              <button
                onClick={() => game.adminCatDelete(c.id)}
                aria-label={t("delete")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.red, display: "flex", padding: 2 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input style={field} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t("catNamePlaceholder")} />
        <textarea
          style={{ ...field, minHeight: 74, resize: "vertical" }}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder={t("catWordsPlaceholder")}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            style={{ ...field, width: 96 }}
            value={price}
            inputMode="numeric"
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
          />
          <span style={{ flex: 1, fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("catPriceHint")}</span>
          <KnopPlaat kleur="paars" breed={96} uit={name.trim().length < 2} onClick={create} label={t("catCreate")} />
        </div>
      </div>
    </div>
  );
}

function Fader({
  icon,
  label,
  value,
  muted,
  onChange,
  onToggleMute,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  muted: boolean;
  onChange: (v: number) => void;
  onToggleMute: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* the icon is the channel's mute toggle */}
      <button
        onClick={onToggleMute}
        aria-label={muted ? `${label} aan` : `${label} uit`}
        style={{ display: "flex", alignItems: "center", gap: 8, width: 120, flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
      >
        <span style={{ position: "relative", display: "flex", color: muted ? colors.faint : colors.gold }}>
          {icon}
          {muted && (
            <span style={{ position: "absolute", left: "50%", top: "50%", width: 22, height: 2, background: colors.faint, borderRadius: 2, transform: "translate(-50%,-50%) rotate(-45deg)", boxShadow: `0 0 0 1.5px ${withAlpha(colors.bg1, 0.9)}` }} />
          )}
        </span>
        <span style={{ fontFamily: font.ui, fontSize: 15, color: muted ? colors.faint : colors.ink }}>{label}</span>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: colors.gold, opacity: muted ? 0.4 : 1 }}
      />
      <span style={{ width: 34, textAlign: "right", fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>
        {muted ? "uit" : `${Math.round(value * 100)}%`}
      </span>
    </div>
  );
}

export function Settings({ game, onBack, onShowRules, onShowTour, onShowLegal, onProfileSettings }: { game: GameApi; onBack: () => void; onShowRules: () => void; onShowTour: () => void; onShowLegal: (tab: "privacy" | "terms") => void; onProfileSettings: () => void }) {
  const [skinAan, setSkinAan] = useState(tileSkinOn());
  const { t } = useT();
  const [musicVol, setMusicVol] = useState(sound.musicVolume());
  const [sfxVol, setSfxVol] = useState(sound.sfxVolume());
  const [musicMuted, setMusicMuted] = useState(sound.isMusicMuted());
  const [sfxMuted, setSfxMuted] = useState(sound.isSfxMuted());
  const [installable, setInstallable] = useState(canInstall());
  const standalone = isStandalone();
  const ios = isIos();
  const iosInApp = isIosInAppBrowser();
  // Welke panelen open staan. Beide dicht bij binnenkomst: dat is precies het
  // punt van dit scherm korter maken.
  const [openPaneel, setOpenPaneel] = useState<"install" | "admin" | null>(null);
  const wissel = (welk: "install" | "admin") =>
    setOpenPaneel((oud) => (oud === welk ? null : welk));
  const [adminCode, setAdminCode] = useState("");
  const { isAdmin, adminAi, recoveryCodes, aiCodes, avatarCodes, buzzerCodes } = game.state;
  const [ontdekVlag, setOntdekVlag] = useState(ontdekAan());
  // De onderpagina's van dit scherm. Ze staan hier en niet in de router van de
  // app: ze horen bij instellingen, en zo blijft de terugweg één toestand.
  const [pagina, setPagina] = useState<"taal" | "contact" | null>(null);
  // Geluid als één schakelaar. Muziek en effecten hebben elk hun eigen mute,
  // dus "aan" is: er komt nog ergens geluid uit.
  const geluidAan = !musicMuted || !sfxMuted;
  const zetGeluid = (aan: boolean) => {
    sound.setMusicMuted(!aan);
    sound.setSfxMuted(!aan);
    setMusicMuted(sound.isMusicMuted());
    setSfxMuted(sound.isSfxMuted());
    if (aan) sound.approve();
  };
  // Alleen de eigenaars zien de deur naar het admin-paneel. De code blijft de
  // sleutel; dit haalt het slot uit het zicht van iedereen die er niets te
  // zoeken heeft. Wie al ingelogd is houdt hem hoe dan ook.
  const magAdmin = isAdmin || isEigenaar(game.state.account?.name);

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);

  if (pagina === "taal") return <TaalSpelling game={game} onBack={() => setPagina(null)} />;
  if (pagina === "contact") return <ContactPagina onBack={() => setPagina(null)} onShowLegal={onShowLegal} />;

  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.ink, display: "flex" }}>
            <ArrowLeft size={22} />
          </button>
          <h2 style={{ margin: 0, fontFamily: font.display, fontWeight: 700, fontSize: 24, color: colors.ink }}>{t("settingsTitle")}</h2>
        </div>

        {/* Alles in één sectie. De volgorde is: wat je hier meteen omzet
            eerst, daarna wat een eigen pagina opent. */}
        <Card style={{ display: "flex", flexDirection: "column" }}>
          {/* De look: de nieuwe platen of de klassieke indeling van voor de
              art. Alles blijft hetzelfde werken; alleen het jasje wisselt. */}
          <Rij
            eerste
            icoon={<Palette size={18} />}
            label={t("lookKlassiek")}
            rechts={<Toggle on={!skinAan} onChange={(v) => { sound.uiTap(); setTileSkin(!v); setSkinAan(!v); }} />}
          />

          {/* Geluid: één schakelaar voor aan of uit, met de twee faders eronder
              zodra er iets te horen valt. Wie het alleen zachter wil hoeft
              nergens heen; wie het uit wil, is met één tik klaar. */}
          <div>
            <Rij
              icoon={<Volume2 size={18} />}
              label={t("audio")}
              rechts={<Toggle on={geluidAan} onChange={(v) => { sound.uiTap(); zetGeluid(v); }} />}
            />
            {geluidAan && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "2px 0 12px 29px" }}>
                <Fader
                  icon={<Music size={17} />}
                  label={t("musicVol")}
                  value={musicVol}
                  muted={musicMuted}
                  onToggleMute={() => {
                    sound.toggleMusicMuted();
                    setMusicMuted(sound.isMusicMuted());
                  }}
                  onChange={(v) => {
                    setMusicVol(v);
                    sound.setMusicVolume(v); // >0 also clears the music mute
                    setMusicMuted(sound.isMusicMuted());
                  }}
                />
                <Fader
                  icon={<Volume2 size={17} />}
                  label={t("sfxVol")}
                  value={sfxVol}
                  muted={sfxMuted}
                  onToggleMute={() => {
                    sound.toggleSfxMuted();
                    setSfxMuted(sound.isSfxMuted());
                    if (!sound.isSfxMuted()) sound.approve();
                  }}
                  onChange={(v) => {
                    setSfxVol(v);
                    sound.setSfxVolume(v);
                    setSfxMuted(sound.isSfxMuted());
                    if (v > 0) sound.approve();
                  }}
                />
              </div>
            )}
          </div>

          {/* Profielinstellingen. Zaten achter een tandwiel op je profiel, wat
              een rare plek is voor instellingen: wie ze zoekt komt hier.
              Alleen met profiel, want er valt niets in te stellen zonder
              account. */}
          {!!game.state.account && (
            <Rij icoon={<UserCog size={18} />} label={t("profileSettings")} onClick={onProfileSettings} />
          )}

          <Rij icoon={<Globe size={18} />} label={t("taalSpellingTitel")} onClick={() => setPagina("taal")} />

          <Rij icoon={<HelpCircle size={18} />} label={t("howItWorks")} onClick={onShowRules} />

          {/* De rondleiding. Apart van "Hoe werkt het": dat gaat over de
              REGELS, dit over de app. */}
          <Rij icoon={<Compass size={18} />} label={t("tourStart")} onClick={onShowTour} />

          <Rij icoon={<Mail size={18} />} label={t("contactTitle")} onClick={() => setPagina("contact")} />
        </Card>

        {/* iOS has no beforeinstallprompt (Apple ships no install API in WebKit, and
            every iOS browser is WebKit), so the button can never fire there. Show the
            manual Share > Zet op beginscherm steps instead of a dead disabled button. */}
        {!standalone && ios && (
          <Inklapbaar titel={t("installIosTitle")} icoon={<Download size={18} color={colors.gold} />} open={openPaneel === "install"} onWissel={() => wissel("install")}>
            {iosInApp ? (
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, lineHeight: 1.55, color: colors.sub }}>{t("installIosSafari")}</p>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { n: 1, text: t("installIosStep1"), icon: true },
                    { n: 2, text: t("installIosStep2"), icon: false },
                    { n: 3, text: t("installIosStep3"), icon: false },
                  ].map((s) => (
                    <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span
                        style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          background: withAlpha(colors.gold, 0.16),
                          border: `1px solid ${withAlpha(colors.gold, 0.4)}`,
                          color: colors.gold,
                          fontFamily: font.ui,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {s.n}
                      </span>
                      <span style={{ fontFamily: font.ui, fontSize: 13, lineHeight: 1.45, color: colors.sub, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {s.text}
                        {s.icon && <Share size={15} color={colors.ink} />}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, lineHeight: 1.5, color: colors.faint }}>{t("installIosWhy")}</p>
              </>
            )}
          </Inklapbaar>
        )}
        {!standalone && !ios && (
          <div>
            <Button variant="primary" full disabled={!installable} onClick={() => promptInstall()}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Download size={18} /> {t("installApp")}
              </span>
            </Button>
            <p style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint, textAlign: "center", margin: "8px 0 0" }}>{t("installHint")}</p>
          </div>
        )}
        {standalone && (
          <p style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.green, textAlign: "center", margin: 0 }}>{t("appInstalled")}</p>
        )}

        {/* Admin (owner). Alleen Kream en Aish krijgen dit blok te zien. */}
        {magAdmin && (
        <Inklapbaar titel={t("adminTitle")} icoon={<ArtIcoon naam="schild" size={20} />} open={openPaneel === "admin"} onWissel={() => wissel("admin")}>
          <p style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>{t("adminHint")}</p>

          {!isAdmin ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder={t("adminCode")}
                type="password"
                style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 14, color: colors.ink, background: withAlpha("#000000", 0.25), border: `1.5px solid ${colors.panelBorder}`, borderRadius: 10, padding: "10px 12px" }}
              />
              <KnopPlaat kleur="paars" breed={96} uit={!adminCode.trim()} onClick={() => { game.adminLogin(adminCode.trim()); setAdminCode(""); }} label={t("login")} />
            </div>
          ) : (
            <>
              <AdminDashboard game={game} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: font.ui, fontSize: 14, color: colors.green }}>{t("loggedInAdmin")}</span>
                <Button variant="ghost" onClick={game.adminLogout}>{t("logout")}</Button>
              </div>

              {/* Ontdekken is nog niet af. Achter de admin-check, zodat de
                  modus mee kan met een gewone deploy zonder dat spelers hem
                  tegenkomen. */}
              <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 12 }}>
                <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 6 }}>
                  {t("ontdekkenAdminTitel")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flex: 1, fontFamily: font.ui, fontSize: 14, color: colors.ink }}>{t("ontdekkenTitel")}</span>
                  <Toggle on={ontdekVlag} onChange={(v) => { sound.uiTap(); zetOntdek(v); setOntdekVlag(v); }} />
                </div>
                <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 12, color: colors.faint, lineHeight: 1.45 }}>{t("ontdekkenAdminUitleg")}</p>
              </div>

              {/* AI referee toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontFamily: font.ui, fontSize: 15, color: colors.ink }}>{t("aiReferee")}</span>
                <Toggle on={!!adminAi?.enabled} disabled={!adminAi?.available} onChange={(v) => game.adminSetAi(v)} />
              </div>
              <p style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>
                {adminAi?.available ? t("aiRefereeHint") : t("aiUnavailable")}
              </p>
              {adminAi?.available && (
                <div style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub }}>
                  {t("aiProvider")}: {adminAi.provider} · {t("aiModel")}: {adminAi.model}
                </div>
              )}

              {/* Recovery codes */}
              {recoveryCodes.length > 0 && (
                <div>
                  <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginTop: 6, marginBottom: 6 }}>
                    {t("recoveryTitle")}
                  </div>
                  <p style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint, margin: "0 0 8px" }}>{t("recoveryHint")}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {recoveryCodes.map((rc) => (
                      <span
                        key={rc.code}
                        style={{
                          fontFamily: font.display,
                          fontSize: 12.5,
                          letterSpacing: 1,
                          padding: "4px 8px",
                          borderRadius: 8,
                          color: rc.used ? colors.faint : colors.gold,
                          background: withAlpha(rc.used ? "#FFFFFF" : colors.gold, rc.used ? 0.06 : 0.12),
                          textDecoration: rc.used ? "line-through" : "none",
                        }}
                      >
                        {rc.code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Shop unlock codes: mint one-time AI-referee codes to hand out or
                  sell yourself (separate from admin recovery codes). */}
              <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 12 }}>
                <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 6 }}>
                  {t("aiCodesTitle")}
                </div>
                <p style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint, margin: "0 0 8px", lineHeight: 1.5 }}>{t("aiCodesHint")}</p>
                {aiCodes && (
                  <p style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, margin: "0 0 8px" }}>
                    {t("aiCodesStats", { open: String(aiCodes.open), redeemed: String(aiCodes.redeemed), total: String(aiCodes.total) })}
                  </p>
                )}
                {aiCodes?.new && aiCodes.new.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {aiCodes.new.map((c) => (
                      <span key={c} style={{ fontFamily: font.display, fontSize: 13, letterSpacing: 1, padding: "5px 9px", borderRadius: 8, color: colors.green, background: withAlpha(colors.green, 0.14), userSelect: "all" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => game.adminGenAiCodes(1)}>{t("aiCodesGenOne")}</Button>
                  <Button variant="ghost" onClick={() => game.adminGenAiCodes(5)}>{t("aiCodesGenFive")}</Button>
                </div>
              </div>

              {/* Premium-avatar unlock codes (separate product). */}
              <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 12 }}>
                <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 6 }}>
                  {t("avatarCodesTitle")}
                </div>
                <p style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint, margin: "0 0 8px", lineHeight: 1.5 }}>{t("avatarCodesHint")}</p>
                {avatarCodes && (
                  <p style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, margin: "0 0 8px" }}>
                    {t("aiCodesStats", { open: String(avatarCodes.open), redeemed: String(avatarCodes.redeemed), total: String(avatarCodes.total) })}
                  </p>
                )}
                {avatarCodes?.new && avatarCodes.new.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {avatarCodes.new.map((c) => (
                      <span key={c} style={{ fontFamily: font.display, fontSize: 13, letterSpacing: 1, padding: "5px 9px", borderRadius: 8, color: colors.green, background: withAlpha(colors.green, 0.14), userSelect: "all" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => game.adminGenAvatarCodes(1)}>{t("aiCodesGenOne")}</Button>
                  <Button variant="ghost" onClick={() => game.adminGenAvatarCodes(5)}>{t("aiCodesGenFive")}</Button>
                </div>
              </div>

              {/* Buzzer-skin unlock codes */}
              <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 12 }}>
                <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 6 }}>
                  {t("buzzCodesTitle")}
                </div>
                <p style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint, margin: "0 0 8px", lineHeight: 1.5 }}>{t("buzzCodesHint")}</p>
                {buzzerCodes && (
                  <p style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, margin: "0 0 8px" }}>
                    {t("aiCodesStats", { open: String(buzzerCodes.open), redeemed: String(buzzerCodes.redeemed), total: String(buzzerCodes.total) })}
                  </p>
                )}
                {buzzerCodes?.new && buzzerCodes.new.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {buzzerCodes.new.map((c) => (
                      <span key={c} style={{ fontFamily: font.display, fontSize: 13, letterSpacing: 1, padding: "5px 9px", borderRadius: 8, color: colors.green, background: withAlpha(colors.green, 0.14), userSelect: "all" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => game.adminGenBuzzerCodes(1)}>{t("aiCodesGenOne")}</Button>
                  <Button variant="ghost" onClick={() => game.adminGenBuzzerCodes(5)}>{t("aiCodesGenFive")}</Button>
                </div>
              </div>

              {/* Eigen categorieen: maken, prijzen, weggooien. */}
              <AdminCategories game={game} />
            </>
          )}
        </Inklapbaar>
        )}

        {/* Over. In de sierlijst van het profiel: dit is het naamplaatje van de
            app, en dat verdient dezelfde lijst als het naamplaatje van een
            speler. De inhoud voegt zich naar de art (vaste verhouding), dus
            logo en regels staan dicht op elkaar. */}
        <Paneel>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, paddingInline: 10 }}>
            <Logo size={56} />
            <span style={{ fontFamily: "'Cybergame', 'Space Grotesk', sans-serif", fontWeight: 400, fontSize: 26, letterSpacing: 2.5, color: colors.ink, lineHeight: 1.1 }}>PEN NEER</span>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub }}>
              {t("versionLabel")} {APP_VERSION}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("madeBy")}</span>
            <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha(colors.gold, 0.85) }}>penneer.artnomad.nl</span>
          </div>
        </Paneel>
      </div>
    </Screen>
  );
}
