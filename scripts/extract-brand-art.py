"""Cut Owiwi artwork out of the brand sheet. Usage: extract.py <sheet.png> <out_dir> <preview_dir>"""
import sys, os
import numpy as np
from PIL import Image

sheet = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
out, prev = sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True); os.makedirs(prev, exist_ok=True)

def flood_bg(rgb, bg_colors, tol):
    """Mask of background pixels connected to the crop border (close to any bg color)."""
    d = np.min([np.abs(rgb - np.array(c, np.float32)).sum(axis=2) for c in bg_colors], axis=0)
    cand = d < tol
    mask = np.zeros_like(cand)
    mask[0, :] = cand[0, :]; mask[-1, :] = cand[-1, :]; mask[:, 0] = cand[:, 0]; mask[:, -1] = cand[:, -1]
    while True:
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]; grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]; grown[:, :-1] |= mask[:, 1:]
        grown &= cand
        if (grown == mask).all(): return mask, d
        mask = grown

def cutout(rgb, bg_colors, tol=60, soft=90):
    bgmask, d = flood_bg(rgb, bg_colors, tol)
    alpha = np.where(bgmask, 0.0, 1.0)
    # Soft edge: foreground pixels touching the background get alpha by color distance,
    # and their color is un-mixed from the background to avoid a pastel halo.
    near = np.zeros_like(bgmask)
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
        near |= np.roll(np.roll(bgmask, dy, 0), dx, 1)
    edge = near & ~bgmask
    a_edge = np.clip(d / soft, 0, 1)
    alpha = np.where(edge, np.minimum(alpha, a_edge), alpha)
    bg = np.array(bg_colors[0], np.float32)
    a3 = np.clip(alpha, 1e-3, 1)[..., None]
    col = np.clip((rgb - (1 - a3) * bg) / a3, 0, 255)
    rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

def keep_center_component(img):
    # Drop everything not connected to the image center (e.g. leftover corner slivers).
    a = np.asarray(img).copy()
    solid = a[..., 3] > 8
    mask = np.zeros_like(solid); cy, cx = solid.shape[0] // 2, solid.shape[1] // 2
    mask[cy, cx] = solid[cy, cx]
    while True:
        g = mask.copy()
        g[1:, :] |= mask[:-1, :]; g[:-1, :] |= mask[1:, :]; g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
        g &= solid
        if (g == mask).all(): break
        mask = g
    a[..., 3] = np.where(mask, a[..., 3], 0)
    return Image.fromarray(a, 'RGBA')

def trim_square(img, pad_frac=0.06):
    bbox = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bbox)
    side = int(max(img.size) * (1 + 2 * pad_frac))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(img, ((side - img.width) // 2, side - img.height - int(side * pad_frac * 0.5)), img)
    return sq

def save_scales(img, name, base):
    for scale, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
        img.resize((base * scale, base * scale), Image.LANCZOS).save(os.path.join(out, f'{name}{suffix}.png'), optimize=True)

# Panels: (state, x0, x1, y0, y1) owl area above the label text.
COLS = [(15, 437), (445, 865), (879, 1299)]
ROWS = [(318, 603), (746, 1020)]
STATES = [['idle', 'happy', 'thinking'], ['celebrate', 'sad', 'sleepy']]
sheets = []
for r, (y0, y1) in enumerate(ROWS):
    for c, (x0, x1) in enumerate(COLS):
        name = STATES[r][c]
        crop = sheet[y0:y1, x0 + 10:x1 - 10]
        bg = crop[4, 4]
        img = trim_square(cutout(crop, [bg], tol=110, soft=130))
        save_scales(img, name, 160)
        sheets.append((name, img))
        print(name, 'source px', img.size)

# Preview contact sheet on the app background and on white, for review.
cell = 260
pv = Image.new('RGB', (cell * 6, cell * 2), (247, 245, 240))
for i, (name, img) in enumerate(sheets):
    t = img.resize((cell - 20, cell - 20), Image.LANCZOS)
    pv.paste(t, (i * cell + 10, 10), t)
    dark = Image.new('RGB', (cell, cell), (30, 35, 66)); dark.paste(t, (10, 10), t)
    pv.paste(dark, (i * cell, cell))
pv.save(os.path.join(prev, 'states.png'))

# App icon: navy rounded square at top-left of the sheet.
NAVY = (34, 43, 77)
icrop = sheet[42:263, 124:351]  # inside the rounded square, navy only
owl = trim_square(keep_center_component(cutout(icrop, [NAVY, (248, 247, 243)], tol=70, soft=80)), pad_frac=0.0)
def compose(size, owl_frac, bg):
    canvas = Image.new('RGBA', (size, size), bg)
    o = owl.resize((int(size * owl_frac),) * 2, Image.LANCZOS)
    canvas.paste(o, ((size - o.width) // 2, (size - o.height) // 2 + int(size * 0.03)), o)
    return canvas
compose(1024, 0.86, NAVY + (255,)).convert('RGB').save(os.path.join(out, 'icon.png'))
compose(1024, 0.62, (0, 0, 0, 0)).save(os.path.join(out, 'android-icon-foreground.png'))
Image.new('RGB', (1024, 1024), NAVY).save(os.path.join(out, 'android-icon-background.png'))
fg = compose(1024, 0.62, (0, 0, 0, 0))
def silhouette(img):
    # Opaque, non-light pixels become white; eye whites and paper turn transparent.
    h = np.asarray(img).astype(np.float32)
    solid = (h[..., 3] > 128) & (h[..., :3].mean(axis=2) < 200)
    sil = np.zeros(h.shape, np.uint8); sil[..., :3] = 255; sil[..., 3] = np.where(solid, 255, 0)
    return Image.fromarray(sil, 'RGBA')
silhouette(fg).save(os.path.join(out, 'android-icon-monochrome.png'))
compose(1024, 0.9, (0, 0, 0, 0)).save(os.path.join(out, 'splash-icon.png'))
compose(256, 0.86, NAVY + (255,)).convert('RGB').save(os.path.join(out, 'favicon.png'))
print('icon owl px', owl.size)

# Notification head: the Idle owl's head (largest, front-facing, symmetric, nothing
# overlapping it, unlike the book in the app-icon mark). The owl has no neck, so the
# head is everything above the eye line plus a rounded jaw (half ellipse) that ends
# just under the face disc's V. Coordinates are in the Idle panel crop.
HEAD_EYE_Y, HEAD_CHIN_Y = 130, 190
icrop_idle = sheet[ROWS[0][0]:ROWS[0][1], COLS[0][0] + 10:COLS[0][1] - 10]
idle_full = np.asarray(cutout(icrop_idle, [icrop_idle[4, 4]], tol=110, soft=130)).astype(np.float32)
xs = np.where(idle_full[HEAD_EYE_Y, :, 3] > 128)[0]
hcx, hrx = (xs.min() + xs.max()) / 2, (xs.max() - xs.min()) / 2
yy, xx = np.mgrid[:idle_full.shape[0], :idle_full.shape[1]]
ell = ((xx - hcx) / hrx) ** 2 + ((yy - HEAD_EYE_Y) / (HEAD_CHIN_Y - HEAD_EYE_Y)) ** 2
idle_full[..., 3] *= np.where(yy < HEAD_EYE_Y, 1.0, np.clip((1 - ell) * hrx / 1.5, 0, 1))  # 1.5px soft jaw
head = Image.fromarray(idle_full.astype(np.uint8), 'RGBA')
head = head.crop(head.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())

# Android large icon (expo-notifications `largeIcon`): the full-colour head, transparent.
# The plugin resizes it to 64dp per density, so 256px covers xxxhdpi.
trim_square(head, pad_frac=0.02).resize((256, 256), Image.LANCZOS).save(os.path.join(out, 'notification-head.png'), optimize=True)

# Android small icon: Android uses only the alpha channel, so white-on-transparent.
# The cream face disc is cut out; pupils and beak stay white, so the owl face still
# reads at 24dp. Edges keep their antialiased alpha; colour is pure white.
h = np.asarray(head).astype(np.float32)
cream = h[..., :3].mean(axis=2) > 200
sil = np.zeros(h.shape, np.uint8); sil[..., :3] = 255
sil[..., 3] = np.clip(h[..., 3] * ~cream, 0, 255).astype(np.uint8)
head_img = trim_square(Image.fromarray(sil, 'RGBA'), pad_frac=0.02)
n = np.asarray(head_img.resize((96, 96), Image.LANCZOS)).copy()
n[..., :3] = 255  # resampling darkens faint edge pixels; the mask must be pure white
n = Image.fromarray(n, 'RGBA')
n.save(os.path.join(out, 'notification-icon.png'), optimize=True)

# Preview: small icon on indigo and dark (x3, nearest), at status-bar size, and the large icon.
p = Image.new('RGB', (288 * 4, 288), (30, 30, 30))
big = n.resize((288, 288), Image.NEAREST)
p.paste(Image.new('RGB', (288, 288), (91, 91, 214)), (0, 0)); p.paste(big, (0, 0), big); p.paste(big, (288, 0), big)
s48 = n.resize((48, 48), Image.LANCZOS); p.paste(s48, (288 * 2 + 120, 120), s48)
lg = Image.open(os.path.join(out, 'notification-head.png')).resize((256, 256)); p.paste(lg, (288 * 3 + 16, 16), lg)
p.save(os.path.join(prev, 'notification.png'))
icons = Image.new('RGB', (1024 * 3, 1024), (247, 245, 240))
icons.paste(Image.open(os.path.join(out, 'icon.png')), (0, 0))
icons.paste(Image.open(os.path.join(out, 'android-icon-background.png')), (1024, 0))
f = Image.open(os.path.join(out, 'android-icon-foreground.png')); icons.paste(f, (1024, 0), f)
m = Image.open(os.path.join(out, 'android-icon-monochrome.png')); g = Image.new('RGB', (1024, 1024), (60, 60, 60)); g.paste(m, (0, 0), m); icons.paste(g, (2048, 0))
icons.resize((900, 300)).save(os.path.join(prev, 'icons.png'))
