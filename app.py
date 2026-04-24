"""
AI-Based Automated Attendance and Student Management System
Flask Backend - app.py (Modular Entry Point)
"""
import os
from flask import Flask, send_from_directory
from flask_cors import CORS

# Import Blueprints
from routes.auth_routes import auth_bp
from routes.face_routes import face_bp
from routes.reports_routes import reports_bp
from routes.api_routes import api_bp
from routes.entity_routes import entity_bp
from routes.hw_routes import hw_bp

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'super_secret_attendance_key')
CORS(app)

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(face_bp, url_prefix='/api/face')
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(api_bp, url_prefix='/api/data')
app.register_blueprint(entity_bp, url_prefix='/api/entity')
app.register_blueprint(hw_bp, url_prefix='/api/hw')

# Optional placeholders for additional routes (admin, teacher, etc.)
# app.register_blueprint(admin_bp, url_prefix='/api/admin')
# app.register_blueprint(teacher_bp, url_prefix='/api/teacher')

# ─────────────────────────────────────────────
# Application Routing (Frontend Pages Delivery)
# ─────────────────────────────────────────────

@app.errorhandler(404)
def page_not_found(e):
    return send_from_directory('templates', '404.html'), 404

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@app.route('/admin-dashboard')
@app.route('/admin')
def admin_page():
    return send_from_directory('templates', 'admin.html')

@app.route('/teacher-dashboard')
def teacher_page():
    return send_from_directory('templates', 'teacher.html')

@app.route('/parent-dashboard')
def parent_page():
    return send_from_directory('templates', 'parent.html')

@app.route('/attendance')
def attendance_page():
    return send_from_directory('templates', 'attendance.html')

# ─────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────

if __name__ == '__main__':
    print("Booting Memory Subsystems...")
    try:
        from services.face_recognition_service import FaceCache
        FaceCache.load()
        print("Face Encodings Cache loaded successfully.")
    except Exception as e:
        print("Face Cache bypassed (Dev Mode / No Library):", e)

    print("Starting Premium AI Attendance System API on http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')
