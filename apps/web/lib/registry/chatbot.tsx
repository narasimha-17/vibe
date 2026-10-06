import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import type { ComponentDef } from "./types";

export const FLOATING_CHAT = new Set(["widget", "whatsapp", "bubble"]);

const v = (id: "widget" | "inline" | "ai" | "whatsapp" | "support" | "bubble", label: string) => ({
  id,
  label,
  render: (p: Record<string, any>) =>
    FLOATING_CHAT.has(id) ? (
      <div className="cb-marker">
        <span aria-hidden="true">💬</span>
        <div>
          <b>{p.botName || "Chatbot"} · site-wide chat</b>
          <span>Appears as a floating button on every page (bottom-right). Edit it here.</span>
        </div>
      </div>
    ) : (
      <ChatbotWidget variant={id} p={p} />
    ),
});

/** Interactive chatbot. Answers come from the editable knowledge list (keyword match). */
export const chatbot: ComponentDef = {
  type: "chatbot",
  label: "Chatbot",
  category: "Chat",
  icon: "💬",
  variants: [
    v("widget", "Floating chat window"),
    v("inline", "Inline chat card"),
    v("ai", "AI assistant (dark)"),
    v("whatsapp", "Messenger style"),
    v("support", "Support center"),
    v("bubble", "Launcher bubble"),
  ],
  defaultProps: {
    botName: "Aria",
    brand: "Your Brand",
    greeting: "Hi! I'm Aria. Ask me about pricing, features or support.",
    placeholder: "Type your question…",
    fallback: "I'm not sure about that yet. Leave your email and a teammate will reply soon.",
    quickReplies: ["Pricing", "Features", "Contact support"],
    knowledge: [
      { q: "pricing price cost plans how much", a: "We have a free plan and paid plans from ₹199 per month. You can upgrade any time." },
      { q: "features what can do product", a: "You get a drag-and-drop builder, an AI assistant and clean code export to Next.js, React or HTML." },
      { q: "support contact help human email", a: "You can reach our team at hello@yourbrand.com. We usually reply within a few hours." },
      { q: "refund cancel money back", a: "Yes, there is a 30-day money-back guarantee, no questions asked." },
    ],
  },
  editableFields: [
    { key: "botName", label: "Bot name", type: "text", path: "botName" },
    { key: "brand", label: "Brand name", type: "text", path: "brand" },
    { key: "greeting", label: "Greeting message", type: "textarea", path: "greeting" },
    { key: "placeholder", label: "Input placeholder", type: "text", path: "placeholder" },
    {
      key: "quickReplies",
      label: "Quick reply buttons",
      type: "array",
      path: "quickReplies",
      itemLabel: "Button",
      itemFields: [{ key: "value", label: "Label", type: "text", path: "" }],
    },
    {
      key: "knowledge",
      label: "What the bot knows",
      type: "array",
      path: "knowledge",
      itemLabel: "Answer",
      itemFields: [
        { key: "q", label: "Question or keywords people use", type: "text", path: "q" },
        { key: "a", label: "Bot's answer", type: "textarea", path: "a" },
      ],
    },
    { key: "fallback", label: "When it does not know", type: "textarea", path: "fallback" },
  ],
};
