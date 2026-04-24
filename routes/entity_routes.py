from flask import Blueprint, request, jsonify
from services.db_service import DBService

entity_bp = Blueprint('entity', __name__)

# ─────────────────────────────────────────────
# MODULE 6: Classes Management
# ─────────────────────────────────────────────
@entity_bp.route('/classes', methods=['GET', 'POST'])
def manage_classes():
    if request.method == 'GET':
        rows = DBService.query("SELECT * FROM classes ORDER BY class_name")
        return jsonify({'success': True, 'classes': rows})
    
    if request.method == 'POST':
        data = request.get_json()
        class_name = data.get('class_name')
        teacher_id = data.get('teacher_id')
        DBService.query("INSERT INTO classes (class_name, teacher_id) VALUES (%s, %s)", (class_name, teacher_id), fetch=False)
        return jsonify({'success': True, 'message': 'Class Created Successfully'})

@entity_bp.route('/classes/<int:id>', methods=['DELETE'])
def delete_class(id):
    DBService.query("DELETE FROM classes WHERE class_id=%s", (id,), fetch=False)
    return jsonify({'success': True, 'message': 'Class deleted.'})

# ─────────────────────────────────────────────
# MODULE 5: Teacher Management
# ─────────────────────────────────────────────
@entity_bp.route('/teachers', methods=['GET', 'POST'])
def manage_teachers():
    if request.method == 'GET':
        rows = DBService.query("SELECT * FROM teachers ORDER BY name")
        return jsonify({'success': True, 'teachers': rows})
    
    if request.method == 'POST':
        data = request.get_json()
        DBService.query(
            "INSERT INTO teachers (name, subject, school_id) VALUES (%s, %s, %s)", 
            (data.get('name'), data.get('subject'), data.get('school_id', 1)), fetch=False
        )
        return jsonify({'success': True, 'message': 'Teacher Record Created'})

@entity_bp.route('/teachers/<int:id>', methods=['PUT', 'DELETE'])
def modify_teacher(id):
    if request.method == 'DELETE':
        DBService.query("DELETE FROM teachers WHERE teacher_id=%s", (id,), fetch=False)
        return jsonify({'success': True, 'message': 'Teacher Removed.'})
    
    if request.method == 'PUT':
        data = request.get_json()
        DBService.query("UPDATE teachers SET name=%s, subject=%s WHERE teacher_id=%s", 
                        (data.get('name'), data.get('subject'), id), fetch=False)
        return jsonify({'success': True, 'message': 'Teacher Updated.'})

# ─────────────────────────────────────────────
# MODULE 14: Remarks Module
# ─────────────────────────────────────────────
@entity_bp.route('/remarks', methods=['POST'])
def add_remark():
    data = request.get_json()
    DBService.query(
        "INSERT INTO remarks (student_id, teacher_id, remark_text) VALUES (%s, %s, %s)",
        (data.get('student_id'), data.get('teacher_id'), data.get('remark_text')), fetch=False
    )
    # Could seamlessly hook to Notifications/SMS here later
    return jsonify({'success': True, 'message': 'Remark Sent to Parent Portal'})

# ─────────────────────────────────────────────
# PARENT MANAGEMENT & LINKING PROTOCOL
# ─────────────────────────────────────────────
@entity_bp.route('/parents', methods=['GET', 'POST'])
def manage_parents():
    if request.method == 'GET':
        rows = DBService.query("SELECT * FROM parents ORDER BY name")
        return jsonify({'success': True, 'parents': rows})
    
    if request.method == 'POST':
        data = request.get_json()
        parent_id = DBService.query(
            "INSERT INTO parents (name, phone) VALUES (%s, %s)",
            (data.get('name'), data.get('phone')), fetch=False
        )
        return jsonify({'success': True, 'message': 'Guardian Profile Created', 'parent_id': parent_id})

@entity_bp.route('/parents/link', methods=['POST'])
def link_parent():
    data = request.get_json()
    DBService.query(
        "INSERT INTO parent_student (parent_id, student_id) VALUES (%s, %s)",
        (data.get('parent_id'), data.get('student_id')), fetch=False
    )
    return jsonify({'success': True, 'message': 'Student linked to Guardian.'})

# ─────────────────────────────────────────────
# MODULE 12: Timetable Module
# ─────────────────────────────────────────────
@entity_bp.route('/timetable', methods=['GET', 'POST'])
def manage_timetable():
    if request.method == 'GET':
        class_id = request.args.get('class_id')
        query = "SELECT * FROM timetable"
        params = ()
        if class_id:
            query += " WHERE class_id=%s"
            params = (class_id,)
        rows = DBService.query(query, params)
        return jsonify({'success': True, 'timetable': rows})
    
    if request.method == 'POST':
        data = request.get_json()
        DBService.query(
            "INSERT INTO timetable (class_id, day, period, subject, teacher_id) VALUES (%s, %s, %s, %s, %s)",
            (data.get('class_id'), data.get('day'), data.get('period'), data.get('subject'), data.get('teacher_id')), fetch=False
        )
        return jsonify({'success': True, 'message': 'Timetable Slot Registered'})
