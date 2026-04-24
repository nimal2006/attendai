from services.db_service import DBService

tables = [
    """CREATE TABLE IF NOT EXISTS classes (
        class_id INT AUTO_INCREMENT PRIMARY KEY,
        class_name VARCHAR(100),
        teacher_id INT
    )""",
    """CREATE TABLE IF NOT EXISTS timetable (
        entry_id INT AUTO_INCREMENT PRIMARY KEY,
        class_id INT,
        day VARCHAR(20),
        period INT,
        subject VARCHAR(100),
        teacher_id INT
    )""",
    """CREATE TABLE IF NOT EXISTS sms_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        parent_id INT,
        phone VARCHAR(20),
        event_type VARCHAR(50),
        message TEXT,
        sms_status VARCHAR(50),
        twilio_sid VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS recognition_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        method VARCHAR(50),
        confidence FLOAT,
        result VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS remarks (
        remark_id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT,
        teacher_id INT,
        remark_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )"""
]

try:
    for sql in tables:
        DBService.query(sql, fetch=False)
    print("SUCCESS: 5 modular tables injected perfectly into memory.")
except Exception as e:
    print("FAILED MySQL Injection:", str(e))
