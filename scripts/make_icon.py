#!/usr/bin/env python3
"""
Generate TaskFlow app icon:
- Orange rounded-rect background
- White checkmark + flow dots design
Outputs: electron/icon.icns + electron/tray.png
"""

import math
import os
import struct
import zlib
from PIL import Image, ImageDraw, ImageFont

def make_app_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size
    pad = s * 0.08
    r = s * 0.22  # corner radius

    # ── 背景：橙色渐变（用多层叠加模拟） ──────────────────────────────
    def rounded_rect_mask(sz, radius):
        mask = Image.new("L", (sz, sz), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, sz - 1, sz - 1], radius=radius, fill=255)
        return mask

    # 画渐变背景（从橙红到橙黄）
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for i in range(s):
        t = i / s
        # top: #FF6B2B  bottom: #FF9D5C
        cr = int(255 * (1 - t) + 255 * t)
        cg = int(107 * (1 - t) + 157 * t)
        cb = int(43 * (1 - t) + 92 * t)
        bg_draw.line([(0, i), (s, i)], fill=(cr, cg, cb, 255))

    mask = rounded_rect_mask(s, int(r))
    img.paste(bg, (0, 0), mask)

    # ── 内部装饰：细微的高光 ──────────────────────────────────────────
    highlight = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse([s * 0.1, -s * 0.3, s * 0.9, s * 0.5], fill=(255, 255, 255, 20))
    img = Image.alpha_composite(img, highlight)
    draw = ImageDraw.Draw(img)

    # ── 主图形：圆角任务框 + 勾 ──────────────────────────────────────
    lw = max(2, s // 40)
    box_pad = s * 0.22
    box_r = s * 0.07

    # 任务卡片背景（白色半透明）
    card_x0, card_y0 = box_pad, box_pad
    card_x1, card_y1 = s - box_pad, s - box_pad
    # 白色卡片
    card = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle(
        [card_x0, card_y0, card_x1, card_y1],
        radius=int(box_r),
        fill=(255, 255, 255, 230)
    )
    img = Image.alpha_composite(img, card)
    draw = ImageDraw.Draw(img)

    # ── 三条任务线 ────────────────────────────────────────────────────
    line_lw = max(1, s // 52)
    line_color = (220, 130, 60, 200)  # 橙色线条

    lines_x0 = card_x0 + s * 0.18
    lines_x1 = card_x1 - s * 0.10
    row_y = [
        card_y0 + (card_y1 - card_y0) * 0.28,
        card_y0 + (card_y1 - card_y0) * 0.50,
        card_y0 + (card_y1 - card_y0) * 0.72,
    ]

    for i, y in enumerate(row_y):
        y = int(y)
        x0 = int(lines_x0)
        x1 = int(lines_x1 * (0.9 - i * 0.12))
        draw.rounded_rectangle(
            [x0, y - line_lw, x1, y + line_lw],
            radius=line_lw,
            fill=line_color
        )

    # ── 左侧大勾（主视觉） ────────────────────────────────────────────
    ck_size = (card_x1 - card_x0) * 0.28
    ck_cx = card_x0 + s * 0.10
    ck_cy = card_y0 + (card_y1 - card_y0) * 0.50
    ck_lw = max(2, int(s / 22))
    ck_color = (255, 120, 30, 255)

    # 勾的三个点
    p1 = (ck_cx - ck_size * 0.35, ck_cy)
    p2 = (ck_cx - ck_size * 0.05, ck_cy + ck_size * 0.30)
    p3 = (ck_cx + ck_size * 0.38, ck_cy - ck_size * 0.38)

    draw.line([p1, p2, p3], fill=ck_color, width=ck_lw, joint="curve")

    return img


def make_tray_icon(size=22):
    """macOS 菜单栏模板图标（黑色，透明背景）"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size
    lw = max(1, s // 12)

    # 简单的 checkmark + lines 图案（模板图标用黑色）
    col = (0, 0, 0, 255)

    # 左侧勾
    p1 = (int(s * 0.12), int(s * 0.50))
    p2 = (int(s * 0.28), int(s * 0.68))
    p3 = (int(s * 0.48), int(s * 0.28))
    draw.line([p1, p2, p3], fill=col, width=lw)

    # 右侧三条线
    for i, (y_frac, x1_frac) in enumerate([(0.28, 0.95), (0.50, 0.85), (0.72, 0.75)]):
        y = int(s * y_frac)
        draw.line([(int(s * 0.56), y), (int(s * x1_frac), y)], fill=col, width=lw)

    return img


def save_icns(app_icon_1024, out_path):
    """Build .icns from a 1024×1024 RGBA image using macOS iconutil."""
    import subprocess, tempfile, shutil

    iconset_dir = out_path.replace(".icns", ".iconset")
    os.makedirs(iconset_dir, exist_ok=True)

    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for sz in sizes:
        resized = app_icon_1024.resize((sz, sz), Image.LANCZOS)
        resized.save(os.path.join(iconset_dir, f"icon_{sz}x{sz}.png"))
        if sz <= 512:
            resized2 = app_icon_1024.resize((sz * 2, sz * 2), Image.LANCZOS)
            resized2.save(os.path.join(iconset_dir, f"icon_{sz}x{sz}@2x.png"))

    subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", out_path], check=True)
    shutil.rmtree(iconset_dir)
    print(f"✓ {out_path}")


if __name__ == "__main__":
    base = os.path.join(os.path.dirname(__file__), "..", "electron")
    os.makedirs(base, exist_ok=True)

    # App icon (1024×1024)
    icon = make_app_icon(1024)
    icon_png = os.path.join(base, "icon.png")
    icon.save(icon_png)
    save_icns(icon, os.path.join(base, "icon.icns"))

    # Tray icon (22×22, @2x = 44)
    tray = make_tray_icon(44)
    tray.save(os.path.join(base, "tray.png"))
    print(f"✓ {os.path.join(base, 'tray.png')}")
