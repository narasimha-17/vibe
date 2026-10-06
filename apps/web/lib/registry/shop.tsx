import ShopWidget from "@/components/shop/ShopWidget";
import TrackingWidget from "@/components/shop/TrackingWidget";
import type { Product } from "@/components/shop/ShopWidget";
import type { ComponentDef } from "./types";

const toProducts = (p: Record<string, any>): Product[] =>
  ((p.products || []) as Record<string, any>[]).map((x, i) => ({
    id: i + 1,
    name: String(x.name || `Product ${i + 1}`),
    price: Number(String(x.price ?? "0").replace(/[^\d.]/g, "")) || 0,
    description: String(x.description || ""),
    image: String(x.image || ""),
    category: String(x.category || ""),
    stock: x.stock === "" || x.stock == null ? 50 : Number(x.stock),
    rating: 4 + ((i * 3) % 10) / 10,
    reviews_count: 3 + i * 2,
  }));

/** Storefront: browse, filter, product detail with reviews, cart and Razorpay checkout. Exported code talks to the generated backend. */
export const shop: ComponentDef = {
  type: "shop",
  label: "Shop",
  category: "E-commerce",
  icon: "🛍",
  variants: [
    { id: "sidebar", label: "Filters on the side", render: (p) => <ShopWidget heading={p.heading} products={toProducts(p)} layout="sidebar" hideCart={!!p.hideCart} /> },
    { id: "top", label: "Filters on top", render: (p) => <ShopWidget heading={p.heading} products={toProducts(p)} layout="top" hideCart={!!p.hideCart} /> },
  ],
  defaultProps: {
    heading: "Shop",
    products: [
      { name: "Everyday Tote", price: "1999", category: "Bags", stock: 20, description: "A durable carryall made for daily movement.", image: "" },
      { name: "Studio Mug", price: "899", category: "Home", stock: 15, description: "Hand-finished ceramic with a soft matte glaze.", image: "" },
      { name: "Field Notes", price: "499", category: "Stationery", stock: 40, description: "A pocket notebook for ideas worth keeping.", image: "" },
      { name: "Linen Throw", price: "2499", category: "Home", stock: 8, description: "Stonewashed linen, soft from day one.", image: "" },
      { name: "Canvas Backpack", price: "3299", category: "Bags", stock: 12, description: "Roomy, water-resistant and built to last.", image: "" },
      { name: "Desk Planner", price: "699", category: "Stationery", stock: 30, description: "Weekly layout with room to breathe.", image: "" },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "products",
      label: "Products",
      type: "array",
      path: "products",
      itemLabel: "Product",
      itemFields: [
        { key: "name", label: "Name", type: "text", path: "name" },
        { key: "price", label: "Price in ₹ (numbers only)", type: "text", path: "price" },
        { key: "category", label: "Category (used by the filter)", type: "text", path: "category" },
        { key: "stock", label: "Stock", type: "text", path: "stock" },
        { key: "description", label: "Description", type: "textarea", path: "description" },
        { key: "image", label: "Image", type: "image", path: "image" },
      ],
    },
  ],
};

/** Order tracking: number + email lookup with a status timeline. */
export const tracking: ComponentDef = {
  type: "tracking",
  label: "Order Tracking",
  category: "E-commerce",
  icon: "📦",
  variants: [{ id: "default", label: "Lookup with timeline", render: (p) => <TrackingWidget heading={p.heading} /> }],
  defaultProps: { heading: "Track your order" },
  editableFields: [{ key: "heading", label: "Heading", type: "text", path: "heading" }],
};
