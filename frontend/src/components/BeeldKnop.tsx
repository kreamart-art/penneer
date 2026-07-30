// De fotoknop in de composer: kies een plaatje uit je telefoon en stuur het.
//
// Dit is ook de weg waarlangs je een sticker uit WhatsApp verstuurt. Die zijn
// 512x512 webp met transparantie, precies wat de emotes in deze app al zijn,
// dus ze komen er zonder omzetting hetzelfde uit. Op Android deel je hem vanuit
// WhatsApp naar Bestanden of Foto's, op iOS naar Bestanden; daarna kies je hem
// hier. Een webapp kan niet in de stickerlade van WhatsApp zelf kijken.
//
// Verkleinen gebeurt HIER en niet op de server: een foto van een moderne
// telefoon is al gauw vier megabyte, en die wil je niet eerst helemaal omhoog
// duwen om hem daar te weigeren. De grens ligt op 1280 pixels aan de lange
// kant, ruim genoeg voor een chatbericht op een telefoonscherm.
//
// De uitvoer is altijd webp, ook uit een JPEG: webp houdt transparantie vast en
// dat is het enige wat een sticker nog een sticker laat zijn. Wie al klein
// genoeg is gaat ONGEWIJZIGD omhoog, want een sticker opnieuw coderen kost
// alleen maar scherpte.
import { useRef, useState } from "react";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { GlasKnop, GoudLijnDefs } from "./GlasKnop";

/** Boven deze maat wordt er verkleind; eronder gaat het bestand zoals het is. */
const KLEIN_GENOEG = 400_000;
const MAX_ZIJDE = 1280;
export const BEELD_TYPEN = "image/webp,image/png,image/jpeg,image/gif";

/** Het plaatje klaarmaken voor verzending: klein genoeg blijft zoals het is. */
async function klaarmaken(bestand: File): Promise<{ blob: Blob; mime: string } | null> {
  if (!bestand.type.startsWith("image/")) return null;
  // Een GIF beweegt, en die beweging overleeft een canvas niet: die tekent maar
  // een enkel beeldje. Dus animaties gaan altijd ongewijzigd omhoog of niet.
  if (bestand.type === "image/gif" || bestand.size <= KLEIN_GENOEG) {
    return { blob: bestand, mime: bestand.type };
  }
  const bron = await createImageBitmap(bestand).catch(() => null);
  if (!bron) return { blob: bestand, mime: bestand.type };
  const schaal = Math.min(1, MAX_ZIJDE / Math.max(bron.width, bron.height));
  const b = Math.max(1, Math.round(bron.width * schaal));
  const h = Math.max(1, Math.round(bron.height * schaal));
  const doek = document.createElement("canvas");
  doek.width = b;
  doek.height = h;
  const ctx = doek.getContext("2d");
  if (!ctx) return { blob: bestand, mime: bestand.type };
  ctx.drawImage(bron, 0, 0, b, h);
  bron.close?.();
  const blob = await new Promise<Blob | null>((klaar) => doek.toBlob(klaar, "image/webp", 0.86));
  if (!blob) return { blob: bestand, mime: bestand.type };
  return { blob, mime: "image/webp" };
}

export function BeeldKnop({
  upload,
  onSent,
  maat = 44,
}: {
  /** Zet de blob op de server en geeft het id terug, of null als het misging. */
  upload: (blob: Blob, mime: string) => Promise<string | null>;
  onSent: (imageId: string) => void;
  maat?: number;
}) {
  const { t } = useT();
  const kiesRef = useRef<HTMLInputElement | null>(null);
  const [bezig, setBezig] = useState(false);

  const gekozen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const bestand = e.target.files?.[0];
    // Het invoerveld meteen leegmaken, anders levert dezelfde foto twee keer
    // achter elkaar kiezen geen change-gebeurtenis op.
    e.target.value = "";
    if (!bestand) return;
    setBezig(true);
    try {
      const klaar = await klaarmaken(bestand);
      if (!klaar) return;
      const id = await upload(klaar.blob, klaar.mime);
      if (id) onSent(id);
    } finally {
      setBezig(false);
    }
  };

  return (
    <>
      <input
        ref={kiesRef}
        type="file"
        accept={BEELD_TYPEN}
        onChange={gekozen}
        style={{ display: "none" }}
      />
      <GlasKnop
        onClick={() => { sound.uiTap(); kiesRef.current?.click(); }}
        uit={bezig}
        label={t("beeldStuur")}
        maat={maat}
      >
        {/* Een berglandschap in een lijst: het teken voor een afbeelding dat
            iedereen uit zijn eigen telefoon kent. Dezelfde gouden lijn en
            dezelfde dikte als het vliegtuigje ernaast. */}
        <svg width={Math.round(maat * 0.44)} height={Math.round(maat * 0.44)} viewBox="0 0 24 24" fill="none" aria-hidden style={{ position: "relative" }}>
          <GoudLijnDefs id="beeld-goud" />
          <rect x="3" y="4.5" width="18" height="15" rx="2.6" stroke="url(#beeld-goud)" strokeWidth="1.3" />
          <circle cx="8.6" cy="9.8" r="1.5" fill="url(#beeld-goud)" />
          <path d="M4 16.6l4.3-4.2a1.6 1.6 0 0 1 2.2 0l3 3 1.8-1.7a1.6 1.6 0 0 1 2.2 0L20 15.4"
                stroke="url(#beeld-goud)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </GlasKnop>
    </>
  );
}
