import { Mail, Phone } from "lucide-react";
import { siDiscord, siFacebook, siGithub, siInstagram, siMessenger, siPinterest, siTelegram, siTiktok, siWhatsapp, siX, siYoutube } from "simple-icons";
import type { ComponentDef } from "./types";

interface Platform {
  id: string;
  label: string;
  hex: string;
  action: string;
  path?: string;
  href: (v: string) => string;
}

const url = (v: string, make: (x: string) => string) => (/^https?:\/\//i.test(v) ? v : make(v.replace(/^@/, "").trim()));

/** Integrations offered by the Social & Contact component. */
export const PLATFORMS: Platform[] = [
  { id: "whatsapp", label: "WhatsApp", hex: `#${siWhatsapp.hex}`, action: "Chat on WhatsApp", path: siWhatsapp.path, href: (v) => url(v, (x) => `https://wa.me/${x.replace(/\D/g, "")}`) },
  { id: "instagram", label: "Instagram", hex: "#E1306C", action: "Follow on Instagram", path: siInstagram.path, href: (v) => url(v, (x) => `https://instagram.com/${x}`) },
  { id: "facebook", label: "Facebook", hex: `#${siFacebook.hex}`, action: "Like on Facebook", path: siFacebook.path, href: (v) => url(v, (x) => `https://facebook.com/${x}`) },
  { id: "messenger", label: "Messenger", hex: `#${siMessenger.hex}`, action: "Message us", path: siMessenger.path, href: (v) => url(v, (x) => `https://m.me/${x}`) },
  { id: "x", label: "X", hex: "#111111", action: "Follow on X", path: siX.path, href: (v) => url(v, (x) => `https://x.com/${x}`) },
  { id: "youtube", label: "YouTube", hex: `#${siYoutube.hex}`, action: "Subscribe on YouTube", path: siYoutube.path, href: (v) => url(v, (x) => `https://youtube.com/@${x}`) },
  { id: "telegram", label: "Telegram", hex: `#${siTelegram.hex}`, action: "Message on Telegram", path: siTelegram.path, href: (v) => url(v, (x) => `https://t.me/${x}`) },
  { id: "linkedin", label: "LinkedIn", hex: "#0A66C2", action: "Connect on LinkedIn", href: (v) => url(v, (x) => `https://linkedin.com/in/${x}`) },
  { id: "tiktok", label: "TikTok", hex: "#111111", action: "Follow on TikTok", path: siTiktok.path, href: (v) => url(v, (x) => `https://tiktok.com/@${x}`) },
  { id: "pinterest", label: "Pinterest", hex: `#${siPinterest.hex}`, action: "Follow on Pinterest", path: siPinterest.path, href: (v) => url(v, (x) => `https://pinterest.com/${x}`) },
  { id: "discord", label: "Discord", hex: `#${siDiscord.hex}`, action: "Join our Discord", path: siDiscord.path, href: (v) => url(v, (x) => `https://discord.gg/${x}`) },
  { id: "github", label: "GitHub", hex: "#181717", action: "View on GitHub", path: siGithub.path, href: (v) => url(v, (x) => `https://github.com/${x}`) },
  { id: "email", label: "Email", hex: "#EA4335", action: "Send an email", href: (v) => (v.startsWith("mailto:") ? v : `mailto:${v}`) },
  { id: "phone", label: "Call", hex: "#16A34A", action: "Call us", href: (v) => (v.startsWith("tel:") ? v : `tel:${v.replace(/[^\d+]/g, "")}`) },
];

const BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

function Icon({ id, size = 20 }: { id: string; size?: number }) {
  const p = BY_ID[id];
  if (p?.path) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
        <path d={p.path} />
      </svg>
    );
  }
  if (id === "email") return <Mail width={size} height={size} aria-hidden="true" />;
  if (id === "phone") return <Phone width={size} height={size} aria-hidden="true" />;
  return <span style={{ fontWeight: 900, fontSize: size * 0.8 }}>in</span>;
}

type Item = { platform: string; value: string; label?: string };
const items = (p: Record<string, any>) => ((p.items || []) as Item[]).filter((i) => BY_ID[i.platform]);
const link = (i: Item) => BY_ID[i.platform].href(i.value || "");
const text = (i: Item) => i.label || BY_ID[i.platform].action;
const A = { target: "_blank", rel: "noopener noreferrer" } as const;

export const socials: ComponentDef = {
  type: "socials",
  label: "Social & Contact",
  category: "Integrations",
  icon: "☎",
  variants: [
    {
      id: "buttons",
      label: "Brand buttons",
      render: (p) => (
        <section className="v-soc-sec">
          <h2>{p.heading}</h2>
          {p.subheading && <p className="v-soc-sub">{p.subheading}</p>}
          <div className="v-soc-buttons">
            {items(p).map((i, n) => (
              <a key={n} href={link(i)} {...A} className="v-soc-btn" style={{ background: BY_ID[i.platform].hex }}>
                <Icon id={i.platform} />
                {text(i)}
              </a>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "icons",
      label: "Round icons",
      render: (p) => (
        <section className="v-soc-sec v-soc-sec--center">
          <h2>{p.heading}</h2>
          <div className="v-soc-icons">
            {items(p).map((i, n) => (
              <a key={n} href={link(i)} {...A} className="v-soc-ico" style={{ ["--c" as string]: BY_ID[i.platform].hex }} aria-label={BY_ID[i.platform].label} title={BY_ID[i.platform].label}>
                <Icon id={i.platform} size={24} />
              </a>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "cards",
      label: "Contact cards",
      render: (p) => (
        <section className="v-soc-sec">
          <h2>{p.heading}</h2>
          {p.subheading && <p className="v-soc-sub">{p.subheading}</p>}
          <div className="v-soc-cards">
            {items(p).map((i, n) => (
              <a key={n} href={link(i)} {...A} className="v-soc-card">
                <span className="v-soc-card-ico" style={{ background: BY_ID[i.platform].hex }}><Icon id={i.platform} size={22} /></span>
                <div>
                  <b>{BY_ID[i.platform].label}</b>
                  <span>{i.value}</span>
                </div>
                <em>Open</em>
              </a>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "widget",
      label: "Chat widget",
      render: (p) => {
        const wa = items(p).find((i) => i.platform === "whatsapp") || items(p)[0];
        return (
          <section className="v-soc-sec v-soc-widget-wrap">
            <div className="v-soc-page"><i /><i /><i /></div>
            <div className="v-soc-widget">
              <div className="v-soc-widget-head">
                <span className="v-soc-widget-av">{(p.heading || "Chat")[0]}</span>
                <div><b>{p.heading}</b><span>Typically replies in minutes</span></div>
                <i className="v-live" />
              </div>
              <p>{p.subheading || "Hi there! How can we help you today?"}</p>
              {wa && (
                <a href={link(wa)} {...A} className="v-soc-btn" style={{ background: BY_ID[wa.platform].hex }}>
                  <Icon id={wa.platform} />
                  {text(wa)}
                </a>
              )}
            </div>
            {wa && (
              <a href={link(wa)} {...A} className="v-soc-fab" style={{ background: BY_ID[wa.platform].hex }} aria-label={BY_ID[wa.platform].label}>
                <Icon id={wa.platform} size={30} />
              </a>
            )}
          </section>
        );
      },
    },
    {
      id: "bar",
      label: "Dark contact bar",
      render: (p) => (
        <section className="v-soc-bar">
          <b>{p.heading}</b>
          <div>
            {items(p).map((i, n) => (
              <a key={n} href={link(i)} {...A} className="v-soc-bar-link">
                <Icon id={i.platform} size={18} />
                <span>{i.value || BY_ID[i.platform].label}</span>
              </a>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Talk to us anywhere",
    subheading: "Pick the channel you like best. We reply fast.",
    items: [
      { platform: "whatsapp", value: "+91 98765 43210", label: "" },
      { platform: "instagram", value: "yourbrand", label: "" },
      { platform: "email", value: "hello@yourbrand.com", label: "" },
      { platform: "phone", value: "+91 98765 43210", label: "" },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    { key: "subheading", label: "Subheading", type: "textarea", path: "subheading" },
    {
      key: "items",
      label: "Channels",
      type: "array",
      path: "items",
      itemLabel: "Channel",
      itemFields: [
        { key: "platform", label: "Platform", type: "select", path: "platform", options: PLATFORM_IDS },
        { key: "value", label: "Number, handle, email or link", type: "text", path: "value" },
        { key: "label", label: "Button text (optional)", type: "text", path: "label" },
      ],
    },
  ],
};
