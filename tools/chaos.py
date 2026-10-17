"""
Trigger an error burst for the alert demo.

    python tools/chaos.py 30     # the services write mostly ERRORs for the next 30 seconds
    python tools/chaos.py off    # back to normal immediately

It writes a small file logs/CHAOS holding the time when the burst ends. The services check it.
"""
import os
import sys
import time
from pathlib import Path

LOG_DIR = Path(os.environ.get("LOG_DIR", Path(__file__).resolve().parent.parent / "logs"))
flag = LOG_DIR / "CHAOS"

if len(sys.argv) != 2:
    sys.exit("Usage: python tools/chaos.py <seconds>   or   python tools/chaos.py off")

if sys.argv[1] == "off":
    flag.unlink(missing_ok=True)
    print("Chaos off. Services are back to normal.")
else:
    seconds = float(sys.argv[1])
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    flag.write_text(str(time.time() + seconds))
    print(f"Error burst for {seconds:.0f} seconds. Watch the alert in the UI.")
