"""
Speed test: sends many logs to the collector as fast as possible and reports logs per second.

    python tools/load_test.py
    python tools/load_test.py --total 20000 --batch 100 --threads 4

The test logs use service name "loadtest" so you can filter them out in the UI.
Note: verify.py counts them as "extra in database", which is fine.
"""
import argparse
import queue
import threading
import time
import uuid
from datetime import datetime, timezone

import requests


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def send(url, batch, stats, lock):
    """Send one batch; if the collector says 429 (overloaded), wait and send it again."""
    while True:
        try:
            r = requests.post(f"{url}/logs", json=batch, timeout=10)
        except requests.RequestException:
            with lock:
                stats["errors"] += 1
            time.sleep(1)
            continue
        if r.status_code == 429:
            with lock:
                stats["429"] += 1
            time.sleep(float(r.headers.get("Retry-After", 1)))
            continue
        if r.status_code >= 300:
            with lock:
                stats["errors"] += 1
        return


def worker(url, jobs, batch_size, run_id, stats, lock):
    while True:
        try:
            n = jobs.get_nowait()
        except queue.Empty:
            return
        batch = [{
            "id": f"{run_id}-{n}-{i}",
            "timestamp": now_iso(),
            "service": "loadtest",
            "level": "INFO",
            "host": "loadgen",
            "seq": n * batch_size + i + 1,
            "message": f"load test log {n * batch_size + i + 1}",
        } for i in range(batch_size)]
        send(url, batch, stats, lock)


def total_logs(url):
    return requests.get(f"{url}/stats", timeout=5).json()["total_logs"]


def main():
    p = argparse.ArgumentParser(description="Collector speed test")
    p.add_argument("--url", default="http://localhost:8000")
    p.add_argument("--total", type=int, default=10000, help="logs to send")
    p.add_argument("--batch", type=int, default=100, help="logs per request")
    p.add_argument("--threads", type=int, default=4)
    args = p.parse_args()

    batches = args.total // args.batch
    total = batches * args.batch
    start_count = total_logs(args.url)
    jobs = queue.Queue()
    for n in range(batches):
        jobs.put(n)
    stats, lock, run_id = {"429": 0, "errors": 0}, threading.Lock(), uuid.uuid4().hex[:8]

    print(f"Sending {total} logs in {batches} batches with {args.threads} threads ...")
    t0 = time.time()
    threads = [threading.Thread(target=worker, args=(args.url, jobs, args.batch, run_id, stats, lock))
               for _ in range(args.threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    accept_time = time.time() - t0

    while total_logs(args.url) < start_count + total and time.time() - t0 < 120:
        time.sleep(0.2)
    end_to_end = time.time() - t0
    stored = total_logs(args.url) - start_count

    print(f"\nAccepted by the collector: {total / accept_time:,.0f} logs/second ({accept_time:.1f} s)")
    print(f"Safely in the database:    {stored:,} of {total:,} logs after {end_to_end:.1f} s "
          f"({stored / end_to_end:,.0f} logs/second end to end)")
    print(f"429 'slow down' answers: {stats['429']}   errors: {stats['errors']}")


if __name__ == "__main__":
    main()
