import subprocess
import sys
from pathlib import Path

import inotify.adapters

SRC_ROOT = "assets/src/levels"
DEST_ROOT = "assets/dist/levels"


def build(src: Path) -> None:
    try:
        dest = DEST_ROOT / src.relative_to(SRC_ROOT).with_suffix(".json")
        subprocess.check_call(
            ["python", Path(__file__).parent / "build_level.py", str(src), str(dest)]
        )
    except subprocess.CalledProcessError as e:
        print(e, file=sys.stderr)


for f in Path(SRC_ROOT).glob("**/*.png"):
    build(f)

print("Watching for changes", file=sys.stderr)

for event in inotify.adapters.InotifyTree(SRC_ROOT).event_gen(yield_nones=False):
    if "IN_CLOSE_WRITE" in event[1]:
        build(Path(event[2]) / event[3])
