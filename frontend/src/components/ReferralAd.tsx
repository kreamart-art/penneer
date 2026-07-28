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
import { NeonText } from "./NeonText";
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
  // Weggaan kan pas na drie tellen, en dat geldt voor ALLE uitgangen: het
  // kruisje, "misschien later" en het tikken naast de advertentie. Een kruisje
  // dat wacht terwijl er een tekstlink naast staat die het niet doet, is geen
  // wachttijd maar een omweg. Drie tellen is lang genoeg om te lezen en kort
  // genoeg om niet te ergeren.
  const [magSluiten, setMagSluiten] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMagSluiten(true), 3000);
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
          style={{ position: "absolute", right: "1%", top: "5%", width: "48%", zIndex: 0, pointerEvents: "none" }}
        />

        {/* Het bordje bovenaan, in dezelfde behandeling als het woordmerk op de
            main page: een verloop over de letter, licht waar het licht vandaan
            komt, en een schaduw eronder. De letterafstand zet ook ACHTER de
            laatste letter ruimte, dus zonder die halve stap terug staat het
            woord net links van het midden van het bordje. */}
        <span
          style={{
            position: "absolute",
            // Op het BORDJE en niet op de sectie. Gemeten in de art loopt het
            // bordje van 35,3% tot 64,5% breed en van 0,2% tot 8,8% hoog, dus
            // zijn hart ligt op 49,9% en 4,5%. Daar gaat het woord staan, midden
            // op midden. (Die eerste meting was fout: het meetvenster liep zelf
            // op 32% af, dus ik mat mijn eigen venster in plaats van het bordje.)
            left: "49.9%",
            top: "4.5%",
            transform: "translate(-50%, -50%)",
            fontFamily: font.wide,
            fontSize: "clamp(13px, 3.9vw, 17px)",
            letterSpacing: 2.2,
            lineHeight: 1.15,
          }}
        >
          {/* De negatieve marge is precies de letterafstand. Die zet ook ACHTER
              de laatste letter ruimte, en die ruimte telt mee in de doos die we
              centreren; het woord staat dan altijd een halve letterafstand te
              ver naar links. Er af halen is exact, een handmatig correctietal
              klopt maar bij een lettergrootte. */}
          <NeonText
            accent="#9B8CFF"
            depth="light"
            glowColor="#6C4BFF"
            blur={7}
            glow={0.9}
            drop={0.1}
            style={{ marginRight: -2.2 }}
          >
            PREMIUM
          </NeonText>
        </span>

        {magSluiten && (
          <button
            onClick={onSluit}
            aria-label="Sluiten"
            className="pressable pop-in"
            style={{
              position: "absolute",
              right: "5%",
              top: "7.5%",
              width: "8%",
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
                  // Karmatic Arcade: blokkerig en luid, precies wat een
                  // advertentiekop moet zijn. Wel met een eigen regelafstand,
                  // want dit font zet zijn hoofdletters hoog in de regel.
                  fontFamily: '"KA1", "Bebas Neue", sans-serif',
                  fontSize: "clamp(25px, 8.7vw, 38px)",
                  lineHeight: 1.16,
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
                SPELEN
              </h2>
              {/* Kort genoeg voor een regel, en met ruimte erboven: dat is wat
                  de kop de lucht geeft om groot te mogen zijn. */}
              <p
                style={{
                  margin: "30px 0 0",
                  // De smalle hoofdletterstijl die eerst de kop droeg. Naast
                  // een blokkerige kop leest die rustiger dan een gewone zin.
                  fontFamily: font.wide,
                  fontSize: "clamp(12px, 3.6vw, 15px)",
                  letterSpacing: 0.8,
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  color: colors.ink,
                }}
              >
                ELKE VRIEND LEVERT MUNTEN OP
              </p>
            </div>
          </div>

          {/* De ladder als strookje in plaats van als kader. Een kader eromheen
              maakt er een tweede paneel van binnen een paneel, en dat vrat de
              hoogte die de kop nodig heeft. Het opschrift ligt nu OP de lijn. */}
          <div style={{ marginTop: 18, position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
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

          <div style={{ marginTop: 10, width: "62%", alignSelf: "center" }}>
            {klaar.length > 0 ? (
              <Button variant="gold" full onClick={() => onHaalOp(klaar[0])} disabled={bezig} style={{ padding: "6px 9px", fontSize: 12.5 }}>
                {klaar[0].kind === "ai" ? "AI erbij" : `+${klaar[0].amount} munten`}
              </Button>
            ) : (
              <Button variant="gold" full onClick={onDeel} style={{ padding: "6px 9px", fontSize: 12.5 }}>
                Nodig uit
              </Button>
            )}
          </div>
          <button
            onClick={() => magSluiten && onSluit()}
            style={{
              margin: "7px auto 0",
              opacity: magSluiten ? 1 : 0.35,
              transition: "opacity .3s",
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
  const vol = "min(300px, 76vw)";
  return (
    <button
      onClick={onTik}
      aria-label="Vrienden uitnodigen"
      className={uitgeklapt ? undefined : "ad-peek"}
      style={{
        position: "fixed",
        // Links en HOOG: ter hoogte van het embleem. Daar staat niets, dus hij
        // ligt nergens overheen; onderaan zou hij op de sectie of de balk
        // vallen.
        left: 0,
        top: "11.5%",
        zIndex: 90,
        // Ingeklapt is dit een kijkgaatje van tachtig pixels. De pil zelf blijft
        // even breed, alleen het venster erover is smal, dus je ziet precies het
        // stuk met de kist en de munten. Uitschuiven is dan het venster
        // openzetten en niet de pil verplaatsen: geen halve tekst die uit het
        // niets tevoorschijn schuift.
        width: uitgeklapt ? vol : 72,
        overflow: "hidden",
        transition: "width .34s cubic-bezier(.22,1,.36,1)",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        lineHeight: 0,
      }}
    >
      <span style={{ position: "relative", display: "block", width: vol }}>
        <img src="/ads/pill.webp" alt="" style={{ width: "100%", display: "block" }} />
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
              left: "17%",
              top: "4%",
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
