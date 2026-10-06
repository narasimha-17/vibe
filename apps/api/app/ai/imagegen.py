"""Generates illustrations for hero images and product placeholders.

There is no image model behind this. It draws original, on-theme vector artwork (gradient backdrop, soft shapes and a
simple motif chosen from the words in the prompt) and returns it as an SVG data URI that can go straight into an image
field. It is meant for placeholders that look designed rather than empty. For real photography, upload an image.
"""

import hashlib
import re
from urllib.parse import quote

# motif keywords -> (name, palette of two colours)
MOTIFS: list[tuple[tuple[str, ...], str, tuple[str, str]]] = [
    (("cake", "bakery", "bread", "pastry", "cupcake", "dessert", "sweet"), "cake", ("#f6a5c0", "#7a3e65")),
    (("coffee", "cafe", "tea", "chai", "drink"), "cup", ("#d9a066", "#4a2c1a")),
    (("food", "restaurant", "dish", "meal", "pizza", "burger", "curry", "kitchen"), "bowl", ("#ffb35c", "#8a2b0e")),
    (("travel", "trip", "tour", "beach", "holiday", "destination", "mountain"), "mountain", ("#6ec3f4", "#1b3b6f")),
    (("clinic", "doctor", "health", "medical", "care", "hospital", "wellness"), "cross", ("#7fe0c3", "#0d5c63")),
    (("school", "course", "student", "learn", "education", "academy", "book"), "book", ("#a9b8ff", "#2b2f77")),
    (("shop", "store", "product", "bag", "fashion", "boutique", "gift"), "bag", ("#ffb199", "#6b2737")),
    (("delivery", "logistics", "courier", "parcel", "truck", "shipping"), "box", ("#ffd86e", "#5a3d05")),
    (("tech", "software", "app", "startup", "saas", "digital", "code"), "chip", ("#8f7bff", "#1c1550")),
]
DEFAULT = ("abstract", ("#a08cff", "#2a1f5c"))


def _motif(prompt: str) -> tuple[str, tuple[str, str]]:
    low = prompt.lower()
    for words, name, palette in MOTIFS:
        if any(w in low for w in words):
            return name, palette
    return DEFAULT


def _shapes(name: str, c1: str, c2: str) -> str:
    w = "#ffffff"
    if name == "cake":
        return (f'<ellipse cx="600" cy="520" rx="230" ry="46" fill="{c2}" opacity=".25"/><rect x="420" y="330" width="360" height="190" rx="26" fill="{w}"/>'
                f'<rect x="420" y="330" width="360" height="66" rx="26" fill="{c1}"/><rect x="560" y="250" width="16" height="80" rx="8" fill="{w}"/><ellipse cx="568" cy="238" rx="12" ry="20" fill="#ffd166"/>'
                f'<circle cx="470" cy="470" r="14" fill="{c1}"/><circle cx="600" cy="480" r="14" fill="{c1}"/><circle cx="730" cy="470" r="14" fill="{c1}"/>')
    if name == "cup":
        return (f'<ellipse cx="600" cy="500" rx="200" ry="34" fill="{c2}" opacity=".25"/><path d="M430 330h280v130a120 120 0 0 1-120 120h-40a120 120 0 0 1-120-120z" fill="{w}"/>'
                f'<path d="M710 360h40a60 60 0 0 1 0 120h-40" fill="none" stroke="{w}" stroke-width="22"/><path d="M500 300c-20-40 20-50 0-90M600 300c-20-40 20-50 0-90M700 300c-20-40 20-50 0-90" stroke="{w}" stroke-width="12" fill="none" stroke-linecap="round" opacity=".8"/>')
    if name == "bowl":
        return (f'<ellipse cx="600" cy="520" rx="240" ry="36" fill="{c2}" opacity=".25"/><path d="M380 380h440a220 200 0 0 1-440 0z" fill="{w}"/><path d="M420 380c30-70 90-100 180-100s150 30 180 100z" fill="{c1}"/>'
                f'<circle cx="520" cy="330" r="16" fill="{w}"/><circle cx="600" cy="300" r="16" fill="{w}"/><circle cx="680" cy="330" r="16" fill="{w}"/>')
    if name == "mountain":
        return (f'<circle cx="820" cy="240" r="70" fill="#fff6c4"/><path d="M200 540l220-300 130 170 100-120 250 250z" fill="{w}" opacity=".95"/><path d="M420 240l60 80-40 20-40-30z" fill="{c1}"/>'
                f'<path d="M0 540h1200v100H0z" fill="{c2}" opacity=".35"/>')
    if name == "cross":
        return (f'<circle cx="600" cy="360" r="190" fill="{w}" opacity=".92"/><rect x="565" y="260" width="70" height="200" rx="16" fill="{c1}"/><rect x="500" y="325" width="200" height="70" rx="16" fill="{c1}"/>')
    if name == "book":
        return (f'<path d="M600 280c-80-50-200-50-260-20v260c60-30 180-30 260 20z" fill="{w}"/><path d="M600 280c80-50 200-50 260-20v260c-60-30-180-30-260 20z" fill="{w}" opacity=".85"/>'
                f'<path d="M380 340h180M380 390h180M640 340h180M640 390h180" stroke="{c1}" stroke-width="14" stroke-linecap="round"/>')
    if name == "bag":
        return (f'<path d="M430 300h340l40 250H390z" fill="{w}"/><path d="M510 300c0-70 30-110 90-110s90 40 90 110" fill="none" stroke="{w}" stroke-width="22"/><circle cx="510" cy="340" r="12" fill="{c1}"/><circle cx="690" cy="340" r="12" fill="{c1}"/>')
    if name == "box":
        return (f'<path d="M600 230l230 100v220l-230 100-230-100V330z" fill="{w}"/><path d="M600 230l230 100-230 100-230-100z" fill="{c1}"/><path d="M600 430v220" stroke="{c2}" stroke-width="10" opacity=".5"/>')
    if name == "chip":
        return (f'<rect x="440" y="240" width="320" height="320" rx="34" fill="{w}"/><rect x="510" y="310" width="180" height="180" rx="20" fill="{c1}"/>'
                + "".join(f'<rect x="{470 + i * 55}" y="200" width="16" height="40" fill="{w}"/><rect x="{470 + i * 55}" y="560" width="16" height="40" fill="{w}"/>' for i in range(5)))
    return (f'<circle cx="480" cy="400" r="150" fill="{w}" opacity=".9"/><circle cx="700" cy="330" r="110" fill="{c1}" opacity=".9"/><circle cx="740" cy="500" r="70" fill="{w}" opacity=".6"/>')


def generate(prompt: str, width: int = 1200, height: int = 800) -> str:
    """An SVG data URI illustration for the prompt. The same prompt always draws the same picture."""
    name, (c1, c2) = _motif(prompt)
    seed = int(hashlib.sha1(prompt.lower().encode()).hexdigest()[:6], 16)
    angle = seed % 60 + 20
    blobs = "".join(
        f'<circle cx="{(seed >> (i * 3)) % 1200}" cy="{(seed >> (i * 2 + 1)) % 800}" r="{120 + (seed >> i) % 160}" fill="#ffffff" opacity="{0.05 + i * 0.03:.2f}"/>' for i in range(5)
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="{width}" height="{height}" preserveAspectRatio="xMidYMid slice">'
        f'<defs><linearGradient id="g" gradientTransform="rotate({angle})"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
        f'<rect width="1200" height="800" fill="url(#g)"/>{blobs}{_shapes(name, c1, c2)}</svg>'
    )
    return "data:image/svg+xml;utf8," + quote(re.sub(r"\s+", " ", svg), safe="/:;,=' ()#.-")
