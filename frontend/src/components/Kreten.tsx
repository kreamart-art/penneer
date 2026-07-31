// De kreet waarmee je klaar gaat.
//
// "Ik ben klaar" is een mededeling. "Ik ben klaar om te winnen" is een potje.
// Naast de klaarknop staat daarom een chatteken dat een laadje opentrekt met
// zestien zinnen in vier pakketten; kies je er een, dan gaat die zin met je
// klaarmelding mee en leest de hele room hem in de uitzending, boven je naam.
//
// Alleen de SLEUTEL gaat over de lijn, nooit de zin zelf. Twee redenen: de
// kijker leest hem in zijn eigen taal, en niemand kan eigen tekst op het scherm
// van een ander duwen. De server kent dezelfde zestien sleutels en gooit al het
// andere weg (backend/app/rooms.py, KREET_SLEUTELS).
import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** De pakketten met hun sleutels. De volgorde is die van het laadje. */
export const KREET_PAKKETTEN: { pak: string; sleutels: string[] }[] = [
  { pak: "blij", sleutels: ["winnen", "trots", "vlot", "grijns"] },
  { pak: "stoer", sleutels: ["beter", "makkelijk", "wachten", "alles"] },
  { pak: "boos", sleutels: ["rotletter", "tijd", "gegokt", "chagrijn"] },
  { pak: "plagen", sleutels: ["koffie", "dutje", "hulp", "mazzel"] },
];

/** Alle geldige kreten, plat. Staat HIER en niet bij de uitzending: een lijst
 *  die uit `KREET_PAKKETTEN` wordt afgeleid hoort in hetzelfde bestand te
 *  staan, anders hangt hij aan de vololgorde waarin de modules geladen worden. */
export const KREET_KEUZE: ReadonlySet<string> = new Set(KREET_PAKKETTEN.flatMap((p) => p.sleutels));

/** De vertaalsleutel van een kreet. Eén plek, want de uitzending gebruikt hem
 *  ook: zo kan de zin op het scherm van de kiezer nooit anders zijn dan die in
 *  de uitzending. */
export function kreetSleutel(kreet: string): string {
  return `kreet_${kreet}`;
}

export function KreetKiezer({
  onKies,
  maat = 34,
}: {
  /** De gekozen kreet. Dit MELDT je meteen klaar, met die zin erbij. */
  onKies: (kreet: string) => void;
  maat?: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const doos = useRef<HTMLDivElement | null>(null);

  // Buiten het laadje tikken sluit het. Zonder dit blijft het openstaan over
  // een scherm waar je verder wil, en dat is precies het moment waarop de klok
  // loopt.
  useEffect(() => {
    if (!open) return;
    const weg = (e: MouseEvent | TouchEvent) => {
      if (doos.current && !doos.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", weg);
    document.addEventListener("touchstart", weg);
    return () => {
      document.removeEventListener("mousedown", weg);
      document.removeEventListener("touchstart", weg);
    };
  }, [open]);

  return (
    <div ref={doos} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label={t("kreetKies")}
        title={t("kreetKies")}
        className="pressable glowhover-klein"
        onClick={() => {
          sound.uiTap();
          setOpen((v) => !v);
        }}
        style={{
          width: maat,
          height: maat,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          position: "relative",
          background: "linear-gradient(180deg, rgba(24,14,54,.95) 0%, rgba(14,8,34,.95) 100%)",
          boxShadow: `inset 0 0 0 1px ${withAlpha(colors.gold, open ? 0.75 : 0.4)}`,
          color: withAlpha(colors.gold, 0.9),
        }}
      >
        <MessageCircle size={Math.round(maat * 0.48)} strokeWidth={2} />
      </button>

      {open && (
        // Het laadje klapt OMHOOG open: de knop staat onderaan het scherm, dus
        // naar beneden is er niets meer.
        <div
          className="zacht-in"
          style={{
            position: "absolute",
            right: 0,
            bottom: maat + 10,
            width: 240,
            maxHeight: "46vh",
            overflowY: "auto",
            padding: 8,
            borderRadius: 14,
            background: "linear-gradient(180deg, #1B1245 0%, #140C33 100%)",
            boxShadow: `inset 0 0 0 1px ${withAlpha(colors.gold, 0.45)}, 0 12px 30px rgba(0,0,0,.6)`,
            zIndex: 40,
          }}
        >
          {KREET_PAKKETTEN.map(({ pak, sleutels }) => (
            <div key={pak} style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontFamily: font.ui,
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: withAlpha(colors.gold, 0.8),
                  padding: "4px 6px 3px",
                }}
              >
                {t(`kreetPak_${pak}`)}
              </div>
              {sleutels.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pressable"
                  onClick={() => {
                    sound.uiTap();
                    setOpen(false);
                    onKies(s);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 8px",
                    marginBottom: 2,
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    background: "rgba(255,255,255,.04)",
                    fontFamily: font.ui,
                    fontSize: 12,
                    color: colors.ink,
                  }}
                >
                  {t(kreetSleutel(s))}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
