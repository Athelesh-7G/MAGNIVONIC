# Aurora PostgreSQL connection pool
import json, psycopg2, psycopg2.pool
from datetime import datetime, timezone
from secrets import get_secret

_pool = None


def _get_pool():
    global _pool
    if _pool is not None:
        return _pool
    try:
        secret_str = get_secret('magnivonic/aurora')
        creds = json.loads(secret_str)
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1, maxconn=5,
            host=creds['host'],
            port=int(creds['port']),
            dbname=creds['dbname'],
            user=creds['username'],
            password=creds['password'],
            sslmode='require',
            connect_timeout=10
        )
        _log('pool_created')
        return _pool
    except Exception as e:
        _log('pool_error', error=str(e))
        raise


def get_conn():
    conn = _get_pool().getconn()
    conn.autocommit = False
    _log('connection_acquired')
    return conn


def release_conn(conn):
    try:
        if conn and not conn.closed:
            conn.rollback()
        _get_pool().putconn(conn)
        _log('connection_released')
    except Exception as e:
        _log('release_error', error=str(e))


def _log(event: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'component': 'db',
        'event': event,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))
