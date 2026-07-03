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
