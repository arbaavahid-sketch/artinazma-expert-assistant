"""Same-host worker admission and dispatch pacing, with no network under a DB lock.

Workers on one host must share this SQLite file. Multi-host deployments need a
shared external coordinator; a local SQLite file does not coordinate hosts.
"""
import math
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path


class ReferenceBusy(Exception):
    def __init__(self, retry_after=10):
        self.retry_after = max(1, math.ceil(retry_after))


class PubChemGate:
    def __init__(self, path, clock=time.time, sleep=time.sleep):
        self.path = Path(path)
        self.clock, self.sleep = clock, sleep

    @contextmanager
    def transaction(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=.5)
        try:
            connection.execute('CREATE TABLE IF NOT EXISTS gate (id INTEGER PRIMARY KEY, next_at REAL NOT NULL, blocked_until REAL NOT NULL)')
            connection.execute('CREATE TABLE IF NOT EXISTS leases (id TEXT PRIMARY KEY, expires REAL NOT NULL)')
            connection.execute('INSERT OR IGNORE INTO gate VALUES (1,0,0)')
            connection.commit()
            connection.execute('BEGIN IMMEDIATE')
            yield connection
            connection.commit()
        finally:
            connection.close()

    def acquire(self):
        token = uuid.uuid4().hex
        with self.transaction() as db:
            now = self.clock()
            db.execute('DELETE FROM leases WHERE expires <= ?', (now,))
            blocked = db.execute('SELECT blocked_until FROM gate WHERE id=1').fetchone()[0]
            if blocked > now:
                raise ReferenceBusy(blocked-now)
            if db.execute('SELECT count(*) FROM leases').fetchone()[0] >= 24:
                raise ReferenceBusy()
            # Queue budget 8 s + socket timeout 15 s; crash recovery after 45 s.
            db.execute('INSERT INTO leases VALUES (?,?)', (token, now+45))
        return token

    def wait_for_dispatch(self):
        deadline = self.clock()+8
        while True:
            with self.transaction() as db:
                now = self.clock()
                next_at, blocked = db.execute('SELECT next_at,blocked_until FROM gate WHERE id=1').fetchone()
                if blocked > now:
                    raise ReferenceBusy(blocked-now)
                delay = max(0, next_at-now)
                if delay == 0:
                    db.execute('UPDATE gate SET next_at=? WHERE id=1', (now+.35,))
                    return
                if now+delay > deadline:
                    raise ReferenceBusy()
            self.sleep(delay)  # The SQLite transaction is closed before waiting.

    def block(self, seconds):
        with self.transaction() as db:
            db.execute('UPDATE gate SET blocked_until=max(blocked_until,?) WHERE id=1', (self.clock()+seconds,))

    def release(self, token):
        with self.transaction() as db:
            db.execute('DELETE FROM leases WHERE id=?', (token,))


gate = PubChemGate(os.getenv('PUBCHEM_COORDINATOR_FILE', str(Path(__file__).resolve().parent/'storage'/'pubchem_gate.sqlite3')))
