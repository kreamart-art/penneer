// Small circled "i" that opens a compact info window. Used for settings that
// need explanation without cluttering the row with a hint paragraph.
import { useState } from "react";
import { X } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";

export function InfoDot({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={title}
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `1.5px solid ${withAlpha(colors.gold, 0.6)}`,
          background: withAlpha(colors.gold, 0.1),
          color: colors.gold,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 11,
          lineHeight: 1,
          display: "inline-grid",
          placeItems: "center",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        i
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(6,3,18,.6)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 340,
              width: "100%",
              borderRadius: 18,
              background: "linear-gradient(180deg, #241738, #180F30)",
              border: `1px solid ${withAlpha(colors.gold, 0.35)}`,
              boxShadow: "0 24px 70px rgba(0,0,0,.55)",
              padding: "16px 18px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.gold }}>{title}</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="close"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 14, color: colors.sub, lineHeight: 1.55 }}>{text}</p>
          </div>
        </div>
      )}
    </>
  );
}
