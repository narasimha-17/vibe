export const TOAST_EVENT = "vibe:toast";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}
