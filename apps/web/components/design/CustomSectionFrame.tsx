"use client";

import { useEffect, useRef, useState } from "react";

export interface CustomSection {
  description: string;
  html: string;
  css: string;
  scope: string;
}

/**
 * A custom section (HTML + CSS written by the model) shown in an isolated frame: its CSS can't leak into the page, and the
 * sandbox runs no scripts. The frame grows to fit its content.
 */
export function CustomSectionFrame({ section, fonts = [] }: { section: Pick<CustomSection, "html" | "css">; fonts?: string[] }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  const families = fonts.filter(Boolean).map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700;800`).join("&");
  const doc = `<!doctype html><html><head><meta charset="utf-8">${families ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=swap">` : ""}
<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}img{max-width:100%}</style><style>${section.css}</style></head><body>${section.html}</body></html>`;

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const measure = () => {
      const body = frame.contentDocument?.body;
      if (body) setHeight(Math.max(80, body.scrollHeight));
    };
    const onLoad = () => {
      measure();
      const body = frame.contentDocument?.body;
      if (body) {
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
    };
    frame.addEventListener("load", onLoad);
    return () => {
      frame.removeEventListener("load", onLoad);
      observer?.disconnect();
    };
  }, [doc]);

  return <iframe ref={ref} title="Custom section" sandbox="allow-same-origin" srcDoc={doc} className="block w-full border-0" style={{ height }} />;
}
