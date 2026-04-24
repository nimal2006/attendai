from flask import Blueprint, request, jsonify
from services.db_service import DBService
from datetime import datetime

hw_bp = Blueprint('hw', __name__)

# ─────────────────────────────────────────────
# In-memory storage for the latest LCD display data
# The ESP32 LCD polls this endpoint to get what to display
# ─────────────────────────────────────────────
_lcd_display_data = {
    'name': 'System Ready',
    'status': 'Idle',
    'student_id': None,
    'updated_at': datetime.now().isoformat()
}

# ─────────────────────────────────────────────
# ESP32 LCD: GET endpoint — ESP32 polls this
# The ESP32 makes: GET /api/hw/esp32/attendance
# Returns JSON: { "name": "John", "status": "Present" }
# ─────────────────────────────────────────────
@hw_bp.route('/esp32/attendance', methods=['GET'])
def esp32_get_attendance():
    """
    The ESP32 with LCD calls this endpoint every few seconds.
    It receives the latest attendance entry to display on screen.
    
    Also supports fetching the most recent DB attendance record
    if no manual push has been made.
    """
    # If there's manually pushed data, return that
    if _lcd_display_data.get('student_id'):
        return jsonify({
            'name': _lcd_display_data['name'],
            'status': _lcd_display_data['status'],
            'student_id': _lcd_display_data['student_id'],
            'updated_at': _lcd_display_data['updated_at']
        })
    
    # Otherwise, get the latest attendance record from DB
    try:
        row = DBService.query("""
            SELECT s.name, a.status, a.student_id, a.time
            FROM attendance a 
            JOIN students s ON a.student_id = s.student_id 
            WHERE a.date = CURDATE()
            ORDER BY a.time DESC LIMIT 1
        """)
        if row and len(row) > 0:
            r = row[0]
            return jsonify({
                'name': r['name'],
                'status': r['status'],
                'student_id': r['student_id'],
                'updated_at': str(r.get('time', ''))
            })
    except Exception as e:
        print(f"ESP32 LCD DB Error: {e}")
    
    return jsonify({
        'name': 'AttendAI',
        'status': 'Ready',
        'student_id': None,
        'updated_at': datetime.now().isoformat()
    })

# ─────────────────────────────────────────────
# ESP32 LCD: POST endpoint — Admin pushes display data
# Called from the admin dashboard "Push to LCD" form
# ─────────────────────────────────────────────
@hw_bp.route('/esp32/push', methods=['POST'])
def esp32_push_display():
    """
    Admin pushes a student name + status to be displayed on ESP32 LCD.
    The ESP32 will pick this up on its next poll cycle.
    """
    global _lcd_display_data
    data = request.get_json()
    _lcd_display_data = {
        'name': data.get('name', 'Unknown'),
        'status': data.get('status', 'Unknown'),
        'student_id': data.get('student_id'),
        'updated_at': datetime.now().isoformat()
    }
    return jsonify({
        'success': True,
        'message': f"LCD display updated: {_lcd_display_data['name']} → {_lcd_display_data['status']}"
    })

# ─────────────────────────────────────────────
# ESP32 LCD: Clear display
# ─────────────────────────────────────────────
@hw_bp.route('/esp32/clear', methods=['POST'])
def esp32_clear_display():
    """Reset the LCD display data"""
    global _lcd_display_data
    _lcd_display_data = {
        'name': 'System Ready',
        'status': 'Idle',
        'student_id': None,
        'updated_at': datetime.now().isoformat()
    }
    return jsonify({'success': True, 'message': 'LCD display cleared'})

# ─────────────────────────────────────────────
# ESP32 LCD: Health check — ESP32 pings this
# ─────────────────────────────────────────────
@hw_bp.route('/esp32/ping', methods=['GET'])
def esp32_ping():
    """Simple health check for ESP32 connectivity"""
    return jsonify({'status': 'ok', 'server': 'AttendAI', 'time': datetime.now().isoformat()})
