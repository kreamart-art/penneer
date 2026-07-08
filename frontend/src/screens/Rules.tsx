// How-to-play screen with simple inline SVG illustrations for each phase.
import { Button } from "../components/Button";
import { Emblem } from "../components/Emblem";
import { MusicToggle } from "../components/MusicToggle";
import { Screen, Card } from "../components/Layout";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

function StepArt({ kind }: { kind: "rooms" | "spin" | "fill" | "score" }) {
  const g = colors.gold;
  const v = colors.violet;
  const common = { width: 56, height: 56, viewBox: "0 0 56 56", fill: "none" } as const;
  if (kind === "rooms")
    return (
      <svg {...common} aria-hidden>
        <rect x="8" y="6" width="16" height="28" rx="3" stroke={v} strokeWidth="2" />
        <rect x="32" y="14" width="16" height="28" rx="3" stroke={g} strokeWidth="2" />
        <circle cx="16" cy="38" r="2" fill={v} />
        <circle cx="40" cy="46" r="2" fill={g} />
      </svg>
    );
  if (kind === "spin")
    return (
      <svg {...common} aria-hidden>
        <rect x="14" y="8" width="28" height="40" rx="6" fill={withAlpha(g, 0.1)} stroke={g} strokeWidth="2" />
        <text x="28" y="36" textAnchor="middle" fontFamily="'Space Grotesk'" fontWeight="700" fontSize="24" fill={g}>
          B
        </text>
      </svg>
    );
  if (kind === "fill")
    return (
      <svg {...common} aria-hidden>
        <rect x="8" y="14" width="40" height="8" rx="4" stroke={v} strokeWidth="2" />
        <rect x="8" y="28" width="40" height="8" rx="4" stroke={g} strokeWidth="2" />
        <rect x="8" y="28" width="22" height="8" rx="4" fill={withAlpha(g, 0.4)} />
      </svg>
    );
  return (
    <svg {...common} aria-hidden>
      <path d="M18 10h20v8a10 10 0 0 1-20 0z" stroke={g} strokeWidth="2" fill={withAlpha(g, 0.12)} />
      <path d="M24 30h8v8h-8z" stroke={g} strokeWidth="2" />
      <rect x="20" y="40" width="16" height="4" rx="2" fill={g} />
    </svg>
  );
}

export function Rules({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const steps: { kind: "rooms" | "spin" | "fill" | "score"; title: string; body: string }[] = [
    { kind: "rooms", title: t("rulesStep1Title"), body: t("rulesStep1Body") },
    { kind: "spin", title: t("rulesStep2Title"), body: t("rulesStep2Body") },
    { kind: "fill", title: t("rulesStep3Title"), body: t("rulesStep3Body") },
    { kind: "score", title: t("rulesStep4Title"), body: t("rulesStep4Body") },
  ];

  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <MusicToggle />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Emblem size={64} />
          <h2 style={{ margin: 0, fontFamily: font.display, fontWeight: 700, fontSize: 26, color: colors.ink }}>
            {t("rulesTitle")}
          </h2>
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub, maxWidth: 320 }}>
            {t("rulesIntro")}
          </p>
        </div>

        {steps.map((s, i) => (
          <Card key={i} style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                flexShrink: 0,
                width: 64,
                height: 64,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                background: withAlpha("#000000", 0.2),
                border: `1px solid ${colors.hairline}`,
              }}
            >
              <StepArt kind={s.kind} />
            </div>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink, marginBottom: 2 }}>
                {s.title}
              </div>
              <div style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.45 }}>{s.body}</div>
            </div>
          </Card>
        ))}

        <Button variant="gold" full onClick={onBack}>
          {t("gotIt")}
        </Button>
      </div>
    </Screen>
  );
}
