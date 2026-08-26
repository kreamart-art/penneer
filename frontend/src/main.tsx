import { zetKlassiekeKlasse } from "./theme/tileSkin";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n/i18n";
import { OnlineProvider } from "./net/online";
import { initPwa } from "./pwa/install";
import { armViewportHealer } from "./pwa/viewportFix";
import "./index.css";

initPwa();
armViewportHealer();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LangProvider>
      <OnlineProvider>
        <App />
      </OnlineProvider>
    </LangProvider>
  </React.StrictMode>
);

// De klassieke look zet een klasse op <html> voor de CSS-achtergronden.
zetKlassiekeKlasse();
