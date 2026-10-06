"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders `children` at a fixed design width (`baseWidth`) and scales it to
 * fit the available width. `ratio` is visible-height / width.
 */
export function FitScale({
  baseWidth,
  ratio,
  className = "",
  children,
}: {
  baseWidth: number;
  ratio: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / baseWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: `1 / ${ratio}` }}>
      <div
        className="absolute left-0 top-0"
        style={{ width: baseWidth, transform: `scale(${scale})`, transformOrigin: "top left", visibility: scale ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </div>
  );
}
