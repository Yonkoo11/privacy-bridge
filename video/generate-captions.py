#!/usr/bin/env python3
"""Composite subtitle text onto frames for Privacy Bridge demo."""

from PIL import Image, ImageDraw, ImageFont
import os, textwrap

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRAMES_DIR = os.path.join(SCRIPT_DIR, 'frames')
COMPOSITES_DIR = os.path.join(SCRIPT_DIR, 'composites')
os.makedirs(COMPOSITES_DIR, exist_ok=True)

# Must match audio verbatim
CLIPS = {
    "01-landing": "This is Privacy Bridge. You deposit tokens on any of six EVM chains. You withdraw on Starknet. There is no on-chain link between the two transactions. The chain map at the top shows all six source networks pointing to a single Starknet destination.",
    "02-deposit": "On the deposit side, you pick a fixed denomination and lock tokens into the bridge contract. The pool size counter reads from the chain in real time so you can see how many other deposits are in the set. More deposits means better privacy.",
    "03-note": "After locking, you get a secret note. This note is the only way to withdraw later. You have to check the backup confirmation before the app lets you proceed. Lose the note, lose the funds. That is by design.",
    "04-withdraw": "Withdrawal is one click. You paste the note, enter a Starknet address, and hit Declassify. The app builds a Groth16 proof, fetches the garaga calldata, and relays to Starknet automatically. Each step shows elapsed time so you know what is happening.",
    "05-dashboard": "The dashboard pulls deposit counts and the latest Merkle root directly from the bridge contract on whichever chain you are connected to. Five chains are live right now with identical contracts deployed on each one.",
    "06-close": "Six source chains. One Starknet destination. Zero link between deposit and withdrawal. That is Privacy Bridge.",
}

def get_font(size):
    candidates = [
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
        '/Library/Fonts/Arial.ttf',
    ]
    for f in candidates:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except:
                continue
    return ImageFont.load_default()

font = get_font(32)

for clip, text in CLIPS.items():
    frame_path = os.path.join(FRAMES_DIR, f'{clip}.png')
    if not os.path.exists(frame_path):
        print(f'SKIP {clip} (no frame)')
        continue

    img = Image.open(frame_path).convert('RGBA')
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    wrapped = textwrap.fill(text, width=70)
    lines = wrapped.split('\n')

    line_height = 42
    padding = 20
    margin_x = 160
    box_h = len(lines) * line_height + padding * 2
    box_y = img.height - box_h - 60
    box_w = img.width - margin_x * 2

    draw.rounded_rectangle(
        [(margin_x, box_y), (margin_x + box_w, box_y + box_h)],
        radius=12,
        fill=(0, 0, 0, 120)
    )

    y = box_y + padding
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        x = margin_x + (box_w - tw) // 2
        draw.text((x, y), line, fill=(255, 255, 255, 240), font=font)
        y += line_height

    result = Image.alpha_composite(img, overlay)
    result = result.convert('RGB')
    result.save(os.path.join(COMPOSITES_DIR, f'{clip}.png'))
    print(f'OK {clip}')

print('All composites generated')
