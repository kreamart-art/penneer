// De zwevende kreet: wat iemand roept als hij klaar is, zie je terwijl je typt.
//
// WAAROM DIT ER MOET ZIJN. Je kiest naast de klaarknop een zin ("klaar om te
// winnen", "ik wacht wel even"), en die zin las tot nu toe alleen de uitzending.
// Wie zat te typen zag er niets van, en dat is precies het moment waarop hij
// hoort aan te komen: iemand is klaar en jij nog niet.
//
// RECHTS EN ZWEVEND, en hij mag over de invulvelden heen. Rechts en niet links,
// want je typt van links af: aan die kant staat je antwoord en aan de rechterkant
// blijft er ruimte over, ook als je een lang woord invult. Hij staat er drie
// tellen en is dan weg, dus de rest van het scherm hoeft er niet voor opzij: de
// velden staan gewoon in het midden zoals ze stonden. Vast aan het scherm
// (`fixed`), zodat hij blijft staan als het toetsenbord de pagina omhoog duwt,
// en `pointer-events: none`, want hij mag nooit een toets in de weg zitten.
//
// WIT MET EEN ZWARTE LIJN, klassiek stripverhaal, staartje en al. Dat is met
// opzet het enige in de app dat er zo uitziet: alles eromheen is paars en goud,
// dus een witte ballon springt eruit zonder dat er iets hoeft te knipperen.
//
// ALLEEN VAN EEN ANDER. Je eigen klaarmelding zie je aan de knop die van kleur
// verschiet; een ballon van jezelf zou alleen je eigen scherm vullen.
import { useEffect, useRef, useState } from "react";
import { KREET_KEUZE, kreetSleutel } from "./Kreten";
import { Avatar } from "./Avatar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { font } from "../theme/tokens";

/** Hoe lang een ballon blijft staan. Lang genoeg om hem te lezen terwijl je
 *  typt, kort genoeg om niet in de weg te blijven hangen. */
const STA = 3000;

type Ballon = {
  sleutel: number;
  naam: string;
  kleur: string;
  zin: string;
  userId?: string | null;
  heeftFoto?: boolean;
  fotoVer?: number;
};

export function KreetZwever({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room;
  const klaar = room?.ready_ids ?? [];
  const kreten = room?.ready_kreten;
  const [ballon, setBallon] = useState<Ballon | null>(null);
  const gezien = useRef<Set<string>>(new Set(klaar));
  const teller = useRef(0);

  useEffect(() => {
    const nu = new Set(klaar);
    // Wie er NIEUW bij is gekomen sinds de vorige keer. Wie klaar afzet
    // verdwijnt gewoon uit de verzameling en mag later opnieuw roepen.
    const nieuw = klaar.filter((id) => !gezien.current.has(id) && id !== game.me?.id);
    gezien.current = nu;
    const id = nieuw[nieuw.length - 1];
    if (!id || !room) return;
    const p = room.players.find((x) => x.id === id);
    if (!p) return;
    const kreet = kreten?.[id];
    teller.current += 1;
    setBallon({
      sleutel: teller.current,
      naam: p.name,
      kleur: p.color,
      zin: kreet && KREET_KEUZE.has(kreet) ? t(kreetSleutel(kreet)) : t("streamIsKlaar"),
      userId: p.user_id,
      heeftFoto: p.has_avatar,
      fotoVer: p.avatar_ver,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klaar.join(","), kreten]);

  useEffect(() => {
    if (!ballon) return;
    const id = window.setTimeout(() => setBallon(null), STA);
    return () => window.clearTimeout(id);
  }, [ballon]);

  if (!ballon) return null;
  return (
    <div
      key={ballon.sleutel}
      className="kreet-zwever"
      aria-hidden
      style={{
        position: "fixed",
        right: 10,
        top: "44%",
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        maxWidth: "min(62vw, 230px)",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "3px solid #100C1C",
          borderRadius: 18,
          padding: "9px 13px 8px",
          boxShadow: "0 10px 26px rgba(0,0,0,.45)",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <Avatar name={ballon.naam} color={ballon.kleur} size={30} userId={ballon.userId} hasAvatar={ballon.heeftFoto} avatarVer={ballon.fotoVer} />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 800, color: "#100C1C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ballon.naam}
          </span>
          <span style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: "#2A2438", lineHeight: 1.25 }}>
            {ballon.zin}
          </span>
        </span>
      </div>
      {/* Het staartje RECHTSonder, want de ballon hangt rechts: twee driehoeken
          over elkaar, de zwarte een tikje groter, zodat de lijn eromheen
          doorloopt. Met een enkele vorm en een border krijg je die lijn niet
          mee. */}
      <svg width="30" height="18" viewBox="0 0 30 18" style={{ display: "block", marginTop: -3, marginRight: 14 }}>
        <path d="M30 0 L4 0 L26 17 Z" fill="#100C1C" />
        <path d="M26 0 L9 0 L24 12 Z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
