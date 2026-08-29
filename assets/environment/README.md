# Shadow Puzzle environment assets

These 128 × 128 RGBA assets are the generated environment pack used directly by
`game-v34.js`. The original palette and material rendering are preserved. Only
transparent edge normalization was applied so repeated tiles connect cleanly.

## Runtime mapping

- Open floor: deterministic mix of `floor_01.png` through `floor_04.png`
- Outer edges: `wall_top.png`, `wall_bottom.png`, `wall_left.png`, `wall_right.png`
- Outer corners: the four `wall_corner_*.png` assets
- Interior walls: `inner_wall_vertical.png` or `inner_wall_horizontal.png`, chosen from neighboring wall connectivity
- Boundary/interior joins: `inner_join_top.png` and `inner_join_bottom.png`
- Goal: `goal_shuriken.png`

Map rules, collision coordinates, stage data, and character rendering are not
derived from these images and remain unchanged.
