# UI DESIGN GUIDE

This guide is how every page of the site must be designed and built. Read all of it before writing a file.
The examples at the end describe excellent real-world designs in detail: study them, then design this site's
sections to the same standard. Never copy their sample text, brand names or prices into the site.

---------------------------------------------------------------------------------------------------------------

## 0. HOW TO USE THIS GUIDE

1. If the request contains a DESIGN REFERENCE, the reference is the design. Reproduce it faithfully (same
   structure, class names, colours, fonts, spacing and decoration). Use this guide only to fill gaps the
   reference leaves open: responsive behaviour, focus states, loading/empty/error states, accessibility,
   and the behaviour of interactive parts.
2. If there is no reference, design the page yourself using everything below. The result must look like it
   was made by a senior product designer for this specific business, not like a template.
3. Content always comes from the request. Use the given texts word for word. Never invent facts, prices,
   phone numbers, addresses, awards, customer counts or reviews.
4. When two rules seem to conflict, the order of priority is:
   correctness (it compiles and works) > accessibility > the design reference > this guide > your taste.

---------------------------------------------------------------------------------------------------------------

## 1. DESIGN PRINCIPLES

- **One clear focus per screen.** Every section answers one question for the visitor. If a section tries to
  do three things, split it or cut two.
- **Hierarchy through size, weight and space, not colour.** The most important thing is the biggest, the
  boldest or the most isolated. Use at most three text sizes inside one section.
- **Whitespace is a feature.** Crowded pages look cheap. Generous padding around sections and inside cards
  is the fastest way to look premium.
- **Restraint with colour.** Neutrals carry the page; the primary colour marks what to click; the accent
  colour appears rarely (badges, highlights, one decorative shape). Follow 60-30-10: 60% background and
  surfaces, 30% text and secondary surfaces, 10% brand colour.
- **Consistency beats novelty.** The same radius, the same shadow, the same button style, the same spacing
  steps everywhere. A site feels designed when its parts obviously belong together.
- **Show, don't tell.** A photo of the actual product, a real dish, the real clinic or a screenshot of the
  real app beats any illustration. When the site has no images, use tasteful shapes, gradients and
  typography instead of fake photos.
- **Every section earns its place.** It must help the visitor decide, trust or act. Decorative filler
  sections are not allowed.
- **Mobile is not an afterthought.** Most visitors are on a phone. Design every section for 360px first,
  then enhance for larger screens.

---------------------------------------------------------------------------------------------------------------

## 2. DESIGN TOKENS

All colours, fonts, radii, shadows and spacing come from CSS variables defined once in `globals.css`.
Components never hard-code a hex value. Map the site's theme onto these names (when a design reference is
given, its own variables live in `vibe-design.css`; keep using its classes and variables for its sections).

| Token | Example value | Used for |
|---|---|---|
| --primary | the theme's primary colour | buttons, links, focus rings, key highlights |
| --primary-hover | primary about 8% darker | hover state of primary buttons |
| --primary-contrast | white (or near-black on light primaries) | text on primary; must reach 4.5:1 |
| --secondary | the theme's secondary colour | gradients, secondary accents |
| --accent | the theme's accent colour | rare highlights: badges, one decorative shape |
| --bg | an off-white tinted towards the primary hue | page background |
| --surface | white | cards, navbar, inputs |
| --surface-2 | a very light tint of the primary | alternate section backgrounds |
| --text | a near-black tinted towards the primary | headings and body text |
| --muted | a mid grey-violet that still reaches 4.5:1 | secondary text, captions |
| --border | a light tint of the text colour | dividers, card and input borders |
| --success / --warning / --danger | green / amber / red at accessible darkness | status only |
| --font-heading / --font-body | the theme's heading and body fonts | all type |
| --radius-sm / --radius / --radius-lg / --radius-pill | 8px / 12px / 20px / fully round | inputs / buttons / cards / chips |
| --shadow-sm / --shadow / --shadow-lg | barely there / soft 8-24px / deep 24-60px, all low-opacity and tinted | resting cards / hover / floating elements |
| --container | 1200px | max content width |
| --gutter | 16px on phones up to 32px on desktop | side padding |
| --section-y | 64px on phones up to 120px on desktop | vertical section padding |
| --ease, --fast, --normal | a fast-out gentle-settle curve, 150ms, 250ms | all motion |

Dark mode (when the theme mode is dark): swap only the neutrals. `--bg: #0f0c1a; --surface: #17132a;
--surface-2: #1f1a36; --text: #f3f0fa; --muted: #b3abc8; --border: #2e2748;` and lighten the primary by
~10% if it falls below 4.5:1 against the dark background.

---------------------------------------------------------------------------------------------------------------

## 3. TYPOGRAPHY

Fluid type scale (use these exact steps; never invent sizes in between):

| Role                      | CSS                                                     | Weight | Line height | Tracking  |
|---------------------------|---------------------------------------------------------|--------|-------------|-----------|
| Display (hero headline)   | 40px on phones growing to 76px on desktop                 | 700-800| 1.05        | -0.025em  |
| H1 (page title)           | 36px growing to 56px                   | 700    | 1.1         | -0.02em   |
| H2 (section title)        | 28px growing to 42px              | 700    | 1.15        | -0.015em  |
| H3 (card title)           | 18px growing to 22px                | 600    | 1.3         | -0.005em  |
| Lead (hero subheadline)   | 17px growing to 21px           | 400    | 1.6         | 0         |
| Body                      | 16px                                            | 400    | 1.65        | 0         |
| Small / meta              | 14px                                               | 500    | 1.5         | 0         |
| Eyebrow (label above H2)  | 13px, uppercase                                   | 700    | 1.2         | 0.14em    |

Rules:
- Headings use `--font-heading`, everything else `--font-body`. Two families at most.
- Body text is never smaller than 16px on mobile (prevents iOS zoom on inputs too).
- Measure: paragraphs max 65ch; hero subheadline max 34rem; section intro max 40rem.
- Headlines under 10 words. If a given headline is long, reduce its size one step rather than wrapping
  onto four lines.
- Balance headings so their lines are of similar length, and avoid single orphan words at the end of paragraphs.
- Numbers in prices and stats use tabular (equal-width) figures so they line up.
- Load Google fonts with next/font/google in the root layout and expose them as the --font-heading and
  --font-body variables, with display swap so text is never invisible while fonts load.

Font pairing cues when the theme only names one family: elegant brands (salons, jewellery, restaurants)
pair a serif heading with a clean sans body; tech, clinics and services use one sans family with weight
contrast; playful brands (kids, cafes, events) can use a rounded sans heading.

---------------------------------------------------------------------------------------------------------------

## 4. SPACING AND LAYOUT

- Spacing steps (8px grid): 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128. Use nothing else.
- Sections: vertical padding of --section-y. Alternate `--bg` and `--surface-2` backgrounds between
  neighbouring sections so the page has rhythm, or separate them with a 1px `--border` line. Never stack
  two sections with identical backgrounds and no separation.
- Container: centred, as wide as the screen minus the gutters, never wider than --container.
- Section header: eyebrow (optional) -> H2 -> intro paragraph, centred or left-aligned consistently across the
  page, with 16px between eyebrow and H2, 16px between H2 and intro, 48-64px between header and content.
- Card grids: 24px gaps, as many columns as fit with each card at least about 260px wide. Fixed column
  counts only at specific breakpoints.
- Breakpoints (mobile first, `min-width`): 640px (large phone), 768px (tablet), 1024px (laptop), 1280px
  (desktop). Test mentally at 360px, 768px and 1440px.
- Touch targets at least 44x44px. Minimum 8px between adjacent tap targets.
- Max page width for text-heavy pages (blog post, policy): 720px.

---------------------------------------------------------------------------------------------------------------

## 5. COLOUR AND CONTRAST

- Text contrast at least 4.5:1 (normal text) and 3:1 (text 24px+ or 19px bold+, and UI borders/icons).
- Links inside paragraphs are underlined (with the underline sitting a few pixels below the text), not colour-only.
- Gradients: two stops, neighbours on the colour wheel, low contrast between stops, used on at most one or
  two surfaces per page (hero background, one CTA band). Never put body text on a busy gradient.
- Tinted shadows and borders (use the primary hue at low alpha) look more refined than grey ones.
- Images with text on top need a dark overlay, strongest at the bottom (about 65% black) fading to about 15% at
  the top, so white text passes contrast everywhere it can land.
- Status colours are for status only (success, error, stock). Don't use red for decoration.

---------------------------------------------------------------------------------------------------------------

## 6. COMPONENT RULES

**Buttons**
- Primary: solid `--primary`, text `--primary-contrast`, 48px tall (44px min), 20-28px horizontal padding,
  `--radius` (or pill if the brand is soft/playful), font-weight 600, no uppercase.
- Secondary: transparent with 1.5px `--border` (or primary at 30% alpha), text `--text`.
- Ghost/link: text only with an arrow icon that moves 2px on hover.
- Hover: darken to --primary-hover, lift 1px and gain --shadow. Pressed: back down to rest.
- Focus: a 3px ring of the primary colour at about half strength, 2px away from the button.
- Disabled: 55% opacity, a not-allowed cursor, no hover lift.
- Labels are verbs that say what happens: "Book a table", "Get a quote", "Add to cart", "Place order".
  Never "Submit", "Click here" or "Learn more" alone.
- At most one primary button per section.

**Inputs**
- 48px tall, 16px font, `--surface` background, 1.5px `--border`, `--radius-sm`, 12-14px padding.
- Label above the input (never placeholder-only), 14px, weight 600, 6px gap.
- Mark optional fields "(optional)"; mark required fields with a visible "*" and `aria-required`.
- Error: border `--danger`, message below in 14px `--danger` with an icon, linked via `aria-describedby`.
- Focus: border `--primary` and a 3px soft ring.
- Use the right `type` and `autocomplete` (`email`, `tel`, `name`, `street-address`, `postal-code`) and
  `inputMode="numeric"` for digits.

**Cards**
- `--surface`, 1px `--border`, `--radius-lg`, padding 24-32px, `--shadow-sm`; on hover (only if clickable)
  lift 3px and `--shadow`.
- The whole card is the link when it leads somewhere (one `<a>` wrapping, or a stretched-link pattern).
- Keep card heights equal in a row, with each card's footer (price, button) pinned to its bottom.

**Icons**
- Inline SVG, 20-24px, `stroke="currentColor"`, `stroke-width` 1.75-2, `fill="none"`, rounded caps/joins,
  `aria-hidden="true"` when decorative. Put icons in a 44-48px soft tinted square/circle for feature lists.

**Images**
- Always `alt` text describing the content (empty `alt=""` only for pure decoration).
- Fixed aspect ratios, with images cropped to fill their frame, so layouts never jump while loading.
- `loading="lazy"` for everything below the fold; the hero image loads eagerly.
- No image? Use a gradient block with a subtle pattern or a large initial/icon, never a broken image.

**Badges and chips**: 12-13px, weight 600, pill radius, tinted background (primary at 12% alpha) with
primary text.

---------------------------------------------------------------------------------------------------------------

## 7. MOTION

- Durations: 150ms for hovers, 250ms for reveals and menus, never above 600ms.
- Easing: --ease (fast out, gentle settle).
- Entrance for hero content: fade up 16px with a 60-80ms stagger between headline, subheadline and buttons.
- Animate only `transform` and `opacity` (never width, height, top, left).
- Respect reduced motion: when the visitor prefers reduced motion, switch off all animations and transitions and
  smooth scrolling.

- No auto-playing carousels. No parallax that moves text. No animations that loop forever except a very slow
  (8s+) background gradient drift.

---------------------------------------------------------------------------------------------------------------

## 8. ACCESSIBILITY CHECKLIST

- One `<h1>` per page; headings never skip levels.
- Landmarks: `<header>`, `<nav aria-label="Main">`, `<main id="main">`, `<footer>`.
- A "Skip to content" link as the first focusable element (visually hidden until focused).
- Every interactive element reachable and usable by keyboard, in a logical order, with a visible focus style.
- Menus and accordions expose state (`aria-expanded`, `aria-controls`); close menus with Escape.
- Form errors announced (`role="alert"` on the error summary, `aria-invalid` on fields).
- Colour is never the only signal (errors have text and icons; links are underlined in text).
- Loading states use `aria-busy="true"` on the region; skeletons are `aria-hidden`.
- `lang="en"` (or the site's language) on `<html>`.

---------------------------------------------------------------------------------------------------------------

## 9. HERO SECTIONS (the most important section on the site)

The hero decides in about three seconds whether a visitor stays. It must say what this business offers, for
whom, and what to do next, and look unmistakably premium.

### 9.1 Anatomy (top to bottom)
1. **Eyebrow / trust chip (optional):** a small pill with a proof point or offer ("Open daily 8am-10pm",
   "4.9 rating from 2,000+ guests" only if given).
2. **Headline (h1):** the value, not the category. "Fresh coffee, warm welcomes in downtown Kochi" beats
   "Welcome to our cafe". Under 10 words. Display size.
3. **Subheadline:** one sentence, max ~22 words, who it is for and why it's better. `--muted` colour.
4. **Actions:** one primary button (the main goal: book, order, shop, call) and at most one secondary
   (see menu, view work, how it works). 12-16px gap. Buttons are full-width on phones, side by side from 480px.
5. **Proof row (optional, strongly recommended):** avatars + rating, client logos, or 2-3 short facts with
   icons ("Free delivery over ₹999" only if given). Muted, small, 24-32px below the buttons.
6. **Visual:** the product, the place, the people or the app. Rounded `--radius-lg`, `--shadow-lg`,
   optionally a decorative shape or blurred colour blob behind it.

### 9.2 Size and spacing
- Height: image-led heroes fill about 88% of the screen (at most about 860px); content-led heroes use generous
  padding instead (72px on phones up to 140px on desktop).
- Headline -> subheadline 20-24px; subheadline -> buttons 32-40px; buttons -> proof row 28-32px.
- On mobile the visual goes below the text and buttons, never above the headline.

### 9.3 The six hero patterns (pick by business type and content)

**A. Split (text left, visual right)** - the safest high-converting layout. Services, clinics, SaaS,
restaurants with a signature photo, real estate. Grid `1.05fr 0.95fr` from 1024px, gap 64px, text vertically
centred. Visual: a rounded image or a composed card stack (main image + one floating detail card, e.g. a
rating card or "Next available: Today 5pm").

**B. Centered statement** - bold brands, agencies, SaaS, events, personal brands. Text centred, max-width
760px, a soft radial gradient or mesh background, a product screenshot or image row below the buttons that
overlaps into the next section (negative margin-bottom creates depth).

**C. Full-bleed image with overlay** - restaurants, hotels, travel, real estate, salons, wedding and
photography. Background image covers the section, dark gradient overlay from bottom-left, text bottom-left
aligned, white text. Never centre long text over a busy photo.

**D. Product showcase (e-commerce)** - a featured product or collection. Large product visual on a tinted
surface, headline + price/offer + "Shop now" + secondary "Browse collections", with a row of 3-4 category
chips or mini product cards under the fold line.

**E. Search-first** - real estate, travel, directories, clinics with many doctors. Headline + a large search
bar (location, type, date/budget) as the main action, with popular searches as chips below.

**F. Bento hero** - brands with several strong offers. The headline block occupies the large tile; 3-4
smaller tiles show a product, a stat, a testimonial and a CTA. Only when there is real content for every tile.

### 9.4 Decoration that looks premium (use one or two, never all)
- A soft, large radial glow of the primary colour (around 15-20% strength) behind the visual, fading to nothing.
- A subtle dotted or grid pattern at 4-6% opacity behind the hero.
- A floating detail card overlapping the image corner (white, `--shadow-lg`, 12-16px text).
- A thin highlight under one word of the headline (a pseudo-element bar in `--accent` at 35% alpha), never
  a gradient text on the whole headline.

### 9.5 Hero anti-patterns (never do these)
- Carousels / sliders in the hero.
- More than two buttons, or two primary-looking buttons.
- Generic stock-photo people pointing at laptops.
- Centred paragraph text longer than two lines.
- A hero that is only a headline on a flat colour with nothing else.
- Text over an image without an overlay.
- Headline in all caps or with letter-spacing wider than 0.02em.

---------------------------------------------------------------------------------------------------------------

## 10. SECTION RECIPES

**Navbar**: 64-72px tall, sticky with a translucent `--surface` background and a background blur,
a 1px bottom border that appears after scrolling 8px. Brand left; 4-6 links centre or right with 28-32px gaps;
one primary button on the right; cart icon with a count badge when there is a shop; account icon when there
are accounts. Mobile: hamburger (44x44) opening a full-width panel with large (18px) links and the primary
button at the bottom; lock body scroll while open; close on link click and Escape. Current page link gets
`aria-current="page"` and a subtle underline.

**Top strip (announcement bar)**: 36-40px, `--text` background with `--bg` text or primary tint, 13px,
centred, one message and an optional link. Dismissible only if it doesn't carry legal info.

**Logos / social proof strip**: "Trusted by" label in 13px muted uppercase, 5-6 logos in a row at 60% opacity,
greyscale, 28-36px tall, wrapping to 3 columns on mobile. Only with real logos/names from the content.

**Features / services**: 3 or 6 items (never 4 or 5 in one row). Icon in a tinted square, H3, 1-2 line
description. Or a **bento grid**: 4 tiles on a 3-column grid where the first tile spans 2 columns and 2 rows
and carries the strongest message with an image.

**How it works / process**: 3-4 numbered steps horizontally on desktop with a thin connecting line,
vertical on mobile. Big muted step numbers (48px, `--primary` at 20% alpha).

**Stats**: 3-4 figures, display size numbers (tabular-nums), 14px labels, separated by 1px vertical borders
on desktop. Only real numbers from the content.

**Testimonials**: quote in 18-20px, the person's name (600) and role/location (muted), avatar initials in a
circle if there is no photo, star rating if given. Grid of 3 or a two-column masonry. No auto-rotating slider.

**Pricing**: 3 tiers side by side, the recommended one elevated (border in `--primary`, "Most popular" badge,
`--shadow-lg`, scale 1.02 on desktop only). Price in display size with tabular-nums, billing period small
and muted, 4-7 feature rows with check icons, one button per card (primary on the recommended tier).

**FAQ**: `<details>`/`<summary>` accordion, 16-18px questions weight 600, a plus icon that rotates 45deg when
open, answers in `--muted`, 1px separators. 5-8 questions. Put a "Still have questions? Contact us" line after.

**CTA band**: full-width, primary or dark background (or a soft gradient), H2 + one sentence + one button,
centred, 64-96px padding, rounded `--radius-lg` inside the container on light sites.

**Contact**: two columns on desktop: the form (name, email or phone, message; plus date/time for bookings)
and a details card (address, phone as `tel:` link, email as `mailto:` link, hours, map link). Success state
replaces the form with a confirmation card and a "Send another message" link.

**Team**: portrait cards with a 4:5 aspect ratio, name, role, one line bio; initials on a tinted block if no photo.

**Gallery / portfolio**: CSS grid with a dense grid, some items spanning 2 columns; images with
captions revealed on hover (and always visible on touch devices).

**Blog / articles list**: cards with image 16:9, category chip, title (H3, 2 lines max with line-clamp),
excerpt (3 lines max), date and read time.

**Timeline**: vertical line with dots, date in `--primary`, title, text; alternating sides from 1024px.

**Footer**: `--text` or very dark background on light sites (or `--surface-2`), 4 columns on desktop
(brand + short description, pages, contact, social), 2 columns on tablet, 1 on mobile; a bottom row with
copyright and legal links in 13px muted. Social icons as inline SVGs with `aria-label`s.

---------------------------------------------------------------------------------------------------------------

## 11. E-COMMERCE UX (from large-scale usability research)

**Product listing page (shop / category)**
- Filters: desktop = persistent left panel (240-280px); mobile = a sticky "Filter" button opening a drawer.
- Show the result count next to each filter option; allow multi-select inside a filter group.
- Show applied filters as removable chips above the grid with a "Clear all" link.
- Sort dropdown top-right: Featured, Price low to high, Price high to low, Newest (only what the API supports).
- Product cards show: image (4:5 or 1:1, consistent), name (2 lines max), key attribute (size/weight/variant),
  price (sale price + struck-through original when given), rating if given, and a quick "Add to cart" button.
- Colour/variant swatches on the card update the card image.
- Prefer "Load more" to infinite scroll; remember the scroll position when returning from a product page.
- Empty result state: "No products match these filters" + "Clear filters" button + popular categories.

**Product page (buy box)**
- Two columns from 1024px: gallery left (main image + thumbnails, 1:1 or 4:5), buy box right, sticky on desktop.
- Buy box order: name (h1) -> rating summary -> price (large, tabular-nums; price per unit when sold by
  weight/quantity) -> variant selectors as BUTTONS, not dropdowns (sizes, colours) -> quantity stepper ->
  "Add to cart" (primary, full width) -> delivery estimate and return policy summary with a link -> short
  description -> details/specs in an accordion.
- Show a total-cost hint near the button when delivery charges apply ("Free delivery over ₹999").
- Allow saving items (wishlist) without an account when the site has a wishlist.
- Out of stock: disable the button, say "Out of stock", and offer "Notify me" only if the API supports it.

**Cart**
- Line items: image, name, variant, unit price, quantity stepper, line total, remove (with undo toast).
- Order summary card (sticky on desktop): subtotal, delivery (or "Calculated at checkout"), discount, total,
  primary "Checkout" button, accepted payment methods as small text/icons, return-policy link.
- Empty cart: friendly message, "Continue shopping" button, 3-4 popular products if the API lists them.

**Checkout**
- Guest checkout is the default and most prominent option; account creation is offered after the order.
- Minimise fields: one "Full name" field (not first/last), email, phone, address line 1, "Add apartment,
  suite, floor" link that reveals line 2, city, postal code, state; billing address hidden behind
  "Billing address same as delivery" (checked by default).
- Mark both required and optional fields explicitly.
- Single page with clear steps (Contact -> Delivery -> Payment -> Review) or a short multi-step flow with a
  progress indicator; the order summary is always visible (collapsible on mobile).
- Inline validation on blur, not on every keystroke; keep entered data after an error.
- The final button says exactly what happens: "Place order - ₹2,498".
- Confirmation page: big success mark, order number (copyable), what happens next, delivery estimate,
  "Track your order" button, and the optional "Create an account with one click" offer.

**Order tracking**
- One field (order number, plus email/phone if the API requires it) and a "Track" button.
- Result: a horizontal status stepper (Placed -> Confirmed -> Shipped -> Out for delivery -> Delivered)
  with dates, then the items. Friendly "We couldn't find that order" error with a help link.

**Accounts**
- Login and register on separate, focused pages (or tabs) with the brand on one side on desktop.
- Show/hide password toggle; "Forgot password?" link beside the password label; clear error messages that
  don't reveal whether an email exists.
- Account area: orders list (number, date, status chip, total, "View"), profile, addresses, logout.

---------------------------------------------------------------------------------------------------------------

## 12. INDUSTRY CUES

- **Restaurant / cafe / bakery**: warm neutrals, appetising full-bleed food photography or rich colour blocks,
  serif or rounded headings, menu with categories as tabs or anchors, prices right-aligned with dotted
  leaders, prominent "Book a table" / "Order now", opening hours and location near the top and in the footer.
- **Clinic / healthcare / wellness**: calm blues/greens/teals, lots of white, sans-serif, doctor cards with
  credentials, "Book appointment" everywhere, trust signals (years, patients, accreditations only if given),
  emergency contact visible.
- **Real estate**: search-first or full-bleed hero, property cards with price, area, beds/baths icons and
  location, "Book a site visit" CTA, map/location section, EMI or loan help if given.
- **Salon / beauty / spa**: elegant serif headings, soft neutrals with one rich accent, service menu with
  durations and prices, stylist cards, "Book now" with time slots, gallery of work.
- **Academy / courses / coaching**: energetic but clear, course cards with duration/level/fee, outcomes and
  results, mentor profiles, "Book a free demo class", FAQ about fees and batches.
- **SaaS / tech / agency**: product screenshot hero, feature bento, logos strip, pricing tiers, integrations,
  "Start free" and "Book a demo".
- **Portfolio / personal / photographer**: the work is the hero; minimal chrome, large imagery, masonry
  gallery, short about, contact with availability.
- **Retail / fashion / e-commerce**: product-led hero, category tiles, bestsellers grid, trust bar (delivery,
  returns, secure payment - only if given), reviews with photos.
- **Travel / hotels**: immersive photography, destination cards with duration and price, itinerary timelines,
  enquiry form with dates and travellers.

---------------------------------------------------------------------------------------------------------------

## 13. ANTI-PATTERNS (never ship these)

- Lorem ipsum, "Your Brand", "Product 1", "Feature title", "John Doe", placeholder phone numbers.
- Random emoji as icons. Icon fonts. Mixed icon styles.
- Centred body paragraphs longer than three lines.
- Grey text on coloured backgrounds; light grey text below 4.5:1.
- More than two font families; more than one accent colour.
- Cards with different heights in the same row; buttons with different heights in the same row.
- Full-width text lines on desktop (no max-width).
- Hover-only information on touch devices.
- Modals or popups on page load.
- Fake urgency ("Only 2 left!") or fake reviews.
- Inline style objects for layout (use classes), and forced "important" overrides.

---------------------------------------------------------------------------------------------------------------

## 14. WORKED EXAMPLES

Each example describes, in detail, a section designed to a high professional standard: its layout, sizes,
colours, content arrangement, states and mobile behaviour. Use them as the quality bar. Design this site's
sections with the same care, using its own content, theme and section styles.

### Example A - Split hero for a neighbourhood cafe

- **Layout:** two columns from 1024px (text 52%, visual 48%, 72px gap), text vertically centred. One column
  on phones with the visual below the buttons.
- **Background:** the page's off-white with a large, soft glow of the primary colour in the top-right corner,
  so the visual seems lit from behind.
- **Trust chip:** above the headline, a small white pill with a thin border: a green dot with a faint halo
  and "Open today until 10pm" in 13px semi-bold muted text.
- **Headline:** display size (about 76px on desktop, 40px on phones), serif, tight line height (1.05),
  slightly negative letter-spacing, balanced across two lines: "Fresh coffee, warm welcomes in downtown
  Kochi". The words "warm welcomes" sit on a soft highlighter bar in the accent colour at a third of its
  strength, running under the lower half of the letters.
- **Subheadline:** 21px, muted, max about 34rem wide, one sentence about fresh coffee and pastries in a
  quiet corner made for working and catching up.
- **Buttons:** "Book a table" (solid primary, 48px tall) and "See the menu" (outlined), side by side from
  480px, full-width and stacked on phones.
- **Proof row:** three short points with small primary check marks in 14px muted text ("Baked fresh daily",
  "Quiet work-friendly seating", "Free Wi-Fi").
- **Visual:** a tall 4:5 image with 20px rounded corners and a deep soft shadow; without a photo, a rich
  gradient from a dark shade of the primary to the secondary colour. A small white floating card overlaps its
  bottom-left corner ("Signature filter coffee - slow-brewed every morning"), with its own shadow, like a
  label pinned to the photo.
- **Motion:** the chip, headline, subheadline and buttons fade up 16px one after another, 70ms apart, finishing
  in under 0.8 seconds.

### Example B - Full-bleed hero for a real-estate developer

- **Height:** the section fills about 88% of the screen height (capped around 860px), with a wide photo of the
  property at golden hour covering it edge to edge.
- **Overlay:** a gradient from nearly black at the bottom (about 78%) to light (about 15%) at the top keeps
  white text readable wherever it lands. Without a photo, a primary-to-secondary gradient fills the area.
- **Text placement:** bottom-left, max 760px wide, not centred over the busiest part of the photo.
  - White headline: "Plots with clear titles, minutes from the city".
  - Subheadline at 86% white: verified plots and villas, with site visits arranged around your schedule.
- **Buttons:** the primary "Book a site visit", and a second one in frosted glass (translucent white fill, a
  white border at half strength, a slight background blur): "View properties".
- **Phones:** the text block keeps its bottom-left placement with generous bottom padding, and the buttons
  stack.

### Example C - Search-first centred hero for a property or travel site

- **Background:** a wide, soft oval glow of the primary colour spills down from the top edge.
- **Text:** a centred headline in display size and a one-line muted subheadline beneath it.
- **Search bar:** the main action, 640px wide, fully rounded, white, with a deep shadow.
  - A magnifier icon on the left.
  - A borderless input with a real label, hidden visually but read by screen readers: "Location, project or
    property type".
  - A primary "Search" button inside the bar on the right.
  - On focus, the whole bar gets a soft primary ring.
- **Popular searches:** below the bar, a centred row of outlined pills; hovering one turns its border and
  text primary, and clicking it runs that search.
- **Phones:** the bar becomes a rounded card with the button full-width underneath.

### Example D - Navbar for a small online shop

- **Bar:**
  - 72px tall and sticky, with a white background at 82% opacity and a background blur, so content slides
    softly underneath.
  - A thin bottom border appears only after the visitor scrolls 8px.
  - Brand on the left in the heading font, bold, 22px.
- **Links:**
  - Four page links in the middle, in muted text with 30px gaps.
  - The current page is in full text colour, with a 2px primary underline sitting 8px below it.
- **Right side:**
  - A 44px round cart icon button, with a small primary count badge on its top-right corner that updates
    the moment something is added.
  - A primary "Order now" button.
- **Phones:**
  - Links and the button hide behind a 44px hamburger whose three lines animate into an X.
  - The menu opens as a full-width white panel with large 18px links separated by thin lines, and the
    primary button at the bottom.
  - The page behind stops scrolling. The menu closes on Escape or when a link is chosen.
- **Skip link:** a "Skip to content" link appears at the top-left when a keyboard user tabs into the page.

### Example E - Shop page (product grid with filters)

- **Toolbar:**
  - On the left, category chips (rounded, outlined, 40px tall); the selected chip is filled with the primary
    colour.
  - On the right, a "Sort by" dropdown offering only what the API supports.
- **Count:** below the toolbar, a small muted "24 products" line, announced to screen readers when it changes.
- **Grid:** cards fill as many columns as fit at about 220px minimum width, with 24px gaps.
- **Card:**
  - A 4:5 image (or, without a photo, a soft two-tone gradient with the product's initial in large serif
    letters) and 20px rounded corners.
  - The name in 17px semi-bold, clipped to two lines, with the category in small muted text.
  - At the bottom, the price in bold tabular figures on the left and a compact "Add to cart" button on the
    right, which briefly changes to "Added" when clicked.
  - Hover lifts the card 3px and deepens its shadow.
- **Loading:** eight shimmering skeleton cards.
- **Empty:** a dashed rounded box: "No products match this filter" and a "Show all products" button.
- **Error:** the same box in red tones, with the reason and a "Try again" button.

### Example F - Product page buy box

- **Layout:** the gallery on the left (a large square image with a row of thumbnails beneath) and the buy
  box on the right, which stays in view while the visitor scrolls on desktop.
- **Buy box, top to bottom:**
  - The product name as the page heading, and a small star rating with the review count.
  - The price in large bold tabular figures; when on sale, the old price is struck through in muted text
    next to it, with a small "Save 20%" badge.
  - Size options as a row of square buttons (the selected one has a primary border and tint).
  - A quantity stepper with large minus and plus buttons.
  - A full-width primary "Add to cart" button.
  - Two short lines with small icons: delivery estimate or "Free delivery over ₹999" (only when given), and
    "Easy 7-day returns" with a link to the policy.
  - The description, then collapsible "Details" and "Care" sections.
- **Out of stock:** the button is disabled and reads "Out of stock".

### Example G - Guest-first checkout

- **Layout:** one page with two columns on desktop, the form on the left (60%) and the order summary card on
  the right, which stays in view. On phones the summary collapses into a bar at the top: "Show order summary
  - ₹2,498".
- **Form sections,** each under a small bold heading:
  - Contact: full name (one field, not first and last), email, phone.
  - Delivery address: address; a text link "+ Add apartment, suite or floor" that reveals line 2 only when
    needed; city and PIN code side by side.
  - A checkbox "Billing address same as delivery", ticked by default.
- **Field details:**
  - Every label sits above its field.
  - Required fields show an asterisk and optional ones say "(optional)".
  - The keyboard matches the field (email, phone, numbers).
- **Validation:** fields are checked when the visitor leaves them. An error shows as a red border and a short
  message under the field that says how to fix it ("Enter a 6-digit PIN code").
- **Submit:** the button states the action and the amount: "Place order - ₹2,498". It becomes "Placing your
  order…" while sending.
- **Reassurance:** a small line below says no account is needed and one can be created after ordering.
- **Confirmation page:**
  - A large green check, "Thank you, your order is placed", and the order number in a copyable pill.
  - What happens next, and a "Track your order" button.

### Example H - Feature bento grid for a clinic

- **Header:** a section heading and a one-line intro, left-aligned.
- **Grid:** three columns on desktop.
  - **Lead tile:** spans two columns and two rows. A deep primary gradient, lit by a softer glow of the
    secondary colour from its top-left corner. White text sits at the bottom: a large serif title ("Care that
    starts with listening") and a short paragraph at 85% white.
  - **Three smaller tiles:** white, with a thin border and 20px rounded corners. Each has a 44px rounded
    square icon tinted with the primary colour (a simple line icon inside), a bold 20px title and two lines of
    muted text.
- **Phones:** all tiles stack in one column, the lead tile first and at least 320px tall.

### Example I - FAQ that feels effortless

- **Layout:** a centred column about 820px wide on the alternate section background, a small uppercase
  eyebrow "FAQ" in the primary colour, and the heading "Questions, answered".
- **Questions:** each on its own row at least 64px tall, 17px semi-bold, separated by thin lines. A plus sign
  on the right rotates into an X when opened.
- **Answers:** muted text with comfortable line length, revealed smoothly.
- **Behaviour:** works with the keyboard and without JavaScript.
- **Closing line:** "Still have questions? Talk to us" links to the contact section.

### Example J - Pricing with a recommended plan

- **Layout:** three plan cards side by side on desktop, stacked on phones. White cards with thin borders,
  20px corners and 32px padding.
- **Recommended plan:**
  - A 2px primary border, a deeper shadow, and a very slight enlargement on desktop.
  - A "Most popular" pill badge overlapping its top edge.
- **Each card:**
  - The plan name in 18px semi-bold.
  - The price in 44px extra-bold tabular figures, with "/month" small and muted.
  - Five features with primary check marks.
  - One full-width button at the bottom: primary on the recommended card, outlined on the others.
- **Alignment:** all buttons line up on one line, whatever the length of the feature lists.

### Example K - Contact section for a salon

- **Layout:** two columns on desktop.
- **Left, the form:**
  - Name, phone and a message (a service and a preferred time for bookings), each with a clear label.
  - A primary "Send message" button that shows "Sending…" and is disabled while sending.
- **Right, a details card:**
  - The address with a "Get directions" link.
  - The phone number as a tap-to-call link and the email as a tap-to-email link.
  - Opening hours in a small two-column list, with today's row highlighted.
- **After sending:** the form is replaced by a soft green card: "Thanks, we've got your message. We usually
  reply within a few hours", with a "Send another message" link.
- **On error:** a red alert above the form explains what went wrong and keeps everything the visitor typed.

### Example L - Footer for a restaurant

- **Background:** a dark footer (the text colour as background) with light text.
- **Columns:** four on desktop, two on tablets, one on phones.
  1. Brand and a one-line description.
  2. Page links.
  3. Contact (address, phone, email as links) and opening hours.
  4. Social icons as 40px round outlined buttons, each with a screen-reader label.
- **Bottom row:** a thin divider, then the copyright on the left and "Privacy" and "Terms" links on the
  right, in 13px text at 70% opacity.

---------------------------------------------------------------------------------------------------------------

## 15. FINAL SELF-CHECK (do this silently before answering)

1. Does every page start with a strong, specific hero or page header that says what this business offers?
2. Is the content exactly the given content (no invented facts, no placeholders)?
3. Are colours, fonts, radius and shadows only from the tokens / the design reference?
4. Does every section have generous spacing and a clear single focus?
5. Is there exactly one primary button per section, with a verb label?
6. Does it work at 360px (no horizontal scroll, stacked layout, full-width buttons) and look great at 1440px?
7. Are all interactive elements keyboard-accessible with visible focus, and all inputs labelled?
8. Do data views have loading, empty and error states, and forms have validation, sending and success states?
9. Does every import exist, every API call use a lib/api.ts function, and every type come from lib/api.ts?
10. Would a senior designer be proud to put this in their portfolio? If not, improve the hero first.
