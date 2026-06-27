// Shared shells: full-height app background + translucent Card panel.
import React from "react";
import { useT } from "../i18n/i18n";
import { appBackground, colors, font, panelStyle } from "../theme/tokens";

export function Screen({ children, top }: { children: React.ReactNode; top?: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: appBackground,
        display: "flex",
        flexDirection: "column",
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

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...panelStyle, padding: 18, ...style }}>{children}</div>;
}

export function Footer() {
  const { t } = useT();
  return (
    <div
      style={{
        textAlign: "center",
        padding: "10px 0 18px",
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
