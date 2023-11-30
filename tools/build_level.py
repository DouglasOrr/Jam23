"""build a level JSON from a PNG design"""

import argparse
import datetime
import json
import sys
from pathlib import Path
from typing import Iterable, Tuple

import imageio.v3
import numpy as np

TERRAIN = "000000"
TURRETS = {"ff0000": 0, "ff4000": 1, "ff8000": 2, "ffa000": 3}
FACTORY = "0000ff"


def build(data: np.ndarray) -> str:
    hspace = int(data[0, 0, 2])
    vspace = int(data[0, 1, 2])
    allies = int(data[0, 2, 2])
    data[0, :3] = 255

    def get_mask(color: str) -> np.ndarray:
        assert len(color) == 6
        color_data = [int(color[i : i + 2], 16) for i in range(0, 6, 2)]
        return (data == color_data).all(-1)

    def get_coordinates(color: str) -> Iterable[Tuple[int, int]]:
        for y, x in np.stack(np.where(get_mask(color)), -1):
            yield [hspace * int(x), vspace * int(data.shape[0] / 2 - y - 1)]

    height = vspace * (get_mask(TERRAIN).sum(0) - data.shape[0] / 2)
    turrets = [
        dict(position=position, level=level)
        for color, level in TURRETS.items()
        for position in get_coordinates(color)
    ]
    factories = list(get_coordinates(FACTORY))

    return json.dumps(
        dict(
            spacing=hspace,
            height=height.tolist(),
            turrets=turrets,
            factories=factories,
            allies=allies,
        ),
        sort_keys=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("src", type=Path)
    parser.add_argument("dest", type=Path)
    args = parser.parse_args()
    print(
        f"[{datetime.datetime.now().time().isoformat(timespec='seconds')}]"
        f" Build {args.src} -> {args.dest}",
        file=sys.stderr,
    )
    if args.dest.exists():
        args.dest.unlink()
    args.dest.write_text(build(imageio.v3.imread(args.src)))
