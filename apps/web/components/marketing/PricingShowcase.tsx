import Link from "next/link";
import { getVariant, REGISTRY } from "@/lib/registry";

const PROPS = {
  heading: "Simple pricing that scales with you",
  tiers: [
    { name: "Free", price: "₹0", unit: "per month", features: ["3 projects", "All export targets", "Community support"], button: "Start free" },
    {
      name: "Pro",
      price: "₹199",
      unit: "per month",
      featured: true,
      features: ["Unlimited projects", "AI assistant", "GitHub push", "Version history"],
      button: "Choose Pro",
    },
    { name: "Team", price: "₹499", unit: "per month", badge: "Save 20%", features: ["Everything in Pro", "Shared projects", "Priority support"], button: "Choose Team" },
  ],
};

export function PricingShowcase() {
  const def = REGISTRY.pricing;
  return (
    <div className="mx-auto mt-14 max-w-6xl">
      <div className="overflow-x-auto rounded-2xl shadow-[0_30px_70px_rgba(59,45,90,0.25)]">
        <div className="site-preview min-w-[860px]">{getVariant("pricing", "tiered")?.render({ ...def.defaultProps, ...PROPS })}</div>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Prices in INR. Cancel anytime. Not sure yet?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Start on the free plan
        </Link>
        .
      </p>
    </div>
  );
}
