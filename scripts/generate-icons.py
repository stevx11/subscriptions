"""
Generates the app icon and splash mark.

The mark is a stack of three offset rounded bars — a subscription list seen
edge-on — over the app's dark ground, with the chart blue as the accent. It is
drawn rather than hand-authored so the geometry stays consistent across the
sizes iOS needs, and so it can be regenerated after a palette change.

Rendered at 4x and downsampled, which is the cheap way to get clean antialiased
edges out of Pillow without a real vector renderer.

    python scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets" / "images"

BG = (10, 13, 18)          # palette.bg
ACCENT = (76, 143, 224)    # palette.chart
ACCENT_DIM = (44, 84, 134)
INK = (244, 247, 250)      # palette.text

SS = 4  # supersampling factor


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(size, with_background=True):
    """The logo mark on a square canvas of `size` px."""
    s = size * SS
    image = Image.new("RGBA", (s, s), BG + (255,) if with_background else (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Three stacked bars, each shorter than the one above: a list of charges
    # descending in size, which is what the app is actually about.
    bar_h = s * 0.118
    gap = s * 0.076
    radius = bar_h / 2

    widths = [0.52, 0.40, 0.28]
    colors = [INK, ACCENT, ACCENT_DIM]

    dot_r = bar_h * 0.42
    dot_gap = s * 0.062

    # Centre the whole composition — bars plus the trailing dot — rather than
    # centring the bars and letting the dot pull the mass off to one side.
    group_w = s * widths[0] + dot_gap + 2 * dot_r
    group_h = 3 * bar_h + 2 * gap
    left = (s - group_w) / 2
    top = (s - group_h) / 2

    for index, (width, color) in enumerate(zip(widths, colors)):
        y = top + index * (bar_h + gap)
        rounded(draw, [left, y, left + s * width, y + bar_h], radius, color + (255,))

    # A single dot trailing the top bar — the "next charge" marker that the
    # whole interface is built around.
    cx = left + s * widths[0] + dot_gap + dot_r
    cy = top + bar_h / 2
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=ACCENT + (255,))

    return image.resize((size, size), Image.LANCZOS)


def write(image, name):
    path = IMAGES / name
    image.save(path, "PNG")
    print(f"  {name}  {image.size[0]}x{image.size[1]}")


def main():
    IMAGES.mkdir(parents=True, exist_ok=True)
    print("Writing icons:")

    # iOS app icon: 1024x1024, fully opaque, no transparency and no rounding —
    # iOS applies the mask itself, and a pre-rounded icon gets double-rounded.
    icon = draw_mark(1024).convert("RGB")
    write(icon, "icon.png")

    # Splash mark: transparent, since the splash screen paints its own ground.
    write(draw_mark(512, with_background=False), "splash-icon.png")

    # Android adaptive icon: the foreground is drawn inside the safe circle,
    # so the mark is inset to survive the system's mask.
    foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    inner = draw_mark(620, with_background=False)
    foreground.paste(inner, (202, 202), inner)
    write(foreground, "android-icon-foreground.png")

    background = Image.new("RGB", (1024, 1024), BG)
    write(background, "android-icon-background.png")

    monochrome = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mono_mark = draw_mark(620, with_background=False)
    # Flatten every element to white; the launcher tints it.
    pixels = mono_mark.load()
    for x in range(mono_mark.size[0]):
        for y in range(mono_mark.size[1]):
            r, g, b, a = pixels[x, y]
            if a > 0:
                pixels[x, y] = (255, 255, 255, a)
    monochrome.paste(mono_mark, (202, 202), mono_mark)
    write(monochrome, "android-icon-monochrome.png")

    write(draw_mark(48).convert("RGB"), "favicon.png")


if __name__ == "__main__":
    main()
