import { siBitbucket, siDiscord, siFigma, siGithub, siGitlab, siGoogle, siNetlify, siVercel } from "simple-icons";

const ICONS = {
  github: siGithub,
  gitlab: siGitlab,
  bitbucket: siBitbucket,
  vercel: siVercel,
  netlify: siNetlify,
  figma: siFigma,
  discord: siDiscord,
  google: siGoogle,
} as const;

export type BrandKey = keyof typeof ICONS;

/** Official brand glyph on its brand-colored tile. */
export function BrandTile({ brand, size = 44 }: { brand: BrandKey; size?: number }) {
  const icon = ICONS[brand];
  return (
    <span
      role="img"
      aria-label={icon.title}
      style={{ background: `#${icon.hex}`, width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
    >
      <svg viewBox="0 0 24 24" fill="#fff" style={{ width: size * 0.54, height: size * 0.54 }} aria-hidden="true">
        <path d={icon.path} />
      </svg>
    </span>
  );
}

/** Brand glyph in its own color, no tile (for list rows). */
export function BrandGlyph({ brand, size = 18 }: { brand: BrandKey; size?: number }) {
  const icon = ICONS[brand];
  return (
    <svg viewBox="0 0 24 24" fill={`#${icon.hex}`} style={{ width: size, height: size }} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}
