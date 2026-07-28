// De werf-advertentie: haal je vrienden binnen, verdien munten en uiteindelijk
// de AI-scheidsrechter.
//
// Hij heeft twee gedaanten. De grote popup is de vraag zelf. Tik je hem weg,
// dan blijft er een pil aan de zijkant hangen die voor het grootste deel buiten
// beeld staat: genoeg om te zien dat er iets is, te weinig om in de weg te
// zitten. Een tik schuift hem naar binnen, nog een tik opent de popup weer.
//
// Waarom die pil er is: een advertentie die je wegklikt en die dan weg BLIJFT
// vraagt maar een keer. Eentje die aan de rand blijft hangen vraagt het elke
// sessie opnieuw, zonder dat hij iets blokkeert. Dat is het verschil tussen een
// aanbod dat je een keer ziet en een aanbod dat je onthoudt.
//
// De ladder loopt OP en niet af (100, 150, 250, 100, dan de AI). De tweede
// vriend kost meer moeite dan de eerste, want de makkelijkste vraag je het
// eerst; een aflopende beloning voelt dan als straf. De grote prijs staat op
// vijf, zodat er iets is om naartoe te werken.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

type Tier = { n: number; kind: "coins" | "ai"; amount: number; reached: boolean; claimed: boolean };
type Info = { code: string; count: number; tiers: Tier[]; repeat: number };

const KLEIN_SLEUTEL = "penneer.refAdKlein"; // popup al eens weggetikt in deze sessie

function authHeaders(): Record<string, string> {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

/** De eerstvolgende beloning die nog niet binnen is. Dat is waar de tekst over
 *  gaat: niet "je hebt er drie", maar "nog twee tot de AI-scheidsrechter". */
function volgende(info: Info | null): Tier | null {
  if (!info) return null;
  return info.tiers.find((t) => !t.reached) ?? null;
}

/** Wat er klaarstaat om op te halen. */
function teHalen(info: Info | null): Tier[] {
  if (!info) return [];
  return info.tiers.filter((t) => t.reached && !t.claimed);
}

export function ReferralAd() {
  const [info, setInfo] = useState<Info | null>(null);
  // "groot" is de popup, "pil" is het randje, "uit" is helemaal weg (alleen
  // tijdens het laden).
  const [vorm, setVorm] = useState<"uit" | "groot" | "pil">("uit");
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const [bezig, setBezig] = useState(false);
  const gestart = useRef(false);

  const laad = useCallback(() => {
    fetch("/api/referral/info", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Info | null) => {
        if (!d) return;
        setInfo(d);
        if (!gestart.current) {
          gestart.current = true;
          let alGezien = false;
          try {
            alGezien = sessionStorage.getItem(KLEIN_SLEUTEL) === "1";
          } catch {
            /* geen opslag */
          }
          setVorm(alGezien ? "pil" : "groot");
        }
      })
      .catch(() => {});
  }, []);
  useEffect(laad, [laad]);

  const sluit = () => {
    sound.uiTap();
    try {
      sessionStorage.setItem(KLEIN_SLEUTEL, "1");
    } catch {
      /* geen opslag */
    }
    setVorm("pil");
    setUitgeklapt(false);
  };

  const deel = async () => {
    if (!info?.code) return;
    sound.uiTap();
    const link = `${window.location.origin}/?ref=${info.code}`;
    const tekst = `Speel Pen Neer met mij. Via deze link krijg je meteen mee wat ik heb: ${link}`;
    try {
      if (navigator.share) await navigator.share({ text: tekst });
      else await navigator.clipboard.writeText(tekst);
    } catch {
      /* afgebroken door de gebruiker */
    }
  };

  const haalOp = async (t: Tier) => {
    if (bezig) return;
    setBezig(true);
    sound.uiTap();
    try {
      const r = await fetch("/api/referral/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ milestone: t.n }),
      });
      if (r.ok) laad();
    } catch {
      /* netwerkhikje: de knop blijft staan */
    } finally {
      setBezig(false);
    }
  };

  if (vorm === "uit" || !info) return null;
  if (vorm === "pil") {
    return <Pil uitgeklapt={uitgeklapt} teHalen={teHalen(info).length} onTik={() => {
      sound.uiTap();
      if (uitgeklapt) setVorm("groot");
      else setUitgeklapt(true);
    }} />;
  }
  return (
    <Popup
      info={info}
      bezig={bezig}
      onSluit={sluit}
      onDeel={deel}
      onHaalOp={haalOp}
    />
  );
}

// ---- de grote popup --------------------------------------------------------

function Popup({
  info,
  bezig,
  onSluit,
  onDeel,
  onHaalOp,
}: {
  info: Info;
  bezig: boolean;
  onSluit: () => void;
  onDeel: () => void;
  onHaalOp: (t: Tier) => void;
}) {
  const klaar = teHalen(info);
  const komt = volgende(info);
  // Het kruisje komt pas na vijf tellen. Dat is hoe elke beloningsadvertentie
  // in een spel werkt: er moet even niets anders te doen zijn dan lezen. Te
  // lang en het wordt ergernis, dus vijf en geen tien.
  const [magSluiten, setMagSluiten] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMagSluiten(true), 5000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div
      onClick={() => magSluiten && onSluit()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        background: "rgba(4,2,14,.82)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        style={{ position: "relative", width: "100%", maxWidth: 380 }}
      >
        {/* De lijst is EEN plaatje dat de doos vult. Hij rekt dus mee met de
            tekst; daarom staat er weinig tekst in. Uit elkaar knippen gaf een
            zichtbare naad, en dat is erger dan een hoek die een paar procent
            hoger staat dan in de art. */}
        <img
          src="/ads/frame.webp"
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />

        {/* De kist ligt IN de sectie, als onderste laag van alles wat erop
            staat: de kop, de beloningen en de knoppen gaan er allemaal
            overheen. Daarom staat hij hier en niet in de rij met de tekst; in
            de stroom zou hij ruimte opeisen en de tekst opzij duwen, en dat is
            precies wat hij niet moet doen. */}
        <img
          src="/ads/chest.webp"
          alt=""
          aria-hidden
          style={{ position: "absolute", right: "3%", top: "6%", width: "37%", zIndex: 0, pointerEvents: "none" }}
        />

        {/* Het bordje bovenaan. De letterafstand zet ook ACHTER de laatste
            letter ruimte, dus zonder die halve stap terug staat het woord net
            links van het midden van het bordje. */}
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "1.4%",
            transform: "translateX(calc(-50% + 0.9px))",
            fontFamily: font.wide,
            fontSize: "clamp(10px, 3vw, 13px)",
            letterSpacing: 1.8,
            color: colors.gold,
            textShadow: "0 1px 2px rgba(0,0,0,.6)",
          }}
        >
          PREMIUM
        </span>

        {magSluiten && (
          <button
            onClick={onSluit}
            aria-label="Sluiten"
            className="pressable pop-in"
            style={{
              position: "absolute",
              right: "-3%",
              top: "-3%",
              width: "11%",
              zIndex: 2,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            <img src="/ads/close.webp" alt="" style={{ width: "100%", display: "block" }} />
          </button>
        )}

        {/* `zIndex` moet hier staan en niet alleen `position`. Zonder eigen
            nummer is dit geen eigen stapellaag, en dan schilderen de tegeltjes
            en de lijn (gewone blokken) ONDER de kist, want een geplaatst
            element gaat altijd voor een niet-geplaatst blok. */}
        <div style={{ position: "relative", zIndex: 1, padding: "9% 7.5% 7%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 100%", minWidth: 0, maxWidth: "58%", paddingTop: "2%" }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: font.wide,
                  fontSize: "clamp(26px, 9vw, 40px)",
                  lineHeight: 0.94,
                  letterSpacing: 0.5,
                  backgroundImage: "linear-gradient(168deg, #FFEBB8 0%, #FFC23D 46%, #E39A12 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 2px 0 rgba(74,46,4,.35)",
                }}
              >
                SAMEN
                <br />
                SPELEN.
              </h2>
              <p
                style={{
                  margin: "9px 0 0",
                  fontFamily: font.ui,
                  fontSize: "clamp(11px, 3.3vw, 13px)",
                  lineHeight: 1.35,
                  color: colors.ink,
                }}
              >
                Elke vriend die meedoet levert je munten op.
              </p>
            </div>
          </div>

          {/* De ladder als strookje in plaats van als kader. Een kader eromheen
              maakt er een tweede paneel van binnen een paneel, en dat vrat de
              hoogte die de kop nodig heeft. Het opschrift ligt nu OP de lijn. */}
          <div style={{ marginTop: -2, position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${withAlpha(colors.gold, 0.45)})` }} />
            <span
              style={{
                fontFamily: font.wide,
                fontSize: "clamp(9px, 2.7vw, 11px)",
                letterSpacing: 1.3,
                color: colors.sub,
                whiteSpace: "nowrap",
              }}
            >
              JOUW BELONINGEN
            </span>
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${withAlpha(colors.gold, 0.45)}, transparent)` }} />
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
            {info.tiers.slice(0, 5).map((t) => (
              <Trede key={t.n} t={t} volgend={komt?.n === t.n} />
            ))}
          </div>

          <div style={{ marginTop: 10, width: "74%", alignSelf: "center" }}>
            {klaar.length > 0 ? (
              <Button variant="gold" full onClick={() => onHaalOp(klaar[0])} disabled={bezig} style={{ padding: "7px 10px", fontSize: 13 }}>
                {klaar[0].kind === "ai" ? "AI-scheidsrechter ophalen" : `+${klaar[0].amount} munten ophalen`}
              </Button>
            ) : (
              <Button variant="gold" full onClick={onDeel} style={{ padding: "7px 10px", fontSize: 13 }}>
                Stuur naar een vriend
              </Button>
            )}
          </div>
          <button
            onClick={onSluit}
            style={{
              margin: "7px auto 0",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: font.wide,
              fontSize: "clamp(10px, 2.9vw, 12px)",
              letterSpacing: 1.2,
              color: withAlpha(colors.violet, 0.95),
            }}
          >
            MISSCHIEN LATER
          </button>
        </div>
      </div>
    </div>
  );
}

/** Een trede van de ladder: het aantal, wat je krijgt, en of het al binnen is. */
function Trede({ t, volgend }: { t: Tier; volgend: boolean }) {
  const aan = t.reached;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 9,
        padding: "6px 2px 5px",
        textAlign: "center",
        border: `1px solid ${aan ? withAlpha(colors.gold, 0.7) : volgend ? withAlpha(colors.gold, 0.4) : "rgba(255,255,255,.1)"}`,
        background: aan
          ? "linear-gradient(180deg, rgba(255,194,61,.26), rgba(120,80,10,.18))"
          : volgend
            ? "linear-gradient(180deg, rgba(255,194,61,.12), rgba(0,0,0,.16))"
            : "rgba(0,0,0,.22)",
        opacity: aan || volgend ? 1 : 0.55,
      }}
    >
      <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 13, color: aan ? "#FFEBB8" : colors.sub, lineHeight: 1 }}>
        {t.n}
      </div>
      <div style={{ fontFamily: font.ui, fontSize: 9, color: aan ? colors.gold : colors.faint, marginTop: 3, lineHeight: 1.1 }}>
        {t.kind === "ai" ? "AI" : `+${t.amount}`}
      </div>
    </div>
  );
}

// ---- de pil aan de zijkant -------------------------------------------------

function Pil({ uitgeklapt, teHalen, onTik }: { uitgeklapt: boolean; teHalen: number; onTik: () => void }) {
  return (
    <button
      onClick={onTik}
      aria-label="Vrienden uitnodigen"
      style={{
        position: "fixed",
        // Boven de balk, onder de popup. Rechts vastgezet en dan naar buiten
        // geschoven: ingeklapt staat zestig procent van de pil buiten beeld,
        // dus je ziet de kist en verder niets.
        right: 0,
        bottom: "calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 74px)",
        zIndex: 90,
        width: "min(300px, 76vw)",
        transform: uitgeklapt ? "translateX(0)" : "translateX(60%)",
        transition: "transform .34s cubic-bezier(.22,1,.36,1)",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        lineHeight: 0,
      }}
    >
      <span style={{ position: "relative", display: "block" }}>
        <img src="/ads/pill.webp" alt="" style={{ width: "100%", display: "block" }} />
        {/* De tekst staat rechts van de kist, in het paarse vlak van de art. */}
        <span
          style={{
            position: "absolute",
            left: "34%",
            right: "6%",
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: font.wide,
            fontSize: "clamp(11px, 3.2vw, 14px)",
            letterSpacing: 1,
            lineHeight: 1.15,
            color: "#FFEBB8",
            textShadow: "0 2px 4px rgba(0,0,0,.6)",
            textAlign: "center",
          }}
        >
          {teHalen > 0 ? "BELONING KLAAR" : "NODIG UIT"}
        </span>
        {teHalen > 0 && (
          <span
            style={{
              position: "absolute",
              right: "4%",
              top: "6%",
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "linear-gradient(158deg, #FFEBB8, #FFC23D 46%, #B07C17)",
              boxShadow: "0 0 0 1.4px #4A2E04, 0 2px 5px rgba(0,0,0,.5)",
              fontFamily: font.display,
              fontWeight: 800,
              fontSize: 11,
              lineHeight: "18px",
              color: "#2A1802",
            }}
          >
            {teHalen}
          </span>
        )}
      </span>
    </button>
  );
}
