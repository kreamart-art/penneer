// De uitslag van de DAGRONDE als popup, met de klok erbovenop.
//
// Dit is bewust NIET de seizoensranglijst: die staat al op zijn eigen tabblad en
// verandert nauwelijks binnen een dag. Deze popup gaat over vandaag, en dat is
// wat een aftelklok betekenis geeft.
//
// EEN lijst, geen twee. Woorden en topografie zijn twee potjes, maar de
// dagwinnaar is er maar een: die met het hoogste dagtotaal. De server telt de
// twee delen op (db.dag_totaal_board), zodat hier niets te kiezen valt en de
// hele dag op een pagina past.
//
// De hele omlijsting is EEN stuk art (dagronde-sectie.webp), inclusief het
// titelbord, de a, het uitslagicoon en de wereldbol. Dit bestand legt daar dus
// niets meer bovenop; het vult alleen de twee lege vakken die de art openlaat:
// de klok en de lijst. Die vakken staan als factoren van de popupbreedte en
// zijn in de art opgemeten, niet geschat, want een paar promille ernaast zie je
// meteen als tekst die tegen een gouden lijn plakt.
//
// Waarom factoren van de BREEDTE en niet gewoon procenten: de popup krijgt zijn
// hoogte uit een calc en niet uit aspect-ratio, maar een procent-maat op een
// kind loste alsnog op tegen het kind zelf in plaats van tegen zijn vak, en dan
// steekt de inhoud eruit. calc(var(--pop-b) * f) is gewoon een lengte en heeft
// dat probleem niet.
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { CloseIcon } from "./CloseIcon";
import { GOUD, PlekWapen } from "./ProfileHero";
import { GlasRij } from "../screens/Hub";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// Opgemeten in de bron van dagronde-sectie.webp (2430 x 4704).
//
// In deze versie van de art zit ALLES al: het titelbord, de a, het uitslag-
// icoon en de wereldbol staan in het plaatje zelf. Er hoeft hier dus niets
// meer bovenop gelegd of uitgelijnd te worden; wat overblijft is de klok en de
// lijst, en die krijgen allebei een vak dat in de art is opgemeten.
const ART_B = 2430;
const ART_H = 4704;
// Iets krapper dan de gemeten binnenmaat (x 134..2293, y 1402..4569): de
// binnenlijst heeft een gloed die een paar pixels naar binnen valt, en tekst
// hoort daar niet tegenaan te liggen.
const LIJF = { l: 0.064, t: 0.304, b: 0.872, h: 0.664 };
// De buitenhoek rechtsboven van de lijst, waar het kruis op valt. De rail
// loopt daar vanaf y 670 vrij van het titelbord.
const HOEK = { x: 0.968, y: 0.152 };

// Een smalle kier onder de lijn van de binnenlijst. Het vak boven de tegels is
// nu gevuld met de klok en de uitleg, dus daar hoeft geen marge meer bij.
const BOVEN = 0.01;

// De lijst: negen rijen zichtbaar, de rest schuift. RIJ_H is de minimumhoogte
// van een dunne GlasRij, dus negen rijen plus acht kieren is precies het vak.
const TOON = 9;
const RIJ_H = 38;
const RIJ_GAT = 5;
const VERVAAG = "linear-gradient(180deg, #000 calc(100% - 18px), transparent)";

/** Wat je met je plek wint. De ladder staat in de backend (app/dagprijzen.py)
 *  en komt per rij mee, zodat de popup nooit een prijs kan tonen die je niet
 *  krijgt. */
interface Prijs {
  kist: string | null;
  coins: number;
  cash: number;
}

interface BordRij {
  id: string;
  name: string;
  color: string;
  has_avatar?: boolean | number;
  avatar_ver: number;
  divisie?: number;
  score: number;
  time_ms: number;
  prijs?: Prijs;
}
interface Info {
  total_players: number;
  board: BordRij[];
  rank: number;
}

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

/** Seconden tot middernacht, aan de klok van dit toestel. De server stuurt dit
 *  ook mee, maar dat is een momentopname; hier moet hij per seconde doorlopen,
 *  dus rekent hij zelf. */
function totMiddernacht(): number {
  const nu = new Date();
  const morgen = new Date(nu);
  morgen.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((morgen.getTime() - nu.getTime()) / 1000));
}

function klok(s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const u = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return u > 0 ? `${u}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Een prijs in de rij: alleen het plaatje, het bedrag komt bij een tik.
 *
 *  Drie getallen naast elke naam maakt van een ranglijst een spreadsheet. Het
 *  icoon zegt genoeg dat er iets te halen valt; hoeveel precies wil je maar af
 *  en toe weten, en dan tik je erop.
 *
 *  Het bedrag verschijnt LINKS van het icoon en niet erboven: de lijst schuift,
 *  en alles wat boven een rij uitsteekt wordt door die schuifbak afgeknipt. */
function PrijsIcoon({ art, hoogte, tekst, kleur, open, onTik }: {
  art: string;
  hoogte: number;
  tekst: string;
  kleur: string;
  open: boolean;
  onTik: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); sound.uiTap(); onTik(); }}
      aria-label={tekst}
      className="pressable"
      style={{ position: "relative", background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", flexShrink: 0 }}
    >
      <img src={art} alt="" aria-hidden style={{ height: hoogte, width: "auto", display: "block" }} />
      {open && (
        <span
          style={{
            position: "absolute",
            right: "calc(100% + 4px)",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 2,
            whiteSpace: "nowrap",
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(10,5,24,.92)",
            border: `1px solid ${withAlpha(kleur, 0.55)}`,
            fontFamily: font.ui,
            fontSize: 11,
            fontWeight: 700,
            color: kleur,
          }}
        >
          {tekst}
        </span>
      )}
    </button>
  );
}

/** Wat deze plek oplevert, achter de score in de rij. De kist eerst, want dat
 *  is het ding dat je wil: munten heb je al, een kist moet je nog openen. */
function PrijsCluster({ prijs }: { prijs?: Prijs }) {
  const { t } = useT();
  const [open, setOpen] = useState<"coins" | "cash" | null>(null);
  // Vanzelf weer dicht: een bedrag dat blijft staan legt de naam ernaast af.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpen(null), 2400);
    return () => window.clearTimeout(id);
  }, [open]);
  if (!prijs) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
      {prijs.kist && (
        <img src={`/ui/${prijs.kist}.webp`} alt="" aria-hidden style={{ width: 28, height: 28, objectFit: "contain", display: "block" }} />
      )}
      {prijs.coins > 0 && (
        <PrijsIcoon
          art="/coins-stack.webp"
          hoogte={19}
          tekst={t("shopCoinsShort", { n: prijs.coins })}
          kleur={GOUD[3]}
          open={open === "coins"}
          onTik={() => setOpen((o) => (o === "coins" ? null : "coins"))}
        />
      )}
      {prijs.cash > 0 && (
        <PrijsIcoon
          art="/ui/valuta/cash.webp?v=1"
          hoogte={21}
          tekst={t("dagPrijsCash", { n: prijs.cash })}
          kleur="#8FE3A8"
          open={open === "cash"}
          onTik={() => setOpen((o) => (o === "cash" ? null : "cash"))}
        />
      )}
    </span>
  );
}

export function DagUitslagPopup({ game, onClose }: { game: GameApi; onClose: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [over, setOver] = useState(totMiddernacht);
  const [info, setInfo] = useState<Info | null>(null);

  // Elke seconde bijwerken, en opnieuw UITREKENEN in plaats van aftrekken: een
  // telefoon die in de slaapstand gaat bevriest zijn timers, en dan zou een
  // aftrekker na het ontwaken achterlopen.
  useEffect(() => {
    const id = window.setInterval(() => setOver(totMiddernacht()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Verse standen bij het openen: je komt hier om te zien hoe het NU staat.
  useEffect(() => {
    let levend = true;
    fetch("/api/daily/info", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (levend && d) setInfo(d); })
      .catch(() => {});
    return () => { levend = false; };
  }, []);

  const rijen = info?.board ?? [];
  const mijnPlek = info?.rank ?? 0;
  // Sta je buiten de lijst, dan hoort daar een regel over te staan: anders zoek
  // je jezelf in een top 25 waar je niet in staat.
  const buitenLijst = mijnPlek > 0 && !rijen.some((r) => r.id === account?.id);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 96,
        background: "rgba(6,3,18,.82)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      {/* Breedte EN hoogte staan hier als echte lengte, niet als aspect-ratio,
          zodat alles erbinnen op een lengte kan rekenen. */}
      <div
        role="dialog"
        aria-label={t("dagUitslagTitel")}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          ["--pop-b" as string]: `min(356px, calc(100vw - 40px), calc(88vh * ${ART_B} / ${ART_H}))`,
          width: "var(--pop-b)",
          height: `calc(var(--pop-b) * ${ART_H} / ${ART_B})`,
          backgroundImage: "url(/ui/dagronde-sectie.webp?v=2)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Het kruis valt OP de buitenhoek rechtsboven: half op de rail, half
            erbuiten. Het is al een ronde knop, dus geen tweede rondje eromheen. */}
        <button
          onClick={() => { sound.uiTap(); onClose(); }}
          aria-label={t("back")}
          className="pressable"
          style={{
            position: "absolute",
            left: `${HOEK.x * 100}%`,
            top: `${HOEK.y * 100}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 4,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
          }}
        >
          <CloseIcon size={22} />
        </button>

        {/* LIJF: klok, uitleg, streep en dan de lijst. */}
        <div
          style={{
            position: "absolute",
            left: `${LIJF.l * 100}%`,
            top: `${LIJF.t * 100}%`,
            width: `${LIJF.b * 100}%`,
            height: `${LIJF.h * 100}%`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            // Vanaf boven, met een vaste lucht erboven. Niet gecentreerd: dan
            // zou de lucht boven de eerste tegel meebewegen met het aantal
            // namen, en die moet juist blijven staan.
            justifyContent: "flex-start",
            paddingTop: `calc(var(--pop-b) * ${BOVEN})`,
            gap: 5,
            minHeight: 0,
          }}
        >
          {/* Zeven rijen en niet meer; de rest schuift. Staat er meer onder,
              dan loopt de onderste rij uit in het niets. Zonder dat teken is
              een afgekapte lijst niet te onderscheiden van een volledige. */}
          {/* De klok hangt direct onder de lijn van de binnenlijst. Hij is de
              reden dat je hier komt: zonder aftelling is een stand een lijstje,
              met aftelling een wedstrijd die nog loopt. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
              padding: "4px 13px",
              borderRadius: 999,
              background: withAlpha(colors.gold, 0.13),
              border: `1px solid ${withAlpha(colors.gold, 0.4)}`,
            }}
          >
            <span style={{ fontFamily: font.ui, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: colors.sub }}>
              {t("dagUitslagOver")}
            </span>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 14, lineHeight: 1, color: colors.gold, fontVariantNumeric: "tabular-nums" }}>
              {klok(over)}
            </span>
          </span>

          {/* Waarom je zou doorspelen. Dit staat er niet als uitleg maar als
              aanbod: het zegt wat je wint door het andere deel ook te doen. */}
          <p style={{ margin: 0, flexShrink: 0, paddingInline: 10, fontFamily: font.ui, fontSize: 10.5, lineHeight: 1.3, color: colors.sub, textAlign: "center" }}>
            {t("dagUitslagAanmoediging")}
          </p>

          {/* Zelfde streep als op de glasrijen: de kop erboven, de stand
              eronder. Zonder scheiding leest de tekst als de eerste regel van
              de lijst. */}
          <span
            aria-hidden
            style={{
              height: 1,
              flexShrink: 0,
              width: "76%",
              background: `linear-gradient(90deg, transparent, ${withAlpha(colors.gold, 0.7)}, transparent)`,
            }}
          />

          <div
            className="zachtscroll"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: RIJ_GAT,
              overflowY: "auto",
              minHeight: 0,
              maxHeight: TOON * RIJ_H + (TOON - 1) * RIJ_GAT,
              paddingRight: 2,
              maskImage: rijen.length > TOON ? VERVAAG : undefined,
              WebkitMaskImage: rijen.length > TOON ? VERVAAG : undefined,
            }}
          >
            {rijen.length === 0 ? (
              <p style={{ margin: "4px 0 0", fontFamily: font.ui, fontSize: 13, color: colors.faint, textAlign: "center" }}>{t("dailyEmptyBoard")}</p>
            ) : (
              rijen.map((row, i) => {
                const ik = !!account && row.id === account.id;
                return (
                  // Dezelfde dunne rij als bij het uitnodigen in de lobby, met
                  // het wapen aan de bovenlijn op het knikpunt van de hoek.
                  // Rechts 17px en niet 12: daar snijdt de hoek van de lijst
                  // een driehoek uit het vlak, en een kist van 28px hoog komt
                  // daar anders met zijn bovenhoek tegenaan.
                  <GlasRij key={row.id} dun wapen={<PlekWapen plek={i + 1} maat={24} />} binnen={{ gap: 4, padding: "3px 17px 3px 39px" }}>
                    <Avatar name={row.name} color={row.color} size={26} userId={row.id} hasAvatar={!!row.has_avatar} avatarVer={row.avatar_ver} divisie={row.divisie} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: ik ? GOUD[3] : colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.name}{ik && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                    </span>
                    <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: i === 0 ? colors.gold : colors.ink, minWidth: 22, textAlign: "right", flexShrink: 0 }}>{row.score}</span>
                    <PrijsCluster prijs={row.prijs} />
                  </GlasRij>
                );
              })
            )}
          </div>
          {buitenLijst && (
            <span style={{ fontFamily: font.ui, fontSize: 12, color: GOUD[3], textAlign: "center" }}>
              {t("dagUitslagJouwPlek", { n: mijnPlek })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
