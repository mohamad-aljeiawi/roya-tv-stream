#!/usr/bin/env python3
"""
══════════════════════════════════════════════
  PWA Icon Generator — من صورة واحدة لكل شي
══════════════════════════════════════════════

Usage:
  python generate-icons.py logo.png
  python generate-icons.py logo.jpg --out ./my-project/assets
  python generate-icons.py logo.png --bg "#c8102e" --name "My App"

Requirements:
  pip install Pillow
"""

import argparse
import os
import sys
from PIL import Image


# ── All icon sizes needed ──────────────────────────────────────
PWA_ICONS = {
    "icon-72x72.png":    72,
    "icon-96x96.png":    96,
    "icon-128x128.png":  128,
    "icon-144x144.png":  144,
    "icon-152x152.png":  152,
    "icon-192x192.png":  192,
    "icon-384x384.png":  384,
    "icon-512x512.png":  512,
}

APPLE_ICONS = {
    "apple-touch-icon.png":          180,
    "apple-touch-icon-120x120.png":  120,
    "apple-touch-icon-152x152.png":  152,
    "apple-touch-icon-167x167.png":  167,
    "apple-touch-icon-180x180.png":  180,
}

WINDOWS_ICONS = {
    "mstile-150x150.png":  150,
    "mstile-310x310.png":  310,
}

FAVICON_ICONS = {
    "favicon-16x16.png":  16,
    "favicon-32x32.png":  32,
    "favicon-48x48.png":  48,
}

# iPhone splash screen sizes
SPLASH_SCREENS = {
    "apple-splash-750x1334.png":   (750, 1334),    # iPhone 8
    "apple-splash-1125x2436.png":  (1125, 2436),   # iPhone X / XS
    "apple-splash-1170x2532.png":  (1170, 2532),   # iPhone 12 / 13 / 14
    "apple-splash-1179x2556.png":  (1179, 2556),   # iPhone 15 / 16
    "apple-splash-1284x2778.png":  (1284, 2778),   # iPhone 12/13 Pro Max
    "apple-splash-1290x2796.png":  (1290, 2796),   # iPhone 15 Pro Max
    "apple-splash-1536x2048.png":  (1536, 2048),   # iPad Air / Mini
    "apple-splash-1668x2388.png":  (1668, 2388),   # iPad Pro 11"
    "apple-splash-2048x2732.png":  (2048, 2732),   # iPad Pro 12.9"
}


def hex_to_rgba(hex_color):
    """Convert hex color string to RGBA tuple."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return (r, g, b, 255)
    elif len(hex_color) == 8:
        r, g, b, a = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16), int(hex_color[6:8], 16)
        return (r, g, b, a)
    raise ValueError(f"Invalid hex color: #{hex_color}")


def detect_bg_color(img):
    """Detect the dominant background color from corners of the image."""
    w, h = img.size
    corners = [
        img.getpixel((2, 2)),
        img.getpixel((w - 3, 2)),
        img.getpixel((2, h - 3)),
        img.getpixel((w - 3, h - 3)),
    ]
    # Average the corner colors
    avg = tuple(sum(c[i] for c in corners) // len(corners) for i in range(min(len(corners[0]), 4)))
    if len(avg) == 3:
        avg = avg + (255,)
    return avg


def generate_icon(src, size, output_path):
    """Resize source image to given size and save."""
    img = src.resize((size, size), Image.LANCZOS)
    img.save(output_path, "PNG", optimize=True)


def generate_favicon_ico(src, output_path):
    """Generate multi-size .ico file."""
    sizes = [16, 32, 48]
    images = [src.resize((s, s), Image.LANCZOS) for s in sizes]
    images[0].save(output_path, format="ICO", sizes=[(s, s) for s in sizes])


def generate_maskable(src, output_path, bg_color, size=512):
    """Generate maskable icon with 10% safe-zone padding."""
    padding = int(size * 0.1)
    inner = size - (padding * 2)
    bg = Image.new("RGBA", (size, size), bg_color)
    inner_img = src.resize((inner, inner), Image.LANCZOS)
    bg.paste(inner_img, (padding, padding), inner_img)
    bg.save(output_path, "PNG", optimize=True)


def generate_splash(src, output_path, width, height, bg_color):
    """Generate splash screen with centered logo."""
    bg = Image.new("RGBA", (width, height), bg_color)
    logo_size = min(width, height) // 4
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    x = (width - logo_size) // 2
    y = (height - logo_size) // 2 - (height // 20)  # slightly above center
    bg.paste(logo, (x, y), logo)
    bg.save(output_path, "PNG", optimize=True)


def main():
    parser = argparse.ArgumentParser(
        description="🎨 PWA Icon Generator — من صورة واحدة لكل الأحجام",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("source", help="Source image (PNG or JPG, 512x512+ recommended)")
    parser.add_argument("--out", "-o", default="./assets", help="Output directory (default: ./assets)")
    parser.add_argument("--bg", default=None, help="Background color for maskable/splash (hex, e.g. '#c8102e'). Auto-detected if not set.")
    parser.add_argument("--splash-bg", default="#090909", help="Splash screen background (default: #090909 dark)")
    parser.add_argument("--no-splash", action="store_true", help="Skip splash screen generation")
    parser.add_argument("--no-favicon", action="store_true", help="Skip favicon.ico generation")

    args = parser.parse_args()

    # Validate source
    if not os.path.exists(args.source):
        print(f"❌ File not found: {args.source}")
        sys.exit(1)

    # Load source image
    print(f"\n📂 Source: {args.source}")
    src = Image.open(args.source).convert("RGBA")
    w, h = src.size
    print(f"   Size: {w}x{h}")

    if w < 512 or h < 512:
        print(f"⚠️  Warning: Source is {w}x{h}, 512x512+ recommended for best quality")

    # Detect or set background color
    if args.bg:
        bg_color = hex_to_rgba(args.bg)
    else:
        bg_color = detect_bg_color(src)
        print(f"   Auto-detected BG: #{bg_color[0]:02x}{bg_color[1]:02x}{bg_color[2]:02x}")

    splash_bg = hex_to_rgba(args.splash_bg)

    # Create output directories
    icons_dir = os.path.join(args.out, "icons")
    splash_dir = os.path.join(args.out, "splash")
    os.makedirs(icons_dir, exist_ok=True)

    count = 0

    # ── PWA Icons ──
    print(f"\n🔷 PWA Icons:")
    for name, size in PWA_ICONS.items():
        path = os.path.join(icons_dir, name)
        generate_icon(src, size, path)
        print(f"   ✓ {name} ({size}x{size})")
        count += 1

    # ── Apple Touch Icons ──
    print(f"\n🍎 Apple Touch Icons:")
    for name, size in APPLE_ICONS.items():
        path = os.path.join(icons_dir, name)
        generate_icon(src, size, path)
        print(f"   ✓ {name} ({size}x{size})")
        count += 1

    # ── Windows Tiles ──
    print(f"\n🪟 Windows Tiles:")
    for name, size in WINDOWS_ICONS.items():
        path = os.path.join(icons_dir, name)
        generate_icon(src, size, path)
        print(f"   ✓ {name} ({size}x{size})")
        count += 1

    # ── Favicons ──
    print(f"\n⭐ Favicons:")
    for name, size in FAVICON_ICONS.items():
        path = os.path.join(icons_dir, name)
        generate_icon(src, size, path)
        print(f"   ✓ {name} ({size}x{size})")
        count += 1

    if not args.no_favicon:
        ico_path = os.path.join(icons_dir, "favicon.ico")
        generate_favicon_ico(src, ico_path)
        print(f"   ✓ favicon.ico (16+32+48)")
        count += 1

    # ── Maskable Icon ──
    print(f"\n🎭 Maskable Icon:")
    maskable_path = os.path.join(icons_dir, "maskable-icon-512x512.png")
    generate_maskable(src, maskable_path, bg_color)
    print(f"   ✓ maskable-icon-512x512.png (with safe zone)")
    count += 1

    # ── Splash Screens ──
    if not args.no_splash:
        os.makedirs(splash_dir, exist_ok=True)
        print(f"\n📱 Splash Screens:")
        for name, (w, h) in SPLASH_SCREENS.items():
            path = os.path.join(splash_dir, name)
            generate_splash(src, path, w, h, splash_bg)
            print(f"   ✓ {name} ({w}x{h})")
            count += 1

    # ── Summary ──
    print(f"\n{'═' * 45}")
    print(f"✅ Done! Generated {count} files")
    print(f"📁 Output: {os.path.abspath(args.out)}/")
    print(f"{'═' * 45}\n")


if __name__ == "__main__":
    main()