import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n/i18n";
import { initPwa } from "./pwa/install";
import { armViewportHealer } from "./pwa/viewportFix";
import "./index.css";

initPwa();
armViewportHealer();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>
);
