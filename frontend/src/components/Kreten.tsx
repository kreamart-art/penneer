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
import { GlasKnop, GoudLijnDefs } from "./GlasKnop";
import { EMOTE_PACKS, EMOTE_SRC, FREE_EMOTE_PACKS } from "./emotes";
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
 *  staan, anders hangt hij aan de volgorde waarin de modules geladen worden. */
export const KREET_KEUZE: ReadonlySet<string> = new Set(KREET_PAKKETTEN.flatMap((p) => p.sleutels));

/** De vertaalsleutel van een kreet. Eén plek, want de uitzending gebruikt hem
 *  ook: zo kan de zin op het scherm van de kiezer nooit anders zijn dan die in
 *  de uitzending. */
export function kreetSleutel(kreet: string): string {
  return `kreet_${kreet}`;
}

export function KreetKiezer({
  onKies,
  maat = 44,
  pakketten,
}: {
  /** Wat er gekozen is: een zin OF een sticker, nooit allebei. */
  onKies: (keuze: { kreet?: string; emote?: string }) => void;
  maat?: number;
  /** Welke stickerpakketten deze speler mag sturen. Leeg valt terug op het
   *  gratis pakket, net als in de chat. */
  pakketten?: string[];
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // Twee soorten tekens: de vaste ZINNEN en onze eigen STICKERS. Ze staan in
  // hetzelfde laadje achter twee tabs en niet onder elkaar: het zijn twee
  // manieren om hetzelfde te doen, en een lijst van zestien zinnen met daaronder
  // zesendertig plaatjes is geen laadje meer maar een scherm.
  const [tab, setTab] = useState<"zin" | "sticker">("zin");
  const mijn = new Set(pakketten ?? FREE_EMOTE_PACKS);
  const stickers = EMOTE_PACKS.filter((p) => mijn.has(p.id));
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
      {/* Dezelfde glastegel als het vliegtuigje, de foto en de microfoon in de
          chatbalk: donker vlak glas met een gouden haarring eromheen, en het
          teken erin in dezelfde gouden lijn. Het is hetzelfde soort knop (iets
          zeggen tegen de room), dus het hoort ook hetzelfde te zijn. */}
      <GlasKnop
        onClick={() => {
          sound.uiTap();
          setOpen((v) => !v);
        }}
        label={t("kreetKies")}
        maat={maat}
      >
        {/* Een tekstwolkje met drie puntjes: praten. Dezelfde lijndikte als het
            berglandschap van de fotoknop, zodat de tekens uit één set komen. */}
        <svg width={Math.round(maat * 0.46)} height={Math.round(maat * 0.46)} viewBox="0 0 24 24" fill="none" aria-hidden style={{ position: "relative" }}>
          <GoudLijnDefs id="kreet-goud" />
          <path
            d="M20.2 12.1c0 3.7-3.4 6.7-7.7 6.7-1 0-2-.2-2.9-.5l-4.2 1.4 1.4-3.5a6.3 6.3 0 0 1-1.7-4.1c0-3.7 3.4-6.7 7.6-6.7s7.5 3 7.5 6.7Z"
            stroke="url(#kreet-goud)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="9.3" cy="12.1" r="1" fill="url(#kreet-goud)" />
          <circle cx="12.6" cy="12.1" r="1" fill="url(#kreet-goud)" />
          <circle cx="15.9" cy="12.1" r="1" fill="url(#kreet-goud)" />
        </svg>
      </GlasKnop>

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
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {(["zin", "sticker"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { sound.uiTap(); setTab(k); }}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 9, border: "none", cursor: "pointer",
                  fontFamily: font.ui, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                  background: tab === k ? withAlpha(colors.gold, 0.22) : "rgba(255,255,255,.05)",
                  color: tab === k ? colors.gold : colors.sub,
                }}
              >
                {t(k === "zin" ? "kreetTabZin" : "kreetTabSticker")}
              </button>
            ))}
          </div>

          {tab === "sticker" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {stickers.flatMap((p) => p.emotes).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="pressable"
                  onClick={() => { sound.uiTap(); setOpen(false); onKies({ emote: id }); }}
                  style={{
                    display: "grid", placeItems: "center", padding: 2,
                    borderRadius: 10, border: "none", cursor: "pointer",
                    background: "rgba(255,255,255,.04)",
                  }}
                >
                  <img src={EMOTE_SRC(id)} alt="" width={58} height={58} style={{ width: 58, height: 58, display: "block", objectFit: "contain" }} />
                </button>
              ))}
            </div>
          )}

          {tab === "zin" && KREET_PAKKETTEN.map(({ pak, sleutels }) => (
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
                    onKies({ kreet: s });
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
