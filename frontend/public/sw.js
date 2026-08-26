// Pen Neer service worker. Deliberately conservative after a stale-cache
// incident (a deploy changes the hashed asset names, and an installed PWA that
// was serving an OLD cached index.html then asked the server for JS/CSS hashes
// that no longer exist -> 404 -> no styles, no React -> a black shell).
//
// Rules that make that impossible:
//  - HTML/navigations are ALWAYS network-first, so a fresh deploy always wins;
//    the cached shell is only a last-resort offline fallback.
//  - Hashed assets under /assets/ are immutable, so cache-first is safe and a
//    briefly-stale shell can still boot from cache instead of going black.
//  - Every activation purges ALL old caches (drops any poisoned shell).
// Never touches the WebSocket or the API.
// LET OP: elke keer dat je een bestand in public/ OVERSCHRIJFT onder dezelfde
// naam, moet dit nummer omhoog, tenzij het pad in ART_PADEN staat (die dragen
// een ?v=). Deze cache is cache-first en wordt alleen leeggegooid als zijn NAAM
// verandert, dus zonder bump blijft een geinstalleerde telefoon de oude versie
// serveren, voor altijd.
//
// Dat ging hier mis: sinds v87 (30 juli) zijn /ontdek/ (waaronder de
// letterpagina-sectie) en alle 26 letters vervangen zonder bump. In de browser
// zag je de nieuwe, op de telefoon de oude, en dat verschil is precies dit.
const CACHE = "penneer-v90"; // v89: de schil wordt nu ECHT geprecached (offline openen)
// De art in zijn EIGEN cache die releases overleeft. We deployden vandaag negen
// keer, en elke activatie gooide alles weg: elke update was daardoor een koude
// her-download van ~15MB aan knoppen, emotes, vlaggen en achtergronden. Dat is
// waarom de app "zwaar" aanvoelde. Art die op dezelfde URL wordt overschreven
// draagt al een ?v=-parameter, en een andere query is een andere cache-regel,
// dus verse art komt gewoon binnen zonder de rest te lozen.
const ART = "penneer-art-v12"; // v12: de losse art uit de wortel hoort er nu ook in
// Gehashte brokken onder /assets/. Ze zijn inhoud-geadresseerd en daarmee
// onveranderlijk, dus ze mogen een release overleven: een scherm dat al
// opgehaald was blijft werken als er intussen gedeployd is. De schil
// (index.html) blijft network-first, dus een oude schil kan nooit blijven
// hangen. Zonder dit gooide elke activatie precies de brokken weg die een
// lopende sessie nog nodig had.
const BROK = "penneer-brok-v1";
// `/fonts/` hoort hier ook: een letterbestand verandert nooit van inhoud, dus
// het had geen zin om er zes bij elke release opnieuw te halen.
const ART_PADEN = ["/ui/", "/buzzers/", "/emotes/", "/tiles/", "/vlaggen/", "/frames/", "/emblems/", "/music/", "/sfx/", "/reels/", "/shield/", "/fonts/"];
// En de LOSSE art in de wortel: logo.png, bg-main.webp, coin.webp, btn-gold en
// hun buren. Die vielen buiten de mappen hierboven en dus in de versie-cache,
// die bij elke release wordt geleegd. Gevolg: de main page haalde na elke
// deploy 2,6 MB opnieuw op, waarvan logo.png in zijn eentje 1,46 MB, en offline
// was hij er na een deploy helemaal niet meer. Alles wat een plaatje, een
// letter of een geluid is hoort in de lange cache; code (/assets/) hoort er
// juist niet in.
//
// LET OP, dit is de keerzijde: art die je onder DEZELFDE naam overschrijft
// blijft nu hangen tot ART een nieuwe naam krijgt. Geef nieuwe art een ?v= mee,
// of bump ART hieronder.
const ART_EXT = /\.(webp|png|jpe?g|gif|svg|woff2?|ttf|otf|mp3|ogg|wav|m4a)$/i;
const artCache = (pad) =>
  ART_PADEN.some((p) => pad.startsWith(p)) || (ART_EXT.test(pad) && !pad.startsWith("/assets/"));

// De vaste stukken van de schil. De GEHASHTE brokken staan hier niet bij, want
// hun namen veranderen elke release en deze worker heeft geen bouwstap die ze
// kent; die worden uit de opgehaalde index.html gevist (zie assetsUit).
const SCHIL_EXTRA = ["/manifest.webmanifest", "/icon-192.png", "/favicon.png", "/apple-touch-icon.png"];

/** De /assets/-verwijzingen uit een stuk HTML. Vite zet ze in het document als
 *  script-src, stylesheet en modulepreload, dus dit is de complete set die een
 *  koude start nodig heeft. */
const assetsUit = (html) => {
  const uit = new Set();
  const re = /\/assets\/[A-Za-z0-9_.\-]+\.(?:js|css)/g;
  let m;
  while ((m = re.exec(html))) uit.add(m[0]);
  return [...uit];
};

/** De schil in de cache zetten: het document plus alles waar het naar wijst.
 *
 *  DIT ONTBRAK. De worker cachete alleen wat je toevallig al had opgehaald, en
 *  elke activatie gooide die cache leeg. Wie de app installeerde en daarna
 *  offline ging, of wie na een release voor het eerst zonder netwerk opende,
 *  kreeg de browserfout in plaats van de app. Nu wordt de schil gevuld op het
 *  enige moment waarop dat gegarandeerd kan: tijdens install, want een nieuwe
 *  worker komt binnen terwijl je online bent. */
async function vulSchil() {
  const res = await fetch("/", { cache: "reload" });
  if (!res || !res.ok) return;
  const html = await res.clone().text();
  const c = await caches.open(CACHE);
  await c.put("/", res);
  await Promise.all(SCHIL_EXTRA.map((p) => c.add(p).catch(() => {})));
  const brok = await caches.open(BROK);
  await Promise.all(assetsUit(html).map((p) => brok.add(p).catch(() => {})));
}

self.addEventListener("install", (e) => {
  // De precache mag de installatie niet TEGENHOUDEN als er iets misgaat: een
  // worker die niet installeert laat de oude staan, en dan schiet je er niets
  // mee op. Vandaar dat elke stap zijn eigen vangnet heeft.
  e.waitUntil(vulSchil().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      // Alles weg behalve de art-cache, de brokken en DE SCHIL VAN DEZE VERSIE.
      // Die laatste stond hier niet bij, en dat was precies de bug: install
      // vulde de schil netjes, waarna activate hem meteen weer weggooide. Oude
      // versies dragen een andere naam en gaan dus nog steeds weg.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE && k !== ART && k !== BROK).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** Het laatste redmiddel: er is niets in de cache, dus dit is de allereerste
 *  keer dat iemand de app opent en er is geen netwerk. Een eigen pagina in
 *  plaats van de browserfout, in dezelfde kleuren, met de enige boodschap die
 *  hier klopt: dit lukt pas met internet, daarna werkt het wel zonder. */
const offlinePagina = () =>
  new Response(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pen Neer</title><style>
html,body{margin:0;height:100%;background:#0E0922;color:#F4EFFF;
font-family:system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
body{display:grid;place-items:center;padding:24px;text-align:center}
.k{max-width:320px}
h1{margin:0 0 10px;font-size:20px;letter-spacing:.04em;text-transform:uppercase;color:#FFC23D}
p{margin:0;font-size:14px;line-height:1.5;color:#C7C0DA}
</style></head><body><div class="k">
<h1>Geen verbinding</h1>
<p>Pen Neer heeft eenmalig internet nodig om te laden. Daarna kun je de app ook zonder verbinding openen.</p>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

const cachePut = (req, res, naam = CACHE) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(naam).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // De letters van Google. Ze staan buiten deze site, dus ze vielen tot nu toe
  // buiten elke cache: offline viel de app terug op de systeemletter en zag hij
  // er ineens anders uit. Een stylesheet van een ander domein komt binnen als
  // een dichte (opaque) reactie, dus `ok` is er onwaar en de gewone regel
  // hieronder slaat hem over; vandaar een eigen tak.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(ART).then(async (c) => {
        const hit = await c.match(req);
        const vers = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => hit || Response.error());
        return hit || vers;
      })
    );
    return;
  }
  if (url.origin !== location.origin) return; // rest van het web: browser handelt af
  if (url.pathname.startsWith("/ws")) return; // never intercept the socket
  if (url.pathname.startsWith("/api")) return; // the API is always live
  // De hartslag van de offline-check hoort NOOIT uit een cache te komen: een
  // bewaard antwoord zou een dode server levend laten lijken en de app zou
  // vrolijk knoppen aanbieden die niets doen.
  if (url.pathname === "/healthz") return;

  // The app shell: network-first so a new deploy is picked up immediately; the
  // cached shell is only used when the network truly fails (offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
            // En meteen de brokken waar deze verse schil naar wijst. Een
            // release verandert de hashes zonder dat deze worker opnieuw
            // installeert, dus zonder dit staat er na een deploy een schil in
            // de cache die naar brokken wijst die niemand heeft opgehaald.
            res.clone().text().then((html) => {
              caches.open(BROK).then((c) => {
                for (const pad of assetsUit(html)) c.add(pad).catch(() => {});
              });
            }).catch(() => {});
          }
          return res;
        })
        .catch(async () => (await caches.match("/")) || (await caches.match(req)) || offlinePagina())
    );
    return;
  }

  // Hashed assets are content-addressed and immutable: cache-first, then fill
  // from network. This is what stops a stale shell from ever going black. Art
  // gaat naar zijn eigen lang-levende cache, de rest naar de versie-cache.
  const naam = artCache(url.pathname) ? ART : url.pathname.startsWith("/assets/") ? BROK : CACHE;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => cachePut(req, res, naam)))
  );
});

// ---- Web Push: real notifications while the app is closed -------------------
self.addEventListener("push", (e) => {
  let data = { title: "Pen Neer", body: "", tag: "penneer", url: "/" };
  try {
    data = { ...data, ...e.data.json() };
  } catch {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if ("focus" in client) {
          await client.focus();
          // Een openstaand venster naar voren halen is niet genoeg: de app
          // staat dan nog op het scherm waar je hem liet liggen. Navigeren zou
          // je potje weggooien, dus de bestemming gaat als bericht naar binnen
          // en de app doet er zelf wat mee.
          client.postMessage({ type: "melding-open", url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
