import os
from twilio.rest import Client
from datetime import datetime
from dotenv import load_dotenv
from services.db_service import DBService

load_dotenv()

class TwilioService:
    ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
    ADMIN_PHONE = os.getenv("ADMIN_PHONE_NUMBER", "+918778614984")
    ENABLE_SMS = os.getenv("ENABLE_SMS", "False").lower() == "true"

    try:
        client = Client(ACCOUNT_SID, AUTH_TOKEN)
    except Exception as e:
        client = None
        print(f"Twilio Initialization Failed: {e}")

    @classmethod
    def send_attendance_alert(cls, student_id, status):
        """Dispatches an SMS to the student's mapped parent based on Attendance Status."""
        
        # 1. Grab Student and Parent data
        result = DBService.query("""
            SELECT s.name as student_name, p.phone as parent_phone, p.parent_id 
            FROM students s
            JOIN parent_student ps ON s.id = ps.student_id
            JOIN parents p ON ps.parent_id = p.parent_id
            WHERE s.id = %s LIMIT 1
        """, (student_id,))
        
        if not result:
            print(f"Twilio: Cannot dispatch SMS. No nested Parent mapping for StudentID: {student_id}")
            return False

        student_name = result[0]['student_name']
        parent_phone = result[0]['parent_phone']
        parent_id = result[0]['parent_id']

        # 2. Template Generation
        now = datetime.now()
        date_str = now.strftime("%d-%m-%Y")
        time_str = now.strftime("%I:%M %p")

        if status.lower() == 'present':
            body = f"AttendAI: Your child {student_name} was marked Present safely on {date_str} at {time_str}."
        elif status.lower() == 'absent':
            body = f"Alert 🚨\nName: {student_name}\nStatus: ABSENT\nDate: {date_str}\nPlease contact the school if this is unexpected."
        elif status.lower() == 'late':
            body = f"AttendAI: Your child {student_name} arrived LATE on {date_str} at {time_str}. Ensure punctuality."
        elif status.lower() == 'unconfirmed':
            body = f"AttendAI: Attendance for {student_name} is currently Unconfirmed. The module will verify shortly."
        else:
            return False

        # 3. Fire Logic & Logging
        return cls._fire_sms(parent_id, student_id, parent_phone, "AttendanceUpdate", body)

    @classmethod
    def send_low_attendance_warning(cls, student_id):
        result = DBService.query("""
            SELECT s.name as student_name, p.phone as parent_phone, p.parent_id 
            FROM students s
            JOIN parent_student ps ON s.id = ps.student_id
            JOIN parents p ON ps.parent_id = p.parent_id
            WHERE s.id = %s LIMIT 1
        """, (student_id,))
        if not result: return False
        
        body = f"WARNING 🚨\nName: {result[0]['student_name']}\nHas fallen below the 75% attendance threshold. Please ensure regular attendance."
        return cls._fire_sms(result[0]['parent_id'], student_id, result[0]['parent_phone'], "LowAttendanceWarning", body)

    @classmethod
    def dispatch_daily_report(cls, absentees):
        report = f"Daily Subsystem Report 📊\nTotal Absent: {len(absentees)}\nNames: {', '.join(absentees)}"
        return cls._fire_sms(None, None, cls.ADMIN_PHONE, "DailyReport", report)

    @classmethod
    def _fire_sms(cls, parent_id, student_id, phone, event_type, body):
        if not cls.ENABLE_SMS:
            DBService.query(
                "INSERT INTO sms_logs (student_id, parent_id, phone, event_type, message, sms_status) VALUES (%s, %s, %s, %s, %s, 'Skipped (ENABLE_SMS=False)')",
                (student_id, parent_id, phone, event_type, body), fetch=False
            )
            print("Twilio Skipped >>", body)
            return True

        if not cls.client:
            print("Twilio offline.")
            return False

        try:
            message = cls.client.messages.create(
                body=body,
                from_=cls.PHONE_NUMBER,
                to=phone
            )
            DBService.query(
                "INSERT INTO sms_logs (student_id, parent_id, phone, event_type, message, sms_status, twilio_sid) VALUES (%s, %s, %s, %s, %s, 'Sent', %s)",
                (student_id, parent_id, phone, event_type, body, message.sid), fetch=False
            )
            return True
        except Exception as e:
            error_msg = str(e)
            DBService.query(
                "INSERT INTO sms_logs (student_id, parent_id, phone, event_type, message, sms_status, error_message) VALUES (%s, %s, %s, %s, %s, 'Failed', %s)",
                (student_id, parent_id, phone, event_type, body, error_msg), fetch=False
            )
            print("Twilio Error >>", error_msg)
            return False
