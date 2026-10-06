type VibeLogoProps = {
  /** Icon-only mark (just the V). */
  compact?: boolean;
  /** White main color, for use on purple/dark backgrounds. */
  light?: boolean;
  className?: string;
};

const MAIN = "#6a3fb0";
const CYAN = "#22d3ee";
const PINK = "#ff4fa3";

function V({ fill }: { fill: string }) {
  return <path fillRule="evenodd" fill={fill} d="M0 10H84L42 82Z M19 25H65L42 63Z" />;
}

function IBE({ fill }: { fill: string }) {
  return (
    <>
      <rect x="100" y="10" width="16" height="72" fill={fill} />
      <path
        fillRule="evenodd"
        fill={fill}
        d="M128 10H168A18 18 0 0 1 168 46A20 20 0 0 1 166 82H128Z M144 24H162A5 5 0 0 1 162 36H144Z M144 52H164A6 6 0 0 1 164 68H144Z"
      />
      <rect x="196" y="10" width="64" height="16" fill={fill} />
      <rect x="196" y="38" width="64" height="16" fill={fill} />
      <rect x="196" y="66" width="64" height="16" fill={fill} />
      <rect x="196" y="10" width="16" height="72" fill={fill} />
    </>
  );
}

function Layer({ fill, dx, compact }: { fill: string; dx: number; compact: boolean }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      <V fill={fill} />
      {!compact && <IBE fill={fill} />}
    </g>
  );
}

export function VibeLogo({ compact = false, light = false, className = "" }: VibeLogoProps) {
  const main = light ? "#ffffff" : MAIN;
  return (
    <svg
      viewBox={compact ? "-4 4 96 84" : "-4 4 268 84"}
      role="img"
      aria-label="VIBE"
      className={`inline-block shrink-0 ${compact ? "h-7 w-auto" : "h-8 w-auto"} ${className}`}
    >
      <Layer fill={CYAN} dx={-2.5} compact={compact} />
      <Layer fill={PINK} dx={2.5} compact={compact} />
      <Layer fill={main} dx={0} compact={compact} />
    </svg>
  );
}
