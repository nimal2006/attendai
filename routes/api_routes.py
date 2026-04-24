from flask import Blueprint, request, jsonify
from datetime import date, datetime, timedelta
from services.db_service import DBService
from services.twilio_service import TwilioService

api_bp = Blueprint('api', __name__)

# Helper to format dates for JSON serialization
def format_dates(rows):
    for r in rows:
        for k, v in r.items():
            if isinstance(v, (date, datetime)):
                r[k] = v.isoformat()
            elif isinstance(v, timedelta):
                r[k] = str(v)
    return rows

# ─────────────────────────────────────────────
# Dashboard Stats
# ─────────────────────────────────────────────
@api_bp.route('/stats/admin', methods=['GET'])
def get_admin_stats():
    total_students = DBService.query("SELECT COUNT(*) as c FROM students")[0]['c']
    
    # Calculate Attendance Pct
    att = DBService.query("SELECT COUNT(*) as present FROM attendance WHERE status IN ('Present', 'Late') AND date = CURDATE()")
    att_present = att[0]['present'] if att else 0
    att_pct = (att_present / total_students * 100) if total_students > 0 else 0

    # Calculate Avg Perf
    perf = DBService.query("SELECT AVG((marks/total_marks)*100) as avg_p FROM marks")
    avg_perf = perf[0]['avg_p'] if perf and perf[0]['avg_p'] else 0

    # Predictive At-Risk Engine: Finding Students trending downwards
    risk_query = """
        SELECT * FROM (
            SELECT 
                s.student_id as id, 
                s.name, 
                s.class as class_name, 
                (SELECT COUNT(*) FROM attendance WHERE student_id=s.student_id AND status IN ('present','late')) * 100.0 / 
                    NULLIF((SELECT COUNT(*) FROM attendance WHERE student_id=s.student_id), 0) as attendance_pct,
                (SELECT AVG((marks/total_marks)*100) FROM marks WHERE student_id=s.student_id) as avg_marks
            FROM students s
        ) sub
        WHERE (attendance_pct < 75 OR avg_marks < 50) AND attendance_pct IS NOT NULL
        ORDER BY attendance_pct ASC LIMIT 5
    """
    risk_results = DBService.query(risk_query)
    formatted_risk = []
    if risk_results:
        for r in risk_results:
            formatted_risk.append({
                'id': r['id'],
                'name': r['name'],
                'class': r['class_name'],
                'attendance_pct': round(float(r['attendance_pct']), 1) if r['attendance_pct'] is not None else 'N/A',
                'avg_marks': round(float(r['avg_marks']), 1) if r['avg_marks'] is not None else 'N/A'
            })
    risk_count = len(risk_results) if risk_results else 0

    # Getting Suspicious Logs
    logs = DBService.query("SELECT timestamp as attempt_timestamp, reason FROM suspicious_logs ORDER BY timestamp DESC LIMIT 10")

    return jsonify({
        'success': True,
        'stats': {
            'total_students': total_students,
            'attendance_pct': round(att_pct, 1),
            'avg_performance': round(float(avg_perf), 1),
            'risk_count': risk_count,
            'at_risk_list': formatted_risk
        },
        'logs': format_dates(logs)
    })

# ─────────────────────────────────────────────
# Students & Attendance
# ─────────────────────────────────────────────
@api_bp.route('/students', methods=['GET'])
def get_students():
    user_id = request.args.get('user_id')
    user_role = request.args.get('role')
    
    if user_role == 'parent' and user_id:
        rows = DBService.query("""
            SELECT s.student_id as id, s.student_id, s.name, s.class, s.section, s.roll_number 
            FROM students s
            JOIN parent_student ps ON s.student_id = ps.student_id
            JOIN parents p ON ps.parent_id = p.parent_id
            WHERE p.user_id = %s
            ORDER BY s.name
        """, (user_id,))
    else:
        rows = DBService.query("SELECT student_id as id, student_id, name, class, section, roll_number FROM students ORDER BY name")
    
    return jsonify({'success': True, 'students': format_dates(rows)})

@api_bp.route('/students/<int:id>', methods=['PUT', 'DELETE'])
def modify_student(id):
    if request.method == 'DELETE':
        DBService.query("DELETE FROM students WHERE student_id=%s", (id,), fetch=False)
        return jsonify({'success': True, 'message': 'Student record deleted.'})
    
    if request.method == 'PUT':
        data = request.get_json()
        DBService.query("UPDATE students SET name=%s, class=%s WHERE student_id=%s", 
                        (data.get('name'), data.get('class_name'), id), fetch=False)
        return jsonify({'success': True, 'message': 'Student updated.'})

@api_bp.route('/students/add', methods=['POST'])
def add_student():
    data = request.get_json()
    try:
        student_id = DBService.query(
            "INSERT INTO students (name, class, school_id) VALUES (%s, %s, 1)",
            (data['name'], data['class_name']), fetch=False
        )
        return jsonify({'success': True, 'message': 'Student Profile Created', 'student_id': student_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@api_bp.route('/attendance/mark', methods=['POST'])
def manual_attendance():
    data = request.get_json()
    student_id = data.get('student_id')
    status = data.get('status', 'Absent').capitalize()
    try:
        DBService.query(
            "INSERT INTO attendance (student_id, date, status, time) VALUES (%s, CURDATE(), %s, CURTIME()) ON DUPLICATE KEY UPDATE status=%s, time=CURTIME()",
            (student_id, status, status), fetch=False
        )
        
        # Dispatch SMS Alert
        TwilioService.send_attendance_alert(student_id, status)
        
        # Trigger Low-Attendance Safety Verification
        attendance_stats = DBService.query("""
            SELECT (COUNT(CASE WHEN status IN ('Present', 'Late') THEN 1 END) * 1.0) / COUNT(*) as att_ratio 
            FROM attendance WHERE student_id=%s
        """, (student_id,))
        
        if attendance_stats and attendance_stats[0]['att_ratio'] is not None:
            if attendance_stats[0]['att_ratio'] < 0.75:
                TwilioService.send_low_attendance_warning(student_id)

        return jsonify({'success': True, 'message': f'Attendance marked: {status}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# ─────────────────────────────────────────────
# Leaves
# ─────────────────────────────────────────────
@api_bp.route('/leaves', methods=['GET'])
def get_leaves():
    status_filter = request.args.get('status')
    if status_filter:
        rows = DBService.query(
            "SELECT l.*, s.name as student_name FROM leave_requests l JOIN students s ON l.student_id=s.student_id WHERE l.status=%s ORDER BY l.created_at DESC",
            (status_filter,)
        )
    else:
        rows = DBService.query(
            "SELECT l.*, s.name as student_name FROM leave_requests l JOIN students s ON l.student_id=s.student_id ORDER BY l.created_at DESC"
        )
    return jsonify({'success': True, 'leaves': format_dates(rows)})

@api_bp.route('/leaves/<int:id>', methods=['PUT'])
def resolve_leave(id):
    data = request.get_json()
    DBService.query("UPDATE leave_requests SET status=%s WHERE request_id=%s", (data['status'], id), fetch=False)
    return jsonify({'success': True, 'message': f"Leave {data['status']}"})

@api_bp.route('/leaves/apply', methods=['POST'])
def submit_leave():
    data = request.get_json()
    DBService.query(
        "INSERT INTO leave_requests (student_id, from_date, to_date, reason, requested_by) VALUES (%s, %s, %s, %s, 'parent')",
        (data.get('student_id'), data.get('from_date'), data.get('to_date'), data.get('reason')), fetch=False
    )
    return jsonify({'success': True, 'message': 'Leave Request Submitted'})

# ─────────────────────────────────────────────
# Communications API (Twilio Frontend Hook)
# ─────────────────────────────────────────────
@api_bp.route('/comms/sms/broadcast', methods=['POST'])
def direct_sms_broadcast():
    data = request.get_json()
    parent_phone = data.get('target', '').strip()
    msg_body = data.get('message', '').strip()

    if not parent_phone or not msg_body:
        return jsonify({'success': False, 'message': 'Missing recipient or payload.'}), 400

    try:
        if TwilioService.client and TwilioService.ENABLE_SMS:
            message = TwilioService.client.messages.create(
                body=msg_body,
                from_=TwilioService.PHONE_NUMBER,
                to=parent_phone
            )
            DBService.query(
                "INSERT INTO sms_logs (phone, event_type, message, sms_status, twilio_sid) VALUES (%s, 'DirectBroadcast', %s, 'Sent', %s)",
                (parent_phone, msg_body, message.sid), fetch=False
            )
            return jsonify({'success': True, 'message': 'Twilio Event Fired!'})
        else:
            DBService.query(
                "INSERT INTO sms_logs (phone, event_type, message, sms_status) VALUES (%s, 'DirectBroadcast', %s, 'Skipped-Offline')",
                (parent_phone, msg_body), fetch=False
            )
            return jsonify({'success': True, 'message': 'Twilio Skipped (Offline/Sandbox). Logged locally.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

# ─────────────────────────────────────────────
# Marks
# ─────────────────────────────────────────────
@api_bp.route('/marks/add', methods=['POST'])
def add_marks():
    data = request.get_json()
    DBService.query(
        "INSERT INTO marks (student_id, subject, marks, total_marks, exam_type, date) VALUES (%s,%s,%s,%s,%s,%s)",
        (data['student_id'], data['subject'], data['marks'], data.get('total_marks', 100), data.get('exam_type', 'Mid-Term'), date.today().isoformat()),
        fetch=False
    )
    return jsonify({'success': True, 'message': 'Marks submitted'})

@api_bp.route('/marks/<int:student_id>', methods=['GET'])
def get_marks(student_id):
    rows = DBService.query("SELECT * FROM marks WHERE student_id=%s ORDER BY date DESC", (student_id,))
    
    # Calculate Analytics (Module 11 logic)
    if rows:
        avg_score = sum((m['marks'] / m['total_marks']) * 100 for m in rows) / len(rows)
        strongest = max(rows, key=lambda x: (x['marks'] / x['total_marks']) * 100)['subject']
        weakest = min(rows, key=lambda x: (x['marks'] / x['total_marks']) * 100)['subject']
    else:
        avg_score, strongest, weakest = 0, "N/A", "N/A"

    return jsonify({
        'success': True, 
        'marks': format_dates(rows),
        'analytics': {
            'average': round(avg_score, 1),
            'strongest': strongest,
            'weakest': weakest
        }
    })

# ─────────────────────────────────────────────
# MODULE 9: Notifications Array
# ─────────────────────────────────────────────
@api_bp.route('/notifications', methods=['GET'])
def get_notifications():
    # Grabs alerts, SMS outbox states, and Anti-cheat warnings for global broadcast
    logs = DBService.query("SELECT timestamp as time, reason as msg, 'SYSTEM' as from_user FROM suspicious_logs ORDER BY log_id DESC LIMIT 20")
    return jsonify({'success': True, 'notifications': format_dates(logs)})

# ─────────────────────────────────────────────
# Attendance: Today's Records
# ─────────────────────────────────────────────
@api_bp.route('/attendance/today', methods=['GET'])
def get_attendance_today():
    rows = DBService.query("""
        SELECT a.student_id, s.name as student_name, s.class, a.status, a.time
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        WHERE a.date = CURDATE()
        ORDER BY a.time DESC
    """)
    return jsonify({'success': True, 'records': format_dates(rows)})

# ─────────────────────────────────────────────
# SMS Logs
# ─────────────────────────────────────────────
@api_bp.route('/sms/logs', methods=['GET'])
def get_sms_logs():
    try:
        rows = DBService.query("SELECT phone, event_type, message, sms_status FROM sms_logs ORDER BY log_id DESC LIMIT 20")
        return jsonify({'success': True, 'logs': rows})
    except Exception:
        return jsonify({'success': True, 'logs': []})
