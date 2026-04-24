import mysql.connector
from mysql.connector import Error
from contextlib import contextmanager

DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '',
    'database': 'attendance_system',
    'raise_on_warnings': True,
    'pool_name': 'attend_pool',
    'pool_size': 5
}

class DBService:
    @staticmethod
    def get_connection():
        """Get a single connection (or from pool)."""
        try:
            return mysql.connector.connect(**DB_CONFIG)
        except Error as e:
            print(f"DB Error: {e}")
            return None

    @staticmethod
    @contextmanager
    def get_cursor(dictionary=False):
        """Context manager to yield a db cursor safely."""
        conn = DBService.get_connection()
        if not conn:
            yield None
            return
            
        cursor = conn.cursor(dictionary=dictionary)
        try:
            yield cursor
            conn.commit()
        except Error as e:
            conn.rollback()
            print(f"DB Transaction Error: {e}")
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def query(sql, params=None, fetch=True, dictionary=True):
        """Helper for standard queries."""
        with DBService.get_cursor(dictionary=dictionary) as cursor:
            if not cursor:
                return [] if fetch else False
            
            cursor.execute(sql, params or ())
            
            if fetch:
                return cursor.fetchall()
            return cursor.lastrowid
