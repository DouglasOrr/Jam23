import subprocess
import sys
from pathlib import Path

import inotify.adapters

SRC_ROOT = "assets/src/levels"
DEST_ROOT = "assets/dist/levels"


def build(f: Path) -> None:
    try:
        subprocess.check_call(
            ["python", Path(__file__).parent / "build_level.py", str(f), DEST_ROOT]
        )
    except subprocess.CalledProcessError as e:
        print(e, file=sys.stderr)


for f in Path(SRC_ROOT).glob("**/*.png"):
    build(f)

print("Watching for changes", file=sys.stderr)

for event in inotify.adapters.InotifyTree(SRC_ROOT).event_gen(yield_nones=False):
    if "IN_CLOSE_WRITE" in event[1]:
        build(Path(event[2]) / event[3])
