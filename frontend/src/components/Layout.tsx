// Shared shells: full-height app background + translucent Card panel.
import React from "react";
import { useT } from "../i18n/i18n";
import { colors, font, panelStyle } from "../theme/tokens";

export function Screen({ children, top }: { children: React.ReactNode; top?: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        // Background comes from the fixed body::before layer (fills safe areas).
        display: "flex",
        flexDirection: "column",
        // Keep content clear of the notch / status bar when there is no TopBar.
        paddingTop: top ? undefined : "env(safe-area-inset-top)",
      }}
    >
      {top}
      <div
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 460,
          margin: "0 auto",
          padding: "8px 18px 28px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
      <Footer />
    </div>
  );
}

export function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return <div className={className} style={{ ...panelStyle, padding: 18, ...style }}>{children}</div>;
}

export function Footer() {
  const { t } = useT();
  return (
    <div
      style={{
        textAlign: "center",
        padding: "10px 0 18px",
        paddingBottom: "calc(18px + env(safe-area-inset-bottom))",
        fontFamily: font.ui,
        fontSize: 11.5,
        color: colors.faint,
        letterSpacing: 0.3,
      }}
    >
      {t("footer")}
    </div>
  );
}
