"""
Log Collector API (v2)

Run:  uvicorn collector:app --reload --port 8000
Docs: http://localhost:8000/docs   (FastAPI builds this page for free)
"""
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from queue import Empty, Queue
from threading import Thread
from typing import List, Literal, Optional, Union

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

DB_FILE = "logs.db"
MAX_QUEUE_SIZE = 10_000   # above this we tell senders to slow down (backpressure)
WRITER_BATCH_SIZE = 500   # logs saved per database transaction

log_queue = Queue(maxsize=MAX_QUEUE_SIZE)


def now_iso() -> str:
    """UTC time like 2026-10-10T10:15:03.120Z (same format everywhere, so filters work)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


# ---------------------------------------------------------------- data model
class LogEntry(BaseModel):
    # id and timestamp should be created by the SERVICE that wrote the log.
    # The defaults below only exist so your old agent keeps working while you upgrade it.
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=now_iso)
    service: str
    level: Literal["INFO", "WARN", "ERROR"]
    message: str
    host: str = "unknown"
    trace_id: Optional[str] = None
    seq: Optional[int] = None

    @field_validator("level", mode="before")
    @classmethod
    def clean_level(cls, v):
        if isinstance(v, str):
            v = v.strip().upper()
            return "WARN" if v == "WARNING" else v
        return v


# ------------------------------------------------------------------ database
def get_conn():
    conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("PRAGMA journal_mode=WAL")  # lets reads and writes happen together
    conn.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            row_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            id          TEXT UNIQUE NOT NULL,   -- UNIQUE = duplicates get rejected
            timestamp   TEXT NOT NULL,
            received_at TEXT NOT NULL,
            service     TEXT NOT NULL,
            level       TEXT NOT NULL,
            host        TEXT,
            trace_id    TEXT,
            seq         INTEGER,
            message     TEXT NOT NULL
        )
    """)
    for col in ("timestamp", "service", "level", "trace_id"):
        conn.execute(f"CREATE INDEX IF NOT EXISTS idx_logs_{col} ON logs({col})")
    conn.commit()
    conn.close()


INSERT_SQL = """
    INSERT OR IGNORE INTO logs
        (id, timestamp, received_at, service, level, host, trace_id, seq, message)
    VALUES
        (:id, :timestamp, :received_at, :service, :level, :host, :trace_id, :seq, :message)
"""


def writer_loop():
    """Background thread: takes logs from the queue and saves them in batches."""
    conn = get_conn()  # ONE connection reused (opening one per log is very slow)
    while True:
        batch = [log_queue.get()]  # wait until at least one log exists
        while len(batch) < WRITER_BATCH_SIZE:
            try:
                batch.append(log_queue.get_nowait())
            except Empty:
                break
        try:
            with conn:  # commits on success, rolls back on error
                conn.executemany(INSERT_SQL, batch)
        except Exception as e:
            # In this version these logs are gone. A durable queue (Redis) would fix this.
            print(f"[writer] DB error, {len(batch)} logs lost: {e}")
        finally:
            for _ in batch:
                log_queue.task_done()  # lets shutdown know these logs are finished


# ----------------------------------------------------------------------- app
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    Thread(target=writer_loop, daemon=True).start()
    yield
    # Shutdown (Ctrl+C): give the writer up to 10 s to save the logs still waiting in the queue.
    waiter = Thread(target=log_queue.join, daemon=True)
    waiter.start()
    waiter.join(timeout=10)


app = FastAPI(title="Log Collector", lifespan=lifespan)

# Without this, a web page on another port is blocked by the browser from calling the API.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/")
def home():
    return {"message": "Log Collector API is running!"}


@app.post("/logs", status_code=202)
def receive_logs(body: Union[List[LogEntry], LogEntry]):
    """Accepts ONE log or a LIST of logs (the agent should send lists)."""
    logs = body if isinstance(body, list) else [body]

    # Backpressure: if the waiting line is too full, refuse the whole batch.
    if len(logs) > MAX_QUEUE_SIZE - log_queue.qsize():
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": "2"},
            content={"status": "overloaded", "message": "Queue full, retry later"},
        )

    received_at = now_iso()
    for log in logs:
        row = log.model_dump()
        row["received_at"] = received_at
        log_queue.put_nowait(row)

    return {"status": "accepted", "count": len(logs)}


@app.get("/logs")
def get_logs(
    service: Optional[str] = None,
    level: Optional[str] = None,
    trace_id: Optional[str] = None,
    q: Optional[str] = Query(None, description="text to search in message"),
    from_time: Optional[str] = Query(None, alias="from"),
    to_time: Optional[str] = Query(None, alias="to"),
    since_id: Optional[int] = Query(None, description="only logs newer than this row_id (live tail)"),
    limit: int = Query(100, ge=1, le=1000),
):
    where, params = [], []
    if service:
        where.append("service = ?")
        params.append(service)
    if level:
        where.append("level = ?")
        params.append(level.upper())
    if trace_id:
        where.append("trace_id = ?")
        params.append(trace_id)
    if q:
        where.append("message LIKE ?")
        params.append(f"%{q}%")
    if from_time:
        where.append("timestamp >= ?")
        params.append(from_time)
    if to_time:
        where.append("timestamp <= ?")
        params.append(to_time)
    if since_id is not None:
        where.append("row_id > ?")
        params.append(since_id)

    sql = "SELECT * FROM logs"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY row_id DESC LIMIT ?"
    params.append(limit)

    conn = get_conn()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return {"count": len(rows), "logs": [dict(r) for r in rows]}


@app.get("/stats")
def stats():
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM logs").fetchone()[0]
    by_level = {r["level"]: r["n"] for r in conn.execute(
        "SELECT level, COUNT(*) AS n FROM logs GROUP BY level")}
    conn.close()
    return {"queue_size": log_queue.qsize(), "total_logs": total, "by_level": by_level}
