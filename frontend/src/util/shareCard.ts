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

export async function makeShareCard(opts: CardOpts): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Ensure fonts are ready so canvas text uses them.
  try {
    await Promise.all([
      document.fonts.load("700 120px 'Space Grotesk'"),
      document.fonts.load("600 36px Inter"),
    ]);
  } catch {
    /* fall back to default fonts */
  }

  // background
  const grad = ctx.createRadialGradient(W / 2, -H * 0.08, 100, W / 2, H * 0.5, H);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(0.42, colors.bg1);
  grad.addColorStop(1, colors.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Brand logo (studio pen-nib coin, same-origin so the canvas stays untainted).
  // Falls back to the drawn emblem if the image can't load.
  const logo = await loadImage("/logo.png");
  if (logo) {
    const S = 250;
    ctx.drawImage(logo, W / 2 - S / 2, 210 - S / 2, S, S);
  } else {
    drawEmblem(ctx, W / 2, 210, 90);
  }

  // wordmark
  ctx.font = "700 96px 'Space Grotesk'";
  ctx.fillStyle = colors.ink;
  ctx.shadowColor = colors.violet;
  ctx.shadowBlur = 40;
  ctx.fillText("PEN NEER", W / 2, 410);
  ctx.shadowBlur = 0;

  // winner label
  ctx.font = "600 34px Inter";
  ctx.fillStyle = colors.faint;
  ctx.fillText(opts.winnerLabel.toUpperCase(), W / 2, 500);

  // winner name
  ctx.font = "700 76px 'Space Grotesk'";
  ctx.fillStyle = colors.gold;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 30;
  ctx.fillText(opts.winnerNames, W / 2, 580);
  ctx.shadowBlur = 0;

  // points pill
  ctx.font = "700 40px 'Space Grotesk'";
  const pillText = opts.pointsText;
  const pillW = ctx.measureText(pillText).width + 80;
  const pillX = W / 2 - pillW / 2;
  ctx.fillStyle = colors.gold;
  roundRect(ctx, pillX, 615, pillW, 70, 35);
  ctx.fill();
  ctx.fillStyle = "#2A1B05";
  ctx.fillText(pillText, W / 2, 663);

  // scoreboard
  const rows = opts.rows.slice(0, 8);
  let y = 760;
  const rowH = 84;
  const left = 120;
  const right = W - 120;
  ctx.textAlign = "left";
  rows.forEach((r, i) => {
    const leader = i === 0;
    ctx.fillStyle = leader ? "rgba(255,194,61,0.16)" : "rgba(255,255,255,0.05)";
    roundRect(ctx, left, y, right - left, rowH - 14, 18);
    ctx.fill();

    ctx.font = "700 36px 'Space Grotesk'";
    ctx.fillStyle = leader ? colors.gold : colors.faint;
    ctx.fillText(String(i + 1), left + 30, y + 48);

    // color token
    ctx.fillStyle = r.color;
    roundRect(ctx, left + 80, y + 16, 38, 38, 10);
    ctx.fill();

    ctx.font = "600 36px Inter";
    ctx.fillStyle = colors.ink;
    const name = r.name.length > 16 ? r.name.slice(0, 15) + "…" : r.name;
    ctx.fillText(name, left + 140, y + 48);

    ctx.textAlign = "right";
    ctx.font = "700 40px 'Space Grotesk'";
    ctx.fillStyle = leader ? colors.gold : colors.ink;
    ctx.fillText(String(r.score), right - 30, y + 50);
    ctx.textAlign = "left";

    y += rowH;
  });

  // footer
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
  shield: string; // kleur van het level-schild (paars, blauw, ...)
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

  // De XP-balk: een GROEF met een neon-lijst eromheen, zoals op het profiel.
  const bw = W - 260;
  const bx = 130;
  const by = 828;
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
    const vy = 940 + Math.floor(i / 2) * (vh + 24);
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
  ctx.fillText(opts.badgesLine, W / 2, 1268);
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

  // the day's letter, huge, in a glowing tile
  const T = 340;
  const tx = W / 2 - T / 2;
  const ty = 420;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  roundRect(ctx, tx, ty, T, T, 56);
  ctx.fill();
  ctx.strokeStyle = colors.gold;
  ctx.lineWidth = 8;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 44;
  roundRect(ctx, tx, ty, T, T, 56);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = "700 230px 'Space Grotesk'";
  ctx.fillStyle = colors.gold;
  ctx.shadowColor = colors.gold;
  ctx.shadowBlur = 40;
  ctx.fillText(opts.letter.toUpperCase(), W / 2, ty + T / 2 + 82);
  ctx.shadowBlur = 0;

  // score pill
  ctx.font = "700 46px 'Space Grotesk'";
  const pw = ctx.measureText(opts.scoreText).width + 90;
  ctx.fillStyle = colors.gold;
  roundRect(ctx, W / 2 - pw / 2, 830, pw, 84, 42);
  ctx.fill();
  ctx.fillStyle = "#2A1B05";
  ctx.fillText(opts.scoreText, W / 2, 887);

  // rank + streak
  let y = 990;
  if (opts.rankText) {
    ctx.font = "700 46px 'Space Grotesk'";
    ctx.fillStyle = colors.ink;
    ctx.fillText(opts.rankText, W / 2, y);
    y += 70;
  }
  if (opts.streakText) {
    ctx.font = "600 36px Inter";
    ctx.fillStyle = colors.orange;
    ctx.fillText(opts.streakText, W / 2, y);
  }

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
