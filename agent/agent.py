"""
Log agent: reads the logs/*.log files and sends new lines to the collector in batches.

Run from the project folder:
    python agent/agent.py
    python agent/agent.py --collector http://localhost:8000/logs --batch 100

What it guarantees:
  * BATCHING       up to 100 logs per request instead of one request per log
  * CHECKPOINT     remembers how far it has read each file (agent/checkpoint.json),
                   and moves forward only AFTER the collector accepted the batch
  * RETRY          collector down / overloaded -> wait 1, 2, 4 ... 30 s and resend the SAME batch
  * NO LOSS        a crash can cause a resend, but never a skip; the collector ignores repeated ids
"""
import argparse
import json
import os
import random
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
HERE = Path(__file__).resolve().parent


def load_checkpoint(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def save_checkpoint(path, offsets):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(offsets))
    os.replace(tmp, path)  # atomic: the file is never half-written


def read_batch(log_dir, offsets, batch_size):
    """Read new COMPLETE lines from every *.log file. Returns (logs, new_offsets)."""
    batch, new_offsets = [], dict(offsets)
    for path in sorted(log_dir.glob("*.log")):
        offset = offsets.get(path.name, 0)
        size = path.stat().st_size
        if size < offset:          # file was replaced or emptied: start again
            offset = 0
            new_offsets[path.name] = 0
        if size == offset:
            continue
        with open(path, "rb") as f:
            f.seek(offset)
            while len(batch) < batch_size:
                line = f.readline()
                if not line or not line.endswith(b"\n"):   # empty, or a half-written last line
                    break
                offset += len(line)
                try:
                    batch.append(json.loads(line))
                except ValueError:
                    print(f"[agent] skipping a line that is not valid JSON in {path.name}")
        new_offsets[path.name] = offset
        if len(batch) >= batch_size:
            break
    return batch, new_offsets


def post_batch(url, batch):
    """Send one batch. Returns 'ok' or 'bad'. If the collector is down or busy, wait and retry forever."""
    delay = 1
    while True:
        try:
            r = requests.post(url, json=batch, timeout=5)
            if r.status_code < 300:
                return "ok"
            if r.status_code == 429:                      # collector says: slow down
                wait = max(float(r.headers.get("Retry-After", 1)), delay)
                print(f"[agent] collector overloaded (429), waiting {wait:.0f}s")
            elif 400 <= r.status_code < 500:              # the data itself is invalid
                return "bad"
            else:                                         # 5xx: collector has a problem
                wait = delay
                print(f"[agent] collector error {r.status_code}, retrying in {wait}s")
        except requests.RequestException:
            wait = delay
            print(f"[agent] collector unreachable, retrying in {wait}s")
        time.sleep(wait + random.uniform(0, 0.5))
        delay = min(delay * 2, 30)                        # 1, 2, 4, 8, 16, 30, 30 ...


def deliver(url, batch, rejected_path):
    """Send a batch. If the collector rejects it as invalid, send the logs one by one
    so that one bad line cannot block the good ones. Returns how many logs were accepted."""
    if post_batch(url, batch) == "ok":
        return len(batch)
    if len(batch) == 1:
        with open(rejected_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(batch[0]) + "\n")
        print(f"[agent] 1 invalid log saved to {rejected_path.name}")
        return 0
    return sum(deliver(url, [log], rejected_path) for log in batch)


def main():
    parser = argparse.ArgumentParser(description="Log agent")
    parser.add_argument("--collector", default=os.environ.get("COLLECTOR_URL", "http://localhost:8000/logs"))
    parser.add_argument("--logdir", default=os.environ.get("LOG_DIR", str(ROOT / "logs")))
    parser.add_argument("--batch", type=int, default=100, help="max logs per request")
    parser.add_argument("--interval", type=float, default=1.0, help="seconds to wait when nothing is new")
    parser.add_argument("--checkpoint", default=str(HERE / "checkpoint.json"))
    args = parser.parse_args()

    log_dir = Path(args.logdir)
    log_dir.mkdir(parents=True, exist_ok=True)
    cp_path = Path(args.checkpoint)
    rejected_path = cp_path.with_name("rejected.jsonl")

    offsets = load_checkpoint(cp_path)
    total = 0
    print(f"[agent] watching {log_dir} -> {args.collector}  (Ctrl+C to stop)")
    if offsets:
        print(f"[agent] resuming from checkpoint: {offsets}")

    try:
        while True:
            batch, new_offsets = read_batch(log_dir, offsets, args.batch)
            if batch:
                total += deliver(args.collector, batch, rejected_path)
                print(f"[agent] sent {len(batch)} logs (total {total})")
            if new_offsets != offsets:          # only reached AFTER the batch was accepted
                offsets = new_offsets
                save_checkpoint(cp_path, offsets)
            if len(batch) < args.batch:
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[agent] stopped. Checkpoint is saved, restart to continue.")


if __name__ == "__main__":
    main()
