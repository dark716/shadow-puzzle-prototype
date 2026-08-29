#!/usr/bin/env python3
"""Build a fixed-canvas four-direction sprite sheet without per-frame transforms."""

from collections import deque
from pathlib import Path
import sys

from PIL import Image, ImageFilter


CELL = 96


def isolate_figure(cell):
    alpha = cell.getchannel("A")
    source = alpha.load()
    width, height = cell.size
    seen = set()
    largest = []
    for y in range(height):
        for x in range(width):
            if (x, y) in seen or source[x, y] < 48:
                continue
            component = []
            queue = deque([(x, y)])
            seen.add((x, y))
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen and source[nx, ny] >= 48:
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component

    keep = Image.new("L", cell.size)
    pixels = keep.load()
    for x, y in largest:
        pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(7))
    cleaned = cell.copy()
    cleaned.putalpha(Image.composite(alpha, Image.new("L", cell.size), keep))
    return cleaned


def split(source, columns=4, rows=2):
    width, height = source.size
    figures = []
    for row in range(rows):
        current = []
        for column in range(columns):
            box = (
                round(column * width / columns),
                round(row * height / rows),
                round((column + 1) * width / columns),
                round((row + 1) * height / rows),
            )
            current.append(isolate_figure(source.crop(box)))
        figures.append(current)
    return figures


def resize_fixed(figures):
    return [
        [figure.resize((CELL, CELL), Image.Resampling.LANCZOS) for figure in row]
        for row in figures
    ]


def main(side_path, directions_path, output_path):
    side = split(Image.open(side_path).convert("RGBA"))
    directions = split(Image.open(directions_path).convert("RGBA"))
    rows = [
        directions[0],
        [frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for frame in side[0]],
        side[0],
        directions[1],
    ]
    rows = resize_fixed(rows)
    sheet = Image.new("RGBA", (CELL * 4, CELL * 4))
    for row, frames in enumerate(rows):
        for column, frame in enumerate(frames):
            sheet.alpha_composite(frame, (column * CELL, row * CELL))
    sheet.save(output_path)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
