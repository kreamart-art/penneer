// The red arcade buzzer — now the studio art (public/buzzer.webp: glossy ball,
// lit gold ring, swoosh arrows, fire). The baked label was inpainted out so the
// text stays dynamic ("Draai"/"STOP", localized) as a gold overlay on the ball.
// Press-down feel is preserved: the whole art dips + brightens while held.
import { useState } from "react";
import { font } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Diameter of the red ball; the ring/fire art renders larger around it. */
  size?: number;
}

// Where the ball's center sits inside the art image (fractions of the image).
const ART_CX = 0.5;
const ART_CY = 0.43;

export function Buzzer({ label, onPress, disabled, size = 138 }: Props) {
  const [down, setDown] = useState(false);
  const hit = size * 1.55; // tap circle: ball + lit ring
  const art = size * 2.0; // full art width (arrows + fire bleed past the ring)

  return (
    <button
      onClick={() => !disabled && onPress()}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      disabled={disabled}
      style={{
        width: hit,
        height: hit,
        borderRadius: "50%",
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        position: "relative",
        transform: down ? "translateY(6px) scale(0.975)" : "none",
        transition: "transform .08s ease",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <img
        src="/buzzer.webp"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: art,
          height: "auto",
          transform: `translate(-${ART_CX * 100}%, -${ART_CY * 100}%)`,
          pointerEvents: "none",
          filter: down ? "brightness(1.12)" : "none",
          transition: "filter .08s ease",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: size * 0.19,
          letterSpacing: 1.5,
          color: "#FFD66E",
          textShadow: "0 2px 0 rgba(122,44,8,.9), 0 0 16px rgba(255,170,40,.5), 0 0 4px rgba(0,0,0,.4)",
          pointerEvents: "none",
        }}
      >
        {label}
      </span>
    </button>
  );
}
