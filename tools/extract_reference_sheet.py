#!/usr/bin/env python3
"""Extract the 4-direction, 8-frame character grid from the annotated reference sheet."""

from collections import deque
from pathlib import Path
import math
import sys

from PIL import Image, ImageFilter, ImageStat


CENTERS_X = (157, 259, 361, 464, 568, 674, 779, 882)
ROW_TOPS = (205, 397, 582, 773)
SOURCE_CELL = 112
TARGET_CELL = 32


def foreground_from_dark_panel(cell):
    cell = cell.convert("RGBA")
    rgb = cell.convert("RGB")
    border = Image.new("RGB", (cell.width * 2 + cell.height * 2 - 4, 1))
    samples = (
        [rgb.getpixel((x, 0)) for x in range(cell.width)]
        + [rgb.getpixel((x, cell.height - 1)) for x in range(cell.width)]
        + [rgb.getpixel((0, y)) for y in range(1, cell.height - 1)]
        + [rgb.getpixel((cell.width - 1, y)) for y in range(1, cell.height - 1)]
    )
    for index, color in enumerate(samples):
        border.putpixel((index, 0), color)
    background = tuple(round(value) for value in ImageStat.Stat(border).median)

    seed = Image.new("L", cell.size)
    seed_pixels = seed.load()
    pixels = rgb.load()
    for y in range(cell.height):
        for x in range(cell.width):
            color = pixels[x, y]
            distance = math.sqrt(sum((color[i] - background[i]) ** 2 for i in range(3)))
            if distance >= 23:
                seed_pixels[x, y] = 255

    source = seed.load()
    seen = set()
    largest = []
    for y in range(cell.height):
        for x in range(cell.width):
            if source[x, y] == 0 or (x, y) in seen:
                continue
            component = []
            queue = deque([(x, y)])
            seen.add((x, y))
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < cell.width and 0 <= ny < cell.height and source[nx, ny] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component

    keep = Image.new("L", cell.size)
    keep_pixels = keep.load()
    for x, y in largest:
        keep_pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(9))

    alpha = Image.new("L", cell.size)
    alpha_pixels = alpha.load()
    keep_pixels = keep.load()
    for y in range(cell.height):
        for x in range(cell.width):
            if not keep_pixels[x, y]:
                continue
            color = pixels[x, y]
            distance = math.sqrt(sum((color[i] - background[i]) ** 2 for i in range(3)))
            alpha_pixels[x, y] = max(0, min(255, round((distance - 2) * 18)))
    cell.putalpha(alpha)
    return cell


def main(source_path, output_path):
    source = Image.open(source_path)
    sheet = Image.new("RGBA", (TARGET_CELL * 8, TARGET_CELL * 4))
    # Source: down, up, left, right. Engine: down, left, right, up.
    for row, source_row in enumerate((0, 2, 3, 1)):
        top = ROW_TOPS[source_row]
        for column, center_x in enumerate(CENTERS_X):
            box = (center_x - SOURCE_CELL // 2, top, center_x + SOURCE_CELL // 2, top + SOURCE_CELL)
            frame = foreground_from_dark_panel(source.crop(box))
            frame = frame.resize((TARGET_CELL, TARGET_CELL), Image.Resampling.LANCZOS)
            sheet.alpha_composite(frame, (column * TARGET_CELL, row * TARGET_CELL))
    sheet.save(output_path)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
