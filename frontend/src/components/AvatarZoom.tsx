// De profielfoto uitvergroot. Tik op een avatar op een profiel en je ziet hem
// groot; tik ergens anders en hij gaat weer dicht.
//
// De maat komt uit het scherm zelf: `min(78vw, 340px)` is groot genoeg om een
// gezicht te zien en klein genoeg om op een smalle telefoon met marge te passen.
// De Avatar wil een getal, dus we meten het venster in plaats van CSS het te
// laten uitrekenen.
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { KADER_LIJN_GOUD, NeonKader } from "./ProfileHero";
import { colors, font } from "../theme/tokens";

export function AvatarZoom({
  name,
  color,
  userId,
  hasAvatar,
  avatarVer,
  frame,
  onClose,
}: {
  name: string;
  color: string;
  userId?: string;
  hasAvatar?: boolean;
  avatarVer?: number;
  frame?: string | null;
  onClose: () => void;
}) {
  const groot = () => Math.round(Math.min(window.innerWidth * 0.78, 340));
  const [size, setSize] = useState(groot);
  useEffect(() => {
    const meet = () => setSize(groot());
    window.addEventListener("resize", meet);
    return () => window.removeEventListener("resize", meet);
  }, []);
  return (
    <div
      onClick={onClose}
      className="reward-veil"
      style={{
        position: "fixed",
        inset: 0,
        // Boven de profielkaart, die op 80 zit.
        zIndex: 120,
        background: "rgba(4,2,14,.86)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        gap: 16,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span className="reward-art" style={{ display: "block", lineHeight: 0 }}>
          <Avatar name={name} color={color} size={size} userId={userId} hasAvatar={hasAvatar} avatarVer={avatarVer} frame={frame ?? undefined} glow />
        </span>
        {/* De naam op dezelfde ronde neonpil als de prestatieteller op je
            profiel. Losse tekst op een vlak veld leest als een bijschrift; op
            een pil hoort hij bij het portret. */}
        <NeonKader
          radius={999}
          dik={0.5}
          lijn={KADER_LIJN_GOUD}
          gloed="verloop"
          animeer
          vulling="geen"
          binnen={{ padding: "6px 18px", background: "rgba(10,4,26,.5)" }}
        >
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.ink }}>{name}</span>
        </NeonKader>
      </div>
    </div>
  );
}
