"""Generate VoxForge icons in Atom One Dark style.

Produces:
  - icon.png (1024x1024) — high-res master, full color
  - 32x32.png, 128x128.png, 128x128@2x.png — Tauri bundle assets
  - icon-512x512.png — for stores
  - tray-icon.png (64x64) — accent-colored mic for system tray

Run:  python3 generate.py
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

# Atom One Dark palette
BG_OUTER = (40, 44, 52, 255)        # #282c34
BG_INNER = (33, 37, 43, 255)        # #21252b
BORDER = (62, 68, 81, 255)          # #3e4451
ACCENT = (97, 175, 239, 255)        # #61afef — blue
ACCENT_DEEP = (76, 145, 207, 255)
GREEN = (152, 195, 121, 255)        # #98c379
WHITE_SOFT = (255, 255, 255, 230)


def vertical_gradient(size: int, top: tuple, bottom: tuple) -> Image.Image:
    """Solid linear top→bottom gradient in an RGBA layer."""
    grad = Image.new("RGBA", (1, size))
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        a = int(top[3] * (1 - t) + bottom[3] * t)
        grad.putpixel((0, y), (r, g, b, a))
    return grad.resize((size, size))


def _masked_overlay(base: Image.Image, overlay: Image.Image, mask: Image.Image) -> None:
    """alpha_composite `overlay` onto `base` only inside `mask` (mode L)."""
    masked = Image.new("RGBA", base.size, (0, 0, 0, 0))
    masked.paste(overlay, (0, 0), mask)
    base.alpha_composite(masked)


def render_master(size: int = 1024) -> Image.Image:
    """Render the full color master at any size (SSAA via 2x supersampling)."""
    s = size * 2  # supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-square background, Atom One Dark
    radius = s // 5
    draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=BG_OUTER)

    # Subtle top sheen + bottom shade, clipped to the rounded shape
    bg_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(bg_mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=255)
    sheen = vertical_gradient(s, (255, 255, 255, 22), (0, 0, 0, 70))
    _masked_overlay(img, sheen, bg_mask)

    # Subtle inner border
    draw.rounded_rectangle((10, 10, s - 11, s - 11), radius=radius - 6, outline=BORDER, width=6)

    cx, cy = s // 2, int(s * 0.44)

    # Sound waves — three arcs each side, fading outward
    for i, (alpha, offset) in enumerate([(230, 0), (160, 90), (90, 180)]):
        color = (GREEN[0], GREEN[1], GREEN[2], alpha)
        r_arc = int(s * 0.20) + offset
        bbox_l = (cx - r_arc, cy - r_arc, cx + r_arc, cy + r_arc)
        width = max(12, 26 - i * 4)
        draw.arc(bbox_l, start=120, end=240, fill=color, width=width)
        draw.arc(bbox_l, start=300, end=60, fill=color, width=width)

    # Microphone body — rounded pill
    mic_w = int(s * 0.22)
    mic_h = int(s * 0.42)
    mic_left = cx - mic_w // 2
    mic_right = cx + mic_w // 2
    mic_top = cy - int(mic_h * 0.55)
    mic_bottom = cy + int(mic_h * 0.45)
    pill_radius = mic_w // 2

    # Drop shadow under the mic
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (mic_left + 6, mic_top + 18, mic_right + 6, mic_bottom + 18),
        radius=pill_radius,
        fill=(0, 0, 0, 170),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=24))
    img.alpha_composite(shadow)

    # Mic pill — solid accent fill, then a soft top→bottom sheen on top
    draw.rounded_rectangle(
        (mic_left, mic_top, mic_right, mic_bottom), radius=pill_radius, fill=ACCENT
    )
    pill_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(pill_mask).rounded_rectangle(
        (mic_left, mic_top, mic_right, mic_bottom), radius=pill_radius, fill=255
    )
    pill_sheen = vertical_gradient(s, (255, 255, 255, 70), (0, 0, 0, 90))
    _masked_overlay(img, pill_sheen, pill_mask)

    # Mic grille — three slim, rounded "vents" cut into the pill
    grille_color = (33, 37, 43, 230)
    grille_count = 3
    inset_x = pill_radius // 2
    block_h = int(mic_h * 0.13)
    spacing = int(mic_h * 0.06)
    total = grille_count * block_h + (grille_count - 1) * spacing
    start_y = mic_top + (mic_h - total) // 2 - int(mic_h * 0.04)
    for i in range(grille_count):
        y0 = start_y + i * (block_h + spacing)
        draw.rounded_rectangle(
            (mic_left + inset_x, y0, mic_right - inset_x, y0 + block_h),
            radius=block_h // 2,
            fill=grille_color,
        )

    # Specular highlight along the left edge
    spec = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(spec).rounded_rectangle(
        (mic_left + 18, mic_top + 32, mic_left + 44, mic_bottom - 32),
        radius=14,
        fill=(255, 255, 255, 110),
    )
    spec = spec.filter(ImageFilter.GaussianBlur(radius=8))
    img.alpha_composite(spec)

    # Stand — U-cradle + post + foot
    stroke = max(20, int(s * 0.022))
    cradle_pad = int(s * 0.085)
    cradle_bbox = (
        mic_left - cradle_pad,
        mic_bottom - mic_w * 0.55,
        mic_right + cradle_pad,
        mic_bottom + mic_w * 0.55,
    )
    draw.arc(cradle_bbox, start=0, end=180, fill=ACCENT, width=stroke)
    post_top = mic_bottom + int(mic_w * 0.45)
    post_bottom = post_top + int(s * 0.11)
    draw.line((cx, post_top, cx, post_bottom), fill=ACCENT, width=stroke)
    foot_w = int(s * 0.13)
    draw.line(
        (cx - foot_w, post_bottom, cx + foot_w, post_bottom),
        fill=ACCENT,
        width=stroke,
    )

    return img.resize((size, size), Image.LANCZOS)


def render_tray(size: int = 64) -> Image.Image:
    """Compact, transparent-background tray glyph in accent blue."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = s // 2, int(s * 0.42)

    mic_w = int(s * 0.36)
    mic_h = int(s * 0.56)
    mic_left = cx - mic_w // 2
    mic_right = cx + mic_w // 2
    mic_top = cy - int(mic_h * 0.55)
    mic_bottom = cy + int(mic_h * 0.45)
    pill_radius = mic_w // 2
    draw.rounded_rectangle(
        (mic_left, mic_top, mic_right, mic_bottom), radius=pill_radius, fill=ACCENT
    )

    # Cradle
    cradle_pad = int(s * 0.10)
    cradle_bbox = (
        mic_left - cradle_pad,
        mic_bottom - mic_w * 0.55,
        mic_right + cradle_pad,
        mic_bottom + mic_w * 0.55,
    )
    stroke = max(8, int(s * 0.045))
    draw.arc(cradle_bbox, start=0, end=180, fill=ACCENT, width=stroke)

    # Post + foot
    post_top = mic_bottom + int(mic_w * 0.40)
    post_bottom = post_top + int(s * 0.12)
    draw.line((cx, post_top, cx, post_bottom), fill=ACCENT, width=stroke)
    foot_w = int(s * 0.18)
    draw.line(
        (cx - foot_w, post_bottom, cx + foot_w, post_bottom),
        fill=ACCENT,
        width=stroke,
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    here = Path(__file__).parent
    master = render_master(1024)
    master.save(here / "icon.png")
    master.resize((512, 512), Image.LANCZOS).save(here / "icon-512x512.png")
    master.resize((256, 256), Image.LANCZOS).save(here / "128x128@2x.png")
    master.resize((128, 128), Image.LANCZOS).save(here / "128x128.png")
    master.resize((32, 32), Image.LANCZOS).save(here / "32x32.png")
    render_tray(64).save(here / "tray-icon.png")
    render_tray(32).save(here / "tray-icon-32.png")
    print("ok")


if __name__ == "__main__":
    main()
