"use client";

import { useEffect, useRef, useState } from "react";
import { TOAST_EVENT } from "@/lib/toast";

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setMessage(detail);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), 3000);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-7 right-7 z-[200] flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-2xl">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[11px] text-white">
        ✓
      </span>
      {message}
    </div>
  );
}
