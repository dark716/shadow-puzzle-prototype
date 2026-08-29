#!/usr/bin/env python3
"""Extract a transparent 8-frame side walk cycle from the supplied green-screen video."""

from pathlib import Path
import sys

from PIL import Image


FRAME_SIZE = 48
SOURCE_BOX = (40, 15, 365, 390)
SOURCE_FRAMES = (1, 3, 5, 7, 9, 11, 13, 14)


def remove_green(image):
    image = image.convert("RGBA")
    output = Image.new("RGBA", image.size)
    source = image.load()
    target = output.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = source[x, y]
            dominance = g - max(r, b)
            if g > 80 and dominance > 22:
                alpha = max(0, min(255, 255 - (dominance - 22) * 7))
                g = min(g, int(max(r, b) * 1.08))
            else:
                alpha = 255
            target[x, y] = (r, g, b, alpha)
    return output


def main(video_frames_dir, output_path):
    frames = []
    for number in SOURCE_FRAMES:
        source = Image.open(video_frames_dir / f"{number:03d}.png").crop(SOURCE_BOX)
        keyed = remove_green(source)
        bbox = keyed.getchannel("A").getbbox()
        frames.append(keyed.crop(bbox))

    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    scale = min(44 / max_width, 46 / max_height)

    right = []
    for frame in frames:
        resized = frame.resize(
            (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
            Image.Resampling.LANCZOS,
        )
        cell = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
        x = (FRAME_SIZE - resized.width) // 2
        y = FRAME_SIZE - resized.height
        cell.alpha_composite(resized, (x, y))
        right.append(cell)

    sheet = Image.new("RGBA", (FRAME_SIZE * len(right), FRAME_SIZE * 2))
    for index, frame in enumerate(right):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
        sheet.alpha_composite(frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (index * FRAME_SIZE, FRAME_SIZE))
    sheet.save(output_path)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
