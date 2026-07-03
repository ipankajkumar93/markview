#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow"]
# ///

import sys
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

project_root = Path(__file__).parent.parent

# Configuration for Markview
CONFIG = {
    "author": "Pankaj Kumar",
    "site": "pankajkumar.xyz",
    "width": 1200,
    "height": 630,
    "padding": 50,
    "bg_color": (25, 35, 90),       # Extra Punchy Indigo Blue
    "glow_color_1": (40, 112, 194), # Cobalt Blue
    "glow_color_2": (20, 60, 110),  # Deep Blue
    "card_bg": (15, 15, 18, 255),   # Solid dark box
    "title_color": (250, 250, 250), # Crisp White
    "desc_color": (161, 161, 170),  # Zinc 400
    "author_color": (228, 228, 231), # Zinc 200
    "domain_color": (161, 161, 170), # Zinc 400
    "url_color": (90, 159, 222),     # Website Blue Accent (#5A9FDE)
}

def load_fonts():
    fonts = {}
    bold_font = project_root / "bin" / "fonts" / "Roboto-Bold.ttf"
    regular_font = project_root / "bin" / "fonts" / "Roboto-Regular.ttf"
    
    if bold_font.exists() and regular_font.exists():
        fonts["title_large"] = ImageFont.truetype(str(bold_font), 68)
        fonts["title_medium"] = ImageFont.truetype(str(bold_font), 58)
        fonts["title_small"] = ImageFont.truetype(str(bold_font), 48)
        fonts["desc"] = ImageFont.truetype(str(regular_font), 36)
        fonts["author"] = ImageFont.truetype(str(bold_font), 28)
        fonts["domain"] = ImageFont.truetype(str(regular_font), 24)
        fonts["url"] = ImageFont.truetype(str(bold_font), 34)
    else:
        print("Warning: Custom fonts not found, using defaults")
        fonts = {k: ImageFont.load_default() for k in ["title_large", "title_medium", "title_small", "desc", "author", "domain", "url"]}
        
    return fonts

def wrap_text(text: str, font, max_width: int) -> list[str]:
    if not text:
        return []
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)
    words = text.split()
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        width = bbox[2] - bbox[0]
        if width <= max_width or not current_line:
            current_line.append(word)
        else:
            lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def get_title_font(title: str, fonts):
    if len(title) <= 35:
        return fonts["title_large"]
    elif len(title) <= 60:
        return fonts["title_medium"]
    else:
        return fonts["title_small"]

def text_height(text: str, font) -> int:
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[3] - bbox[1]

def create_glow_background():
    base = Image.new("RGBA", (CONFIG["width"], CONFIG["height"]), CONFIG["bg_color"] + (255,))
    glow = Image.new("RGBA", (CONFIG["width"], CONFIG["height"]), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    
    glow_draw.ellipse([-CONFIG["width"]*0.2, -CONFIG["height"]*0.5, CONFIG["width"]*0.6, CONFIG["height"]*1.2], fill=CONFIG["glow_color_1"] + (45,))
    glow_draw.ellipse([CONFIG["width"]*0.4, -CONFIG["height"]*0.2, CONFIG["width"]*1.2, CONFIG["height"]*1.5], fill=CONFIG["glow_color_2"] + (40,))
    
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    base = Image.alpha_composite(base, glow)
    return base

def get_circle_avatar(size: int) -> Image.Image | None:
    avatar_path = project_root / "static" / "images" / "profile.jpg"
    if not avatar_path.exists():
        return None
        
    try:
        img = Image.open(avatar_path).convert("RGBA")
        min_dim = min(img.size)
        left = (img.width - min_dim) / 2
        top = (img.height - min_dim) / 2
        img = img.crop((left, top, left + min_dim, top + min_dim))
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        
        aa_scale = 4
        mask_size = size * aa_scale
        mask = Image.new('L', (mask_size, mask_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, mask_size, mask_size), fill=255)
        mask = mask.resize((size, size), Image.Resampling.LANCZOS)
        
        output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        output.paste(img, (0, 0), mask)
        return output
    except Exception:
        return None

def generate_image(title: str, description: str, out_path: Path, fonts):
    img = create_glow_background()
    
    pad = CONFIG["padding"]
    width = CONFIG["width"]
    height = CONFIG["height"]
    
    card_w = width - 2 * pad
    card_h = height - 2 * pad
    
    card_img = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card_img)
    card_draw.rounded_rectangle([0, 0, card_w, card_h], radius=24, fill=CONFIG["card_bg"])
    
    gradient = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(gradient)
    grad_draw.ellipse([-card_w * 0.2, card_h * 0.5, card_w * 1.2, card_h * 1.5], fill=(0, 0, 0, 150))
    gradient = gradient.filter(ImageFilter.GaussianBlur(80))
    
    card_img = Image.alpha_composite(card_img, gradient)
    
    mask = Image.new("L", (card_w, card_h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, card_w, card_h], radius=24, fill=255)
    
    final_card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    final_card.paste(card_img, (0, 0), mask=mask)
    
    card_glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(card_glow)
    glow_draw.rounded_rectangle([pad, pad, pad + card_w, pad + card_h], radius=24, outline=CONFIG["glow_color_1"] + (255,), width=24)
    card_glow = card_glow.filter(ImageFilter.GaussianBlur(24))
    
    img = Image.alpha_composite(img, card_glow)
    draw = ImageDraw.Draw(img, "RGBA")
    
    img.paste(final_card, (pad, pad), final_card)

    y = pad + 48
    x = pad + 64
    
    avatar_size = 96
    avatar = get_circle_avatar(avatar_size)
    
    if avatar:
        img.paste(avatar, (int(x), int(y + 6)), avatar)
        text_x = x + avatar_size + 24
        author_y = y + 16
        domain_y = author_y + 36
        draw.text((text_x, author_y), CONFIG["author"], fill=CONFIG["author_color"], font=fonts["author"])
        draw.text((text_x, domain_y), CONFIG["site"], fill=CONFIG["domain_color"], font=fonts["domain"])
        y += avatar_size + 48
    else:
        draw.text((x, y), CONFIG["author"], fill=CONFIG["author_color"], font=fonts["author"])
        y += 50

    title_font = get_title_font(title, fonts)
    title_lines = wrap_text(title, title_font, width - (2 * pad) - 128)

    for line in title_lines[:3]:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_x = (width - (bbox[2] - bbox[0])) / 2
        draw.text((line_x, y), line, fill=CONFIG["title_color"], font=title_font)
        y += text_height(line, title_font) + 12

    y += 48

    if description:
        desc_font = fonts["desc"]
        desc_lines = wrap_text(description, desc_font, width - (2 * pad) - 128)

        for line in desc_lines[:3]:
            bbox = draw.textbbox((0, 0), line, font=desc_font)
            line_x = (width - (bbox[2] - bbox[0])) / 2
            draw.text((line_x, y), line, fill=CONFIG["desc_color"], font=desc_font)
            y += text_height(line, desc_font) + 10

    y += 16
    project_url = "markview.pankajkumar.xyz"
    bbox = draw.textbbox((0, 0), project_url, font=fonts["url"])
    line_x = (width - (bbox[2] - bbox[0])) / 2
    draw.text((line_x, y), project_url, fill=CONFIG["url_color"], font=fonts["url"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)

def main():
    fonts = load_fonts()
    title = "Markview"
    description = "A beautiful, responsive and fast Markdown viewer."
    
    index_html_path = project_root / "templates" / "index.html"
    if index_html_path.exists():
        content = index_html_path.read_text()
        match = re.search(r'<meta\s+name="description"\s+content="([^"]+)">', content)
        if match:
            description = match.group(1)

    out_path = project_root / "static" / "images" / "og-image.png"
    
    print(f"Using description: {description}")
    generate_image(title, description, out_path, fonts)
    print(f"Generated {out_path.relative_to(project_root)}")

if __name__ == "__main__":
    main()
