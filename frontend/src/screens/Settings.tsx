// Settings + About — reachable from the Landing gear. Language, sound, how-to,
// install-as-app, and an About card with the version and studio credit.
import { useEffect, useState } from "react";
import { ArrowLeft, Download, HelpCircle, Music, ShieldCheck, Volume2 } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { Toggle } from "../components/Toggle";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { canInstall, isStandalone, onInstallChange, promptInstall } from "../pwa/install";
import { APP_VERSION } from "../version";
import { colors, font, withAlpha } from "../theme/tokens";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 10 }}>
      {children}
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

export function Settings({ game, onBack, onShowRules }: { game: GameApi; onBack: () => void; onShowRules: () => void }) {
  const { t, lang, setLang } = useT();
  const [musicVol, setMusicVol] = useState(sound.musicVolume());
  const [sfxVol, setSfxVol] = useState(sound.sfxVolume());
  const [musicMuted, setMusicMuted] = useState(sound.isMusicMuted());
  const [sfxMuted, setSfxMuted] = useState(sound.isSfxMuted());
  const [installable, setInstallable] = useState(canInstall());
  const standalone = isStandalone();
  const [adminCode, setAdminCode] = useState("");
  const { isAdmin, adminAi, recoveryCodes } = game.state;

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);

  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.ink, display: "flex" }}>
            <ArrowLeft size={22} />
          </button>
          <h2 style={{ margin: 0, fontFamily: font.display, fontWeight: 700, fontSize: 24, color: colors.ink }}>{t("settingsTitle")}</h2>
        </div>

        <Card style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <SectionLabel>{t("language")}</SectionLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {(["nl", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    fontFamily: font.ui,
                    fontSize: 14,
                    fontWeight: 700,
                    padding: "9px 18px",
                    borderRadius: 999,
                    cursor: "pointer",
                    color: lang === l ? colors.bg0 : colors.sub,
                    background: lang === l ? colors.gold : "transparent",
                    border: `1.5px solid ${lang === l ? "transparent" : colors.panelBorder}`,
                  }}
                >
                  {l === "nl" ? "Nederlands" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionLabel>{t("audio")}</SectionLabel>
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
        </Card>

        <Button variant="ghost" full onClick={onShowRules}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <HelpCircle size={18} /> {t("howItWorks")}
          </span>
        </Button>

        {!standalone && (
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

        {/* Admin (owner) */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} color={colors.gold} />
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("adminTitle")}</span>
          </div>
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
              <Button variant="primary" disabled={!adminCode.trim()} onClick={() => { game.adminLogin(adminCode.trim()); setAdminCode(""); }}>
                {t("login")}
              </Button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: font.ui, fontSize: 14, color: colors.green }}>{t("loggedInAdmin")}</span>
                <Button variant="ghost" onClick={game.adminLogout}>{t("logout")}</Button>
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
            </>
          )}
        </Card>

        {/* About */}
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 22 }}>
          <SectionLabel>{t("about")}</SectionLabel>
          <Logo size={84} />
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, letterSpacing: 1, color: colors.ink }}>PEN NEER</span>
          <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            {t("versionLabel")} {APP_VERSION}
          </span>
          <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("madeBy")}</span>
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: withAlpha(colors.gold, 0.85) }}>penneer.artnomad.nl</span>
        </Card>
      </div>
    </Screen>
  );
}
