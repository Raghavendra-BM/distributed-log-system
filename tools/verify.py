"""
verify.py: did every log that the services wrote reach the database?

    python tools/verify.py                  # finds logs.db by itself
    python tools/verify.py --wait 20        # keep checking for up to 20 s while the collector catches up
    python tools/verify.py --db collector/logs.db

The log files are the source of truth. Every log has a unique id, so we compare the two sets.
Exit code 0 = nothing missing (PASS), 1 = something missing (FAIL).
"""
import argparse
import json
import os
import sqlite3
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.system("")  # makes colours work in the Windows terminal
GREEN, RED, BOLD, RESET = "\033[92m", "\033[91m", "\033[1m", "\033[0m"


def find_db(arg):
    if arg:
        return Path(arg)
    candidates = [p for p in (ROOT / "collector" / "logs.db", ROOT / "logs.db", Path.cwd() / "logs.db")
                  if p.exists()]
    if not candidates:
        sys.exit("Could not find logs.db. Use:  python tools/verify.py --db path/to/logs.db")
    return max(candidates, key=lambda p: p.stat().st_mtime)   # the most recently used one


def read_log_files(log_dir):
    """Returns {id: (service, seq)} for every complete line in logs/*.log, and the count of bad lines."""
    logs, bad = {}, 0
    for path in sorted(log_dir.glob("*.log")):
        with open(path, "rb") as f:
            for line in f:
                if not line.endswith(b"\n"):      # half-written last line
                    continue
                try:
                    d = json.loads(line)
                    logs[d["id"]] = (d["service"], d.get("seq"))
                except (ValueError, KeyError):
                    bad += 1
    return logs, bad


def read_db_ids(db):
    conn = sqlite3.connect(db, timeout=10)
    try:
        return {row[0] for row in conn.execute("SELECT id FROM logs")}
    finally:
        conn.close()


def ranges(numbers):
    """[1,2,3,7,8] -> '1-3, 7-8'"""
    numbers, out = sorted(n for n in numbers if n is not None), []
    i = 0
    while i < len(numbers):
        j = i
        while j + 1 < len(numbers) and numbers[j + 1] == numbers[j] + 1:
            j += 1
        out.append(str(numbers[i]) if i == j else f"{numbers[i]}-{numbers[j]}")
        i = j + 1
    return ", ".join(out)


def main():
    parser = argparse.ArgumentParser(description="Check that no logs are missing")
    parser.add_argument("--db", help="path to logs.db (default: auto-detect)")
    parser.add_argument("--logdir", default=str(ROOT / "logs"))
    parser.add_argument("--wait", type=float, default=0,
                        help="seconds to keep re-checking while the collector catches up")
    args = parser.parse_args()

    log_dir, db = Path(args.logdir), find_db(args.db)
    logs, bad = read_log_files(log_dir)
    if not logs:
        sys.exit(f"No logs found in {log_dir}. Start the services first.")

    deadline = time.time() + args.wait
    while True:
        db_ids = read_db_ids(db)
        missing = [i for i in logs if i not in db_ids]
        if not missing or time.time() >= deadline:
            break
        time.sleep(1)

    per_service = defaultdict(lambda: {"files": 0, "missing": []})
    for log_id, (service, seq) in logs.items():
        per_service[service]["files"] += 1
        if log_id not in db_ids:
            per_service[service]["missing"].append(seq)

    print(f"\nLog files: {log_dir}\nDatabase:  {db}\n")
    print(f"{'service':<12}{'in files':>10}{'missing':>10}   missing seq numbers")
    print("-" * 60)
    for service in sorted(per_service):
        s = per_service[service]
        print(f"{service:<12}{s['files']:>10}{len(s['missing']):>10}   {ranges(s['missing'])}")
    print("-" * 60)
    extra = len(db_ids - set(logs))
    print(f"{'TOTAL':<12}{len(logs):>10}{len(missing):>10}")
    print(f"\nLogs in the database that are not in the files (e.g. test data): {extra}")
    if bad:
        print(f"Lines in the files that were not valid JSON: {bad}")

    if missing:
        print(f"\n{RED}{BOLD}FAIL: {len(missing)} logs are missing{RESET}")
        sys.exit(1)
    print(f"\n{GREEN}{BOLD}PASS: 0 missing. All {len(logs)} logs arrived.{RESET}")


if __name__ == "__main__":
    main()
