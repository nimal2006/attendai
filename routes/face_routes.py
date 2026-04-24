from flask import Blueprint, request, jsonify
from datetime import date
import os, random
from services.db_service import DBService
from services.face_recognition_service import FaceService
from services.twilio_service import TwilioService
from dotenv import load_dotenv

load_dotenv()
ENABLE_REAL_FACE_RECOGNITION = os.getenv("ENABLE_REAL_FACE_RECOGNITION", "False").lower() == "true"

face_bp = Blueprint('face', __name__)

@face_bp.route('/register', methods=['POST'])
def register_face():
    """Endpoint handles an array of images (angles) to map robust baseline encoding"""
    data = request.get_json()
    student_id = data.get('student_id')
    images = data.get('images', [])
    
    # Check fallback for single image upload integration (from old UI)
    if not images and data.get('image'):
        images = [data.get('image')]

    if not student_id or not images:
        return jsonify({'success': False, 'message': 'student_id and Base64 images array required'}), 400

    success, msg = FaceService.register_faces(student_id, images)
    return jsonify({'success': success, 'message': msg}), 200 if success else 400

@face_bp.route('/recognize', methods=['POST'])
def recognize_face():
    data = request.get_json()
    frames = data.get('frames', []) 

    if not ENABLE_REAL_FACE_RECOGNITION:
        # -----------------------------
        # DEMO MODE (Module 8 Fallback)
        # -----------------------------
        # Grab a random active student from DB to emulate a successful scan
        db_students = DBService.query("SELECT student_id as id, name FROM students WHERE student_id IS NOT NULL LIMIT 20")
        if not db_students:
            return jsonify({'success': False, 'message': 'Demo Failed: No students configured in DB to mock scan.'}), 400
            
        mock_student = random.choice(db_students)
        student_id = mock_student['id']
        conf = round(random.uniform(92.5, 99.9), 2)
        
        # Log to recognition_logs table
        DBService.query(
            "INSERT INTO recognition_logs (student_id, method, confidence, result) VALUES (%s, 'Face_Demo', %s, 'SUCCESS')", 
            (student_id, conf), fetch=False
        )

        result = {
            'success': True,
            'matched': True,
            'student_id': student_id,
            'student_name': mock_student['name'],
            'confidence': conf,
            'liveness_score': 0.98,
            'message': 'Simulated Face Matched'
        }
    else:
        # -----------------------------
        # REAL PRODUCTION COMPUTER VISION
        # -----------------------------
        if not frames or len(frames) < 3:
            return jsonify({'success': False, 'message': 'Minimal 3 frames required for Anti-Cheat evaluation'}), 400

        # Execute Strong Multi-Frame Liveness Pass
        is_live, liveness_msg = FaceService.analyze_liveness(frames)
        if not is_live:
            DBService.query("INSERT INTO suspicious_logs (reason) VALUES (%s)", (liveness_msg,), fetch=False)
            return jsonify({'success': False, 'message': 'Liveness Rejected: ' + liveness_msg}), 403

        # Execute Majority Voting Logic
        result = FaceService.verify_face_multi_frame(frames)
        if result.get('matched'):
            DBService.query(
                "INSERT INTO recognition_logs (student_id, method, confidence, result) VALUES (%s, 'Face_Real', %s, 'SUCCESS')", 
                (result['student_id'], result.get('confidence', 0.0)), fetch=False
            )


    # Handle Attendance Commits for Both Pathways
    if result.get('matched') and data.get('auto_mark'):
        try:
            # Module 7: Prevent duplicate attendance for same student same day
            check = DBService.query("SELECT student_id FROM attendance WHERE student_id=%s AND date=CURDATE()", (result['student_id'],))
            if not check:
                DBService.query(
                    "INSERT INTO attendance (student_id, date, status, time) VALUES (%s, CURDATE(), 'present', CURTIME())",
                    (result['student_id'],), fetch=False
                )
                
                # Module 10: Trigger SMS on Face auth
                TwilioService.send_attendance_alert(result['student_id'], 'present')
                
                result['attendance_marked'] = True
                result['message'] += ' & Attendance Marked!'
            else:
                result['attendance_marked'] = False
                result['message'] += '. Student already marked present today.'
        except Exception as e:
            result['attendance_marked'] = False 
            result['message'] = str(e)

    return jsonify(result)
