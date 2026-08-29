#!/usr/bin/env python3
"""Build an 8-frame, four-direction fixed-canvas sprite sheet."""

from collections import deque
from pathlib import Path
import sys

from PIL import Image


CELL = 96
COLS = 4
ROWS = 2


def remove_edge_background(image):
    image = image.convert("RGBA")
    if image.getchannel("A").getextrema()[0] < 255:
        return image

    pixels = image.load()
    width, height = image.size
    background = set()
    queue = deque()

    def is_background(x, y):
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= 225 and max(r, g, b) - min(r, g, b) <= 18

    for x in range(width):
        for y in (0, height - 1):
            if is_background(x, y):
                queue.append((x, y))
                background.add((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if is_background(x, y) and (x, y) not in background:
                queue.append((x, y))
                background.add((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in background and is_background(nx, ny):
                background.add((nx, ny))
                queue.append((nx, ny))

    alpha = image.getchannel("A")
    alpha_pixels = alpha.load()
    for x, y in background:
        alpha_pixels[x, y] = 0
    image.putalpha(alpha)
    return image


def split_fixed(source):
    source = remove_edge_background(source)
    width, height = source.size
    frames = []
    for row in range(ROWS):
        for column in range(COLS):
            box = (
                round(column * width / COLS),
                round(row * height / ROWS),
                round((column + 1) * width / COLS),
                round((row + 1) * height / ROWS),
            )
            frames.append(source.crop(box).resize((CELL, CELL), Image.Resampling.LANCZOS))
    return frames


def main(side_path, front_path, back_path, output_path):
    right = split_fixed(Image.open(side_path))
    down = split_fixed(Image.open(front_path))
    up = split_fixed(Image.open(back_path))
    left = [frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for frame in right]
    rows = [down, left, right, up]

    sheet = Image.new("RGBA", (CELL * 8, CELL * 4))
    for row, frames in enumerate(rows):
        for column, frame in enumerate(frames):
            sheet.alpha_composite(frame, (column * CELL, row * CELL))
    sheet.save(output_path)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
