// First-visit install prompt (after the profile prompt): Android/desktop gets
// the real one-tap install button (beforeinstallprompt); iPhone gets drawn
// mini-mockups of the share route (Apple ships no install API in WebKit), with
// a Chrome-on-iOS variant (three dots > Delen) and an in-app-webview notice.
// Dismiss once = never auto-shown again; installing stays available in
// Settings. Preview any variant with ?installdemo=ios|chromeios|inapp|android.
import { Download, MoreHorizontal, Share, SquarePlus, X, Link as LinkIcon } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { promptInstall } from "../pwa/install";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

const SEEN_KEY = "penneer.installPromptSeen";

export type InstallVariant = "android" | "ios" | "chromeios" | "inapp";

export function installPromptSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** A gold arrow that points at the highlighted control in a mockup. */
function PointArrow({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="30" height="34" viewBox="0 0 30 34" fill="none" style={{ position: "absolute", pointerEvents: "none", ...style }}>
      <path d="M6 3 C 10 14, 16 20, 22 26" stroke={colors.gold} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M22 26 L13.5 24.5 M22 26 L21 17.5" stroke={colors.gold} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Drawn Safari/Chrome bar with the entry control highlighted. */
function BarMockup({ chrome }: { chrome: boolean }) {
  return (
    <div style={{ position: "relative", padding: "18px 10px 10px", borderRadius: 14, background: withAlpha("#000000", 0.28), border: `1px solid ${colors.panelBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 12px",
            borderRadius: 999,
            background: withAlpha("#ffffff", 0.07),
            border: `1px solid ${withAlpha("#ffffff", 0.1)}`,
          }}
        >
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, letterSpacing: 0.2 }}>penneer.artnomad.nl</span>
        </div>
        <span
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            color: colors.gold,
            background: withAlpha(colors.gold, 0.14),
            border: `1.5px solid ${colors.gold}`,
            boxShadow: `0 0 16px ${withAlpha(colors.gold, 0.45)}`,
          }}
        >
          {chrome ? <MoreHorizontal size={18} /> : <Share size={17} />}
        </span>
      </div>
      <PointArrow style={{ right: 14, top: -12 }} />
    </div>
  );
}

/** Drawn share-sheet with "Zet op beginscherm" highlighted. */
function SheetMockup() {
  const { t } = useT();
  return (
    <div style={{ position: "relative", padding: 10, borderRadius: 14, background: withAlpha("#000000", 0.28), border: `1px solid ${colors.panelBorder}`, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, color: colors.faint }}>
        <LinkIcon size={15} />
        <span style={{ fontFamily: font.ui, fontSize: 13 }}>{t("installSheetCopy")}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          color: colors.ink,
          background: withAlpha(colors.gold, 0.13),
          border: `1.5px solid ${colors.gold}`,
          boxShadow: `0 0 16px ${withAlpha(colors.gold, 0.35)}`,
        }}
      >
        <SquarePlus size={16} color={colors.gold} />
        <span style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 700 }}>{t("installSheetHome")}</span>
      </div>
      <PointArrow style={{ left: "52%", top: -14, transform: "scaleX(-1)" }} />
    </div>
  );
}

function StepRow({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
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
        {n}
      </span>
      <span style={{ fontFamily: font.ui, fontSize: 13, lineHeight: 1.45, color: colors.sub, textAlign: "left" }}>{text}</span>
    </div>
  );
}

export function InstallPrompt({ variant, onClose }: { variant: InstallVariant; onClose: () => void }) {
  const { t } = useT();

  const dismiss = () => {
    markSeen();
    onClose();
  };

  const install = async () => {
    const ok = await promptInstall();
    markSeen();
    if (ok) onClose();
  };

  const ios = variant === "ios" || variant === "chromeios";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        background: "rgba(6,3,18,.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 22,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 13,
          padding: "24px 20px 20px",
          borderRadius: 22,
          background: "linear-gradient(180deg, #241738, #160D30)",
          border: `1px solid ${withAlpha(colors.gold, 0.4)}`,
          boxShadow: "0 24px 70px rgba(0,0,0,.6)",
          textAlign: "center",
        }}
      >
        <button
          onClick={dismiss}
          aria-label={t("installNotNow")}
          style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}
        >
          <X size={19} />
        </button>

        <div style={{ position: "relative" }}>
          <Logo size={64} />
          <span style={{ position: "absolute", right: -7, bottom: -2, width: 25, height: 25, borderRadius: 9, display: "grid", placeItems: "center", background: colors.gold, color: colors.bg0 }}>
            <Download size={14} />
          </span>
        </div>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.ink }}>{t("installPromptTitle")}</span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("installPromptBody")}</p>

        {variant === "inapp" && (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, lineHeight: 1.55, color: colors.orange, textAlign: "left" }}>{t("installIosSafari")}</p>
        )}

        {ios && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 9 }}>
            <StepRow n={1} text={variant === "chromeios" ? t("installIosStep1Chrome") : t("installIosStep1")} />
            <BarMockup chrome={variant === "chromeios"} />
            <StepRow n={2} text={t("installIosStep2")} />
            <SheetMockup />
            <StepRow n={3} text={t("installIosStep3")} />
            <p style={{ margin: "2px 0 0", fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.5, color: colors.faint }}>{t("installIosWhy")}</p>
          </div>
        )}

        {variant === "android" && (
          <Button variant="gold" full onClick={install}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Download size={18} /> {t("installApp")}
            </span>
          </Button>
        )}

        <button
          onClick={dismiss}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: 4 }}
        >
          {t("installNotNow")}
        </button>
      </div>
    </div>
  );
}
