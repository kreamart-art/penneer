// Pen Neer — render a shareable result card to a PNG (canvas, no assets) and
// share via the Web Share API, falling back to a download.
import { colors } from "../theme/tokens";

interface Row {
  name: string;
  score: number;
  color: string;
}

interface CardOpts {
  winnerLabel: string; // "Winnaar" / "Shared lead"
  winnerNames: string; // joined names
  pointsText: string; // "120 punten"
  rows: Row[];
  footer: string;
}

function drawEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // dashed ring
  ctx.save();
  ctx.strokeStyle = colors.gold;
  ctx.lineWidth = r * 0.05;
  ctx.setLineDash([r * 0.09, r * 0.16]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // nib
  ctx.save();
  ctx.translate(cx, cy);
  const s = r / 30;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = r * 0.4;
  ctx.fillStyle = colors.gold;
  ctx.beginPath();
  ctx.moveTo(0, -26 * s);
  ctx.lineTo(13 * s, 14 * s);
  ctx.bezierCurveTo(13 * s, 22 * s, 7 * s, 27 * s, 0, 27 * s);
  ctx.bezierCurveTo(-7 * s, 27 * s, -13 * s, 22 * s, -13 * s, 14 * s);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = colors.bg0;
  ctx.beginPath();
  ctx.arc(0, -2 * s, 3.4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-1.2 * s, -6 * s, 2.4 * s, 26 * s);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}


/** Een afgeschuinde rechthoek: de vorm van elke glasrij in de app. */
function schuinPad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/** De glasrij zoals in de ranglijst: doorzichtig van binnen, een haarlijn die
 *  bijna uit staat, en een lichtstreep over de bovenrand met zijn piek. Op het
 *  scherm is die streep een eigen laag; op canvas is het een verloop, en dat
 *  komt op deze maat op hetzelfde neer. */
function glasRij(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, piek = 0.5) {
  const c = 16;
  ctx.save();
  schuinPad(ctx, x, y, w, h, c);
  ctx.fillStyle = "rgba(10,4,26,.34)";
  ctx.fill();
  ctx.strokeStyle = "rgba(200,160,255,.22)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // de lichtstreep met zijn piek, boven en (zachter) onder
  const streep = (yy: number, sterkte: number) => {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const k = (v: number) => Math.max(0, Math.min(1, piek + v));
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(k(-0.24), "rgba(0,0,0,0)");
    g.addColorStop(k(-0.1), `rgba(138,80,240,${0.3 * sterkte})`);
    g.addColorStop(k(0), `rgba(255,250,238,${0.9 * sterkte})`);
    g.addColorStop(k(0.1), `rgba(138,80,240,${0.3 * sterkte})`);
    g.addColorStop(k(0.24), "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x + c, yy, w - c * 2, 2);
  };
  streep(y, 1);
  streep(y + h - 2, 0.45);

  // gouden kappen in de vier hoeken, net als op het scherm
  const arm = 14;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#FFEBB8");
  g.addColorStop(0.38, "#FFCF4A");
  g.addColorStop(0.72, "#E2A33C");
  g.addColorStop(1, "#9C6B1F");
  ctx.save();
  ctx.strokeStyle = accent === "goud" ? g : "rgba(200,160,255,.5)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const px = sx > 0 ? x : x + w;
    const py = sy > 0 ? y : y + h;
    ctx.beginPath();
    ctx.moveTo(px + sx * (c + arm), py);
    ctx.lineTo(px + sx * c, py);
    ctx.lineTo(px, py + sy * c);
    ctx.lineTo(px, py + sy * (c + arm));
    ctx.stroke();
  }
  ctx.restore();
}

export async function makeShareCard(opts: CardOpts): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await Promise.all([
      document.fonts.load("700 120px 'Space Grotesk'"),
      document.fonts.load("600 36px Inter"),
    ]);
  } catch {
    /* fall back to default fonts */
  }

  // De ARENA als achtergrond, dezelfde als op de lobby en de dagronde: een
  // kaart die je deelt hoort er hetzelfde uit te zien als het scherm waar hij
  // vandaan komt. Valt de art weg, dan blijft het oude verloop over.
  const grad = ctx.createRadialGradient(W / 2, -H * 0.08, 100, W / 2, H * 0.5, H);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(0.42, colors.bg1);
  grad.addColorStop(1, colors.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const arena = await loadImage("/ui/lobby-bg.webp");
  if (arena) {
    const sc = Math.max(W / arena.width, H / arena.height);
    ctx.drawImage(arena, (W - arena.width * sc) / 2, (H - arena.height * sc) / 2, arena.width * sc, arena.height * sc);
    const vig = ctx.createRadialGradient(W / 2, H * 0.3, H * 0.08, W / 2, H * 0.5, H * 0.8);
    vig.addColorStop(0, "rgba(6,4,14,.1)");
    vig.addColorStop(1, "rgba(4,2,10,.82)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = "center";

  const logo = await loadImage("/logo.png");
  if (logo) {
    const S = 190;
    ctx.drawImage(logo, W / 2 - S / 2, 190 - S / 2, S, S);
  } else {
    drawEmblem(ctx, W / 2, 190, 80);
  }

  ctx.font = "700 78px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  ctx.shadowColor = colors.violet;
  ctx.shadowBlur = 36;
  ctx.fillText("PEN NEER", W / 2, 350);
  ctx.shadowBlur = 0;

  // De winnaar in een eigen neonlijst: dat is waar de kaart om gaat, dus die
  // krijgt een lijst en de rest niet.
  const kx = 110;
  const kw = W - 220;
  const ky = 410;
  const kh = 230;
  ctx.save();
  schuinPad(ctx, kx, ky, kw, kh, 22);
  ctx.fillStyle = "rgba(10,4,26,.4)";
  ctx.fill();
  ctx.restore();
  kaderLijn(ctx, kx, ky, kw, kh, 22, 2.4);

  ctx.font = "600 30px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.winnerLabel.toUpperCase(), W / 2, ky + 62);

  ctx.font = "700 72px 'Space Grotesk'";
  ctx.fillStyle = colors.gold;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 28;
  ctx.fillText(opts.winnerNames, W / 2, ky + 142);
  ctx.shadowBlur = 0;

  ctx.font = "700 36px 'Space Grotesk'";
  const pillText = opts.pointsText;
  const pillW = ctx.measureText(pillText).width + 70;
  ctx.fillStyle = "rgba(255,207,74,.14)";
  roundRect(ctx, W / 2 - pillW / 2, ky + 166, pillW, 54, 27);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,207,74,.5)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, W / 2 - pillW / 2, ky + 166, pillW, 54, 27);
  ctx.stroke();
  ctx.fillStyle = colors.gold;
  ctx.fillText(pillText, W / 2, ky + 203);

  // De stand als glasrijen, met de gouden kappen voor wie bovenaan staat en het
  // lichtpunt op een andere plek per rij, precies als in de app.
  const rows = opts.rows.slice(0, 8);
  const left = 110;
  const right = W - 110;
  const rowH = 92;
  let y = ky + kh + 60;
  rows.forEach((r, i) => {
    const leider = i === 0;
    glasRij(ctx, left, y, right - left, rowH - 14, leider ? "goud" : "paars", 0.3 + ((i * 0.618034) % 1) * 0.4);

    ctx.textAlign = "left";
    ctx.font = "700 34px 'Space Grotesk'";
    ctx.fillStyle = leider ? colors.gold : colors.faint;
    ctx.fillText(String(i + 1), left + 34, y + 50);

    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(left + 106, y + 39, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "600 34px Inter";
    ctx.fillStyle = colors.ink;
    const name = r.name.length > 16 ? r.name.slice(0, 15) + "\u2026" : r.name;
    ctx.fillText(name, left + 146, y + 50);

    ctx.textAlign = "right";
    ctx.font = "700 40px 'Space Grotesk'";
    ctx.fillStyle = leider ? colors.gold : colors.ink;
    ctx.fillText(String(r.score), right - 34, y + 52);
    y += rowH;
  });

  ctx.textAlign = "center";
  ctx.font = "500 26px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.footer, W / 2, H - 50);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

interface ProfileCardOpts {
  name: string;
  color: string;
  avatarUrl: string | null; // same-origin photo, or null for the initial tile
  ringColor: string | null; // rank ring color (null for beginneling)
  rankTitle: string; // localized rank name
  levelText: string; // "Level 7"
  level: number; // het cijfer op het schild
  shield: string; // kleur van het schild, afgeleid van de divisie
  divisieNaam: string; // "Smaragd" — de naam van de divisie
  divisieAccent: string; // "84,206,124" — de kleur van die divisie
  xpNow: number; // XP binnen dit level
  xpSpan: number; // XP dat dit level in totaal kost
  xpLabel: string; // "90 / 200 XP"
  stats: [string, string][]; // four [label, value] blocks
  badgesLine: string; // "7 prestaties"
  footer: string;
}

/** De lijn van een neon-kader op canvas: goud linksboven, via violet naar roze
 *  rechtsonder, met de uiteinden vol en het midden gedoofd. Dezelfde opbouw als
 *  de skill neon-kader, alleen kan canvas geen masker over een ring leggen, dus
 *  de fade zit in de DEKKING van het verloop zelf. */
function kaderLijn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, dik = 2) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(255,207,74,.95)");
  g.addColorStop(0.12, "rgba(255,179,71,.7)");
  g.addColorStop(0.34, "rgba(200,139,255,.28)");
  g.addColorStop(0.5, "rgba(154,75,240,.2)");
  g.addColorStop(0.68, "rgba(255,111,188,.3)");
  g.addColorStop(0.9, "rgba(224,64,154,.75)");
  g.addColorStop(1, "rgba(224,64,154,.95)");
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = dik;
  // De gloed is dezelfde lijn, en dat is het punt: dan gloeit precies wat er
  // staat. Een losse gekleurde schaduw zou iets anders laten schijnen.
  ctx.shadowColor = "rgba(154,75,240,.55)";
  ctx.shadowBlur = 22;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Render a shareable PROFILE card. Zelfde taal als de vitrine op het profiel:
// het decor van dat scherm, het portret in de gouden ring met zijn schild, en
// panelen met de neon-lijst eromheen.
export async function makeProfileCard(opts: ProfileCardOpts): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await Promise.all([
      document.fonts.load("700 120px 'Space Grotesk'"),
      document.fonts.load("600 36px Inter"),
    ]);
  } catch {
    /* fall back to default fonts */
  }

  // Het DECOR van het profiel zelf. Valt het weg, dan blijft het oude verloop
  // over, zodat de kaart nooit leeg is.
  const grad = ctx.createRadialGradient(W / 2, -H * 0.08, 100, W / 2, H * 0.5, H);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(0.42, colors.bg1);
  grad.addColorStop(1, colors.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const decor = await loadImage("/ui/profile-bg.webp");
  if (decor) {
    // `cover`: de art is staand, de kaart ook, maar niet in dezelfde maat.
    const s = Math.max(W / decor.width, H / decor.height);
    const dw = decor.width * s;
    const dh = decor.height * s;
    ctx.drawImage(decor, (W - dw) / 2, (H - dh) / 2, dw, dh);
    // Een vignet eroverheen, anders wint het decor het van de tekst.
    const vig = ctx.createRadialGradient(W / 2, H * 0.32, H * 0.1, W / 2, H * 0.5, H * 0.78);
    vig.addColorStop(0, "rgba(6,4,14,.12)");
    vig.addColorStop(1, "rgba(4,2,10,.86)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = "center";

  // brand
  const logo = await loadImage("/logo.png");
  if (logo) {
    const S = 150;
    ctx.drawImage(logo, W / 2 - S / 2, 128 - S / 2, S, S);
  } else {
    drawEmblem(ctx, W / 2, 128, 56);
  }
  ctx.font = "700 58px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  ctx.shadowColor = colors.violet;
  ctx.shadowBlur = 30;
  ctx.fillText("PEN NEER", W / 2, 262);
  ctx.shadowBlur = 0;

  // Het portret in de GOUDEN RING uit de UI-map, met het levelschild eronder.
  // Alle maten komen uit de art zelf: het gat is 68,8% van de breedte en het
  // hart daarvan ligt op 49,9% / 44,1%, want de lauwertak onderaan hoort bij de
  // ring en niet bij het gat.
  const ring = await loadImage("/ui/ring.webp");
  const R = 330;
  const rx = W / 2 - R / 2;
  const ry = 320;
  const gat = R * 0.688;
  const gx = rx + R * 0.499;
  const gy = ry + R * (708 / 720) * 0.441;
  ctx.save();
  ctx.beginPath();
  ctx.arc(gx, gy, gat / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#140B26";
  ctx.fillRect(gx - gat / 2, gy - gat / 2, gat, gat);
  const photo = opts.avatarUrl ? await loadImage(opts.avatarUrl) : null;
  if (photo) {
    ctx.drawImage(photo, gx - gat / 2, gy - gat / 2, gat, gat);
  } else {
    ctx.font = "700 150px 'Space Grotesk'";
    ctx.fillStyle = opts.color;
    ctx.fillText((opts.name.trim()[0] || "?").toUpperCase(), gx, gy + 54);
  }
  ctx.restore();
  if (ring) {
    ctx.drawImage(ring, rx, ry, R, R * (708 / 720));
  } else {
    // Zonder de art alsnog een ring, zodat het portret niet los zweeft.
    ctx.strokeStyle = opts.ringColor ?? colors.gold;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(gx, gy, gat / 2 + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  const schild = await loadImage(`/ui/shield/${opts.shield}.webp`);
  if (schild) {
    const sb = R * 0.24;
    const sh = sb * (972 / 821);
    const sx = W / 2 - sb / 2;
    const sy = ry + R * (708 / 720) * 0.441 + gat / 2 - sh * 0.22;
    ctx.drawImage(schild, sx, sy, sb, sh);
    ctx.font = "700 44px 'Space Grotesk'";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(String(opts.level), W / 2, sy + sh * 0.52);
  }

  // naam + rang
  ctx.font = "700 70px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  const name = opts.name.length > 14 ? opts.name.slice(0, 13) + "…" : opts.name;
  ctx.fillText(name, W / 2, 720);

  ctx.font = "700 48px 'Space Grotesk'";
  ctx.fillStyle = colors.gold;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 24;
  ctx.fillText(opts.rankTitle.toUpperCase(), W / 2, 786);
  ctx.shadowBlur = 0;

  // De DIVISIE eronder, in zijn eigen kleur. De rang zegt hoe ver je bent, de
  // divisie hoe je er deze maand voor staat: twee verschillende dingen, dus
  // twee regels. In de kleur van het schild, zodat het bij elkaar hoort.
  ctx.font = "600 32px Inter";
  ctx.fillStyle = `rgb(${opts.divisieAccent})`;
  ctx.fillText(opts.divisieNaam.toUpperCase(), W / 2, 828);

  // De XP-balk: een GROEF met een neon-lijst eromheen, zoals op het profiel.
  const bw = W - 260;
  const bx = 130;
  const by = 858;
  const bh = 26;
  ctx.fillStyle = "rgba(0,0,0,.5)";
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  const deel = Math.max(0, Math.min(1, opts.xpSpan > 0 ? opts.xpNow / opts.xpSpan : 0));
  if (deel > 0) {
    // Het verloop loopt over het GEVULDE stuk en niet over de hele balk. Anders
    // zie je bij een halfvolle balk alleen de eerste helft van de reeks, en dan
    // lijkt de kleur af te hangen van hoe ver je bent in plaats van van het
    // verloop zelf.
    const vulB = Math.max(bh, bw * deel);
    const vul = ctx.createLinearGradient(bx, by, bx + vulB, by);
    vul.addColorStop(0, "#FF3B5C");
    vul.addColorStop(0.34, "#FF5FA8");
    vul.addColorStop(0.62, "#C86BFF");
    vul.addColorStop(1, "#FFC13A");
    ctx.fillStyle = vul;
    roundRect(ctx, bx, by, vulB, bh, bh / 2);
    ctx.fill();
  }
  kaderLijn(ctx, bx, by, bw, bh, bh / 2, 1.5);
  ctx.font = "700 30px 'Space Grotesk'";
  ctx.fillStyle = colors.sub;
  ctx.fillText(opts.xpLabel, W / 2, by + bh + 40);

  // 2x2 statistiekvakken met de neon-lijst eromheen
  const vw = (W - 260 - 24) / 2;
  const vh = 132;
  opts.stats.slice(0, 4).forEach(([label, value], i) => {
    const vx = 130 + (i % 2) * (vw + 24);
    const vy = 964 + Math.floor(i / 2) * (vh + 24);
    ctx.fillStyle = "rgba(20,10,40,.42)";
    roundRect(ctx, vx, vy, vw, vh, 22);
    ctx.fill();
    kaderLijn(ctx, vx, vy, vw, vh, 22, 2);
    ctx.font = "700 54px 'Space Grotesk'";
    ctx.fillStyle = colors.gold;
    ctx.fillText(value, vx + vw / 2, vy + 68);
    ctx.font = "600 26px Inter";
    ctx.fillStyle = colors.faint;
    ctx.fillText(label.toUpperCase(), vx + vw / 2, vy + 108);
  });

  // badges line + footer
  ctx.font = "600 30px Inter";
  ctx.fillStyle = colors.sub;
  ctx.fillText(opts.badgesLine, W / 2, 1288);
  ctx.font = "500 26px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.footer, W / 2, H - 40);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

interface DailyCardOpts {
  dayLabel: string; // "DAGRONDE · 13 JULI"
  letter: string;
  scoreText: string; // "40 punten"
  rankText: string; // "#3 van 41 vandaag" (empty when unranked)
  streakText: string; // "2 dagen op rij" (empty when none)
  footer: string;
}

// Render a shareable DAGRONDE card: the day's letter huge, your score, rank.
export async function makeDailyCard(opts: DailyCardOpts): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await Promise.all([
      document.fonts.load("700 120px 'Space Grotesk'"),
      document.fonts.load("600 36px Inter"),
    ]);
  } catch {
    /* fall back to default fonts */
  }

  const grad = ctx.createRadialGradient(W / 2, -H * 0.08, 100, W / 2, H * 0.5, H);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(0.42, colors.bg1);
  grad.addColorStop(1, colors.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Dezelfde arena als op de dagronde zelf.
  const arena = await loadImage("/ui/lobby-bg.webp");
  if (arena) {
    const sc = Math.max(W / arena.width, H / arena.height);
    ctx.drawImage(arena, (W - arena.width * sc) / 2, (H - arena.height * sc) / 2, arena.width * sc, arena.height * sc);
    const vig = ctx.createRadialGradient(W / 2, H * 0.3, H * 0.08, W / 2, H * 0.5, H * 0.8);
    vig.addColorStop(0, "rgba(6,4,14,.1)");
    vig.addColorStop(1, "rgba(4,2,10,.82)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = "center";

  const logo = await loadImage("/logo.png");
  if (logo) {
    const S = 170;
    ctx.drawImage(logo, W / 2 - S / 2, 140 - S / 2, S, S);
  } else {
    drawEmblem(ctx, W / 2, 140, 62);
  }
  ctx.font = "700 64px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  ctx.shadowColor = colors.violet;
  ctx.shadowBlur = 30;
  ctx.fillText("PEN NEER", W / 2, 290);
  ctx.shadowBlur = 0;

  ctx.font = "600 34px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.dayLabel.toUpperCase(), W / 2, 360);

  // De letter van de dag, groot, in dezelfde neonlijst als elke sectie in de
  // app. Vroeger stond hier een gouden randje met een gloed eromheen; dat was
  // de enige plek in het spel die zo'n rand nog had.
  const T = 330;
  const tx = W / 2 - T / 2;
  const ty = 414;
  ctx.fillStyle = "rgba(10,4,26,.5)";
  roundRect(ctx, tx, ty, T, T, 52);
  ctx.fill();
  kaderLijn(ctx, tx, ty, T, T, 52, 2.6);
  ctx.font = "700 224px 'Space Grotesk'";
  ctx.fillStyle = colors.gold;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 40;
  ctx.fillText(opts.letter.toUpperCase(), W / 2, ty + T / 2 + 80);
  ctx.shadowBlur = 0;

  // Score, plek en reeks als glasrijen, precies zoals de ranglijst eronder op
  // de dagronde zelf. Drie losse regels tekst zouden hier zweven; als rij
  // hebben ze een vorm en horen ze bij elkaar.
  const rijX = 150;
  const rijW = W - 300;
  const rijH = 96;
  let y = ty + T + 60;
  const regels: [string, string, "goud" | "paars"][] = [[opts.scoreText, "", "goud"]];
  if (opts.rankText) regels.push([opts.rankText, "", "paars"]);
  if (opts.streakText) regels.push([opts.streakText, "", "paars"]);
  regels.forEach(([tekst, , accent], i) => {
    glasRij(ctx, rijX, y, rijW, rijH, accent, 0.3 + ((i * 0.618034) % 1) * 0.4);
    ctx.font = i === 0 ? "700 46px 'Space Grotesk'" : "600 34px Inter";
    ctx.fillStyle = i === 0 ? colors.gold : i === 2 ? colors.orange : colors.ink;
    ctx.fillText(tekst, W / 2, y + rijH / 2 + (i === 0 ? 16 : 12));
    y += rijH + 16;
  });

  ctx.font = "500 26px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.footer, W / 2, H - 50);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface ClubCardOpts {
  name: string;           // clubnaam
  emblemSrc: string;      // pad naar het embleem
  code: string;           // deelcode
  membersText: string;    // "7 leden"
  periodText: string;     // "Deze maand" / "Aller tijden"
  rows: { name: string; points: number; games: number; avatarUrl: string | null; color: string }[];
  joinText: string;       // "Doe mee met deze code"
  footer: string;
}

/** De deelkaart van een club: het embleem, de naam, de code en de stand.
 *
 *  Dezelfde taal als de uitslagkaart, want het IS een uitslag: een lijst met
 *  namen en punten. Alleen is het decor hier het profieldecor en niet de arena,
 *  omdat een club bij je profiel hoort en niet bij een potje.
 *
 *  De CODE is het punt van de hele kaart. Iemand deelt dit om anderen erbij te
 *  krijgen, dus de code staat groot en apart, met de uitnodiging eronder. */
export async function makeClubCard(opts: ClubCardOpts): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await Promise.all([
      document.fonts.load("700 120px 'Space Grotesk'"),
      document.fonts.load("600 36px Inter"),
    ]);
  } catch {
    /* fall back to default fonts */
  }

  const grad = ctx.createRadialGradient(W / 2, -H * 0.08, 100, W / 2, H * 0.5, H);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(0.42, colors.bg1);
  grad.addColorStop(1, colors.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const decor = await loadImage("/ui/profile-bg.webp");
  if (decor) {
    const sc = Math.max(W / decor.width, H / decor.height);
    ctx.drawImage(decor, (W - decor.width * sc) / 2, (H - decor.height * sc) / 2, decor.width * sc, decor.height * sc);
    const vig = ctx.createRadialGradient(W / 2, H * 0.3, H * 0.1, W / 2, H * 0.5, H * 0.78);
    vig.addColorStop(0, "rgba(6,4,14,.12)");
    vig.addColorStop(1, "rgba(4,2,10,.86)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = "center";

  // merk
  const logo = await loadImage("/logo.png");
  if (logo) {
    const S = 150;
    ctx.drawImage(logo, W / 2 - S / 2, 120 - S / 2, S, S);
  } else {
    drawEmblem(ctx, W / 2, 120, 56);
  }
  ctx.font = "700 50px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  ctx.shadowColor = colors.violet;
  ctx.shadowBlur = 26;
  ctx.fillText("PEN NEER", W / 2, 232);
  ctx.shadowBlur = 0;

  // Alles onder het merk zakt naar het midden als de stand kort is. Een club
  // van twee zou anders de bovenste helft vullen en de rest leeg laten, en dan
  // ziet de kaart eruit alsof er iets niet geladen is.
  const rijH = 92;
  const rijGap = 14;
  const top = opts.rows.slice(0, 5);
  // Niet de helft maar iets minder: boven het embleem staat al de merkregel
  // met zijn eigen lucht, dus een eerlijke halvering laat het gat bovenin
  // groter lijken dan dat onderin.
  const dy = Math.max(0, (5 - top.length) * (rijH + rijGap) * 0.4);

  // het embleem van de club, met licht erachter zodat het goud niet wegvalt
  const em = await loadImage(opts.emblemSrc);
  const E = 240;
  const ey = 280 + dy;
  if (em) {
    const halo = ctx.createRadialGradient(W / 2, ey + E / 2, 20, W / 2, ey + E / 2, E * 0.72);
    halo.addColorStop(0, "rgba(255,205,90,.34)");
    halo.addColorStop(1, "rgba(255,205,90,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(W / 2 - E, ey - E * 0.3, E * 2, E * 1.6);
    ctx.drawImage(em, W / 2 - E / 2, ey, E, E);
  }

  // naam + aantal leden
  ctx.font = "700 62px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  const naam = opts.name.length > 16 ? opts.name.slice(0, 15) + "\u2026" : opts.name;
  ctx.fillText(naam, W / 2, ey + E + 74);
  ctx.font = "600 30px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.membersText.toUpperCase(), W / 2, ey + E + 118);

  // de deelcode, in een neonlijst: dit is waar de kaart om draait
  const cw = 420;
  const ch = 104;
  const cx = W / 2 - cw / 2;
  const cy = ey + E + 152;
  ctx.fillStyle = "rgba(10,4,26,.5)";
  roundRect(ctx, cx, cy, cw, ch, 26);
  ctx.fill();
  kaderLijn(ctx, cx, cy, cw, ch, 26, 2.4);
  ctx.font = "700 62px 'Space Grotesk'";
  ctx.fillStyle = colors.gold;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 30;
  // Letterafstand met de hand, want `letterSpacing` op canvas kent Safari niet:
  // de code is zes tekens, dus dat is te overzien.
  const sp = 14;
  const letters = opts.code.toUpperCase().split("");
  const breed = letters.reduce((a, l) => a + ctx.measureText(l).width, 0) + sp * (letters.length - 1);
  let lx = W / 2 - breed / 2;
  ctx.textAlign = "left";
  for (const l of letters) {
    ctx.fillText(l, lx, cy + ch / 2 + 22);
    lx += ctx.measureText(l).width + sp;
  }
  ctx.textAlign = "center";
  ctx.shadowBlur = 0;

  ctx.font = "600 28px Inter";
  ctx.fillStyle = colors.sub;
  ctx.fillText(opts.joinText, W / 2, cy + ch + 46);

  // de stand, als glasrijen
  ctx.font = "600 26px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.periodText.toUpperCase(), W / 2, cy + ch + 104);

  const rijX = 100;
  const rijW = W - 200;
  let ry = cy + ch + 134;
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    // De piek van de lichtstreep verspringt per rij volgens de gulden snede;
    // op vijftig procent staat overal hetzelfde puntje en leest het als raster.
    glasRij(ctx, rijX, ry, rijW, rijH, i === 0 ? "goud" : "paars", 0.3 + ((i * 0.618034) % 1) * 0.4);

    ctx.textAlign = "center";
    ctx.font = "700 34px 'Space Grotesk'";
    ctx.fillStyle = i === 0 ? colors.gold : colors.faint;
    ctx.fillText(String(i + 1), rijX + 42, ry + rijH / 2 + 12);

    // portret
    const av = r.avatarUrl ? await loadImage(r.avatarUrl) : null;
    const D = 56;
    const ax = rijX + 76;
    const ay = ry + rijH / 2 - D / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + D / 2, ay + D / 2, D / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = av ? "#140B26" : r.color;
    ctx.fillRect(ax, ay, D, D);
    if (av) {
      ctx.drawImage(av, ax, ay, D, D);
    } else {
      ctx.fillStyle = "#1A0B33";
      ctx.font = "700 30px 'Space Grotesk'";
      ctx.fillText((r.name.trim()[0] || "?").toUpperCase(), ax + D / 2, ay + D / 2 + 11);
    }
    ctx.restore();

    ctx.textAlign = "left";
    ctx.font = "600 32px Inter";
    ctx.fillStyle = colors.ink;
    const kort = r.name.length > 13 ? r.name.slice(0, 12) + "\u2026" : r.name;
    ctx.fillText(kort, ax + D + 18, ry + rijH / 2 + 11);

    ctx.textAlign = "right";
    ctx.font = "700 38px 'Space Grotesk'";
    ctx.fillStyle = i === 0 ? colors.gold : colors.ink;
    ctx.fillText(String(r.points), rijX + rijW - 30, ry + rijH / 2 + 13);

    ry += rijH + rijGap;
  }

  ctx.textAlign = "center";
  ctx.font = "500 26px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.footer, W / 2, H - 46);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Pen Neer" });
      return true;
    } catch {
      // user cancelled or share failed; fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
