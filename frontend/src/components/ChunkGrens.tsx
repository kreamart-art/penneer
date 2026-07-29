// De vangnet onder de lui geladen schermen.
//
// Sinds de schermen apart geladen worden (dat scheelde de helft van de eerste
// laadbeurt) haalt de app een brok pas op als je er heen gaat. Wordt er in de
// tussentijd gedeployd, dan veranderen de bestandsnamen en bestaat het brok dat
// deze pagina wil niet meer: de server geeft 404, de import faalt, en zonder
// vangnet breekt React de HELE boom af. Dat is het witte scherm.
//
// Een error boundary is de enige manier om zo'n fout te onderscheppen; try/catch
// werkt niet, want de fout ontstaat tijdens het tekenen. Bij een brok-fout laden
// we de pagina EEN keer opnieuw: de schil is network-first, dus dan komt de
// verse index.html binnen met de nieuwe namen en ben je precies waar je was.
//
// De sleutel in sessionStorage voorkomt een lus als het herladen niet helpt
// (offline, of een echte fout in de code). Dan blijft er een leesbaar scherm
// met een knop over in plaats van niets.
import { Component, type ErrorInfo, type ReactNode } from "react";

const HERLAADSLEUTEL = "penneer.chunkherlaad";

/** Is dit een brok dat niet geladen kon worden, of een echte fout in de code?
 *  Browsers formuleren het alle drie anders, vandaar deze verzameling. */
function isBrokFout(err: unknown): boolean {
  const m = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /ChunkLoadError|Loading chunk|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(m);
}

type Props = { children: ReactNode; melding: string; knop: string };
type State = { stuk: boolean };

export class ChunkGrens extends Component<Props, State> {
  state: State = { stuk: false };

  static getDerivedStateFromError(): State {
    return { stuk: true };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    if (isBrokFout(err)) {
      try {
        if (!sessionStorage.getItem(HERLAADSLEUTEL)) {
          sessionStorage.setItem(HERLAADSLEUTEL, "1");
          window.location.reload();
          return;
        }
      } catch {
        /* geen opslag: dan liever het scherm met de knop dan een lus */
      }
    }
    // Alles wat GEEN brok-fout is hoort gewoon in de console: dat is een echte
    // fout en die moet vindbaar blijven.
    console.error("Scherm kon niet laden:", err, info.componentStack);
  }

  render() {
    if (!this.state.stuk) return this.props.children;
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 28,
          textAlign: "center",
          gap: 16,
          background: "#120A1F",
          color: "#E7D8FF",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 320 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>{this.props.melding}</p>
          <button
            onClick={() => {
              try { sessionStorage.removeItem(HERLAADSLEUTEL); } catch { /* niets aan te doen */ }
              window.location.reload();
            }}
            style={{
              background: "linear-gradient(180deg, #FFD766, #E0A32E)",
              color: "#2A1A05",
              border: "none",
              borderRadius: 999,
              padding: "12px 26px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {this.props.knop}
          </button>
        </div>
      </div>
    );
  }
}

/** Wissen zodra de app weer normaal draait, zodat een VOLGENDE deploy opnieuw
 *  één herlaadpoging mag doen. */
export function chunkHerlaadWissen(): void {
  try { sessionStorage.removeItem(HERLAADSLEUTEL); } catch { /* prima */ }
}
