import csv
from io import StringIO
from flask import Blueprint, jsonify, Response
from services.db_service import DBService

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/bi/export', methods=['GET'])
def export_cognos_dataset():
    """
    Exports a comprehensive dataset for Cognos Dashboard BI analysis.
    Fields: student_id, name, class, attendance_percentage, avg_marks, leave_count, risk_flag
    """
    query = """
        SELECT 
            s.id AS student_id,
            s.name,
            s.class,
            (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status IN ('present', 'late')) * 100.0 / 
                NULLIF((SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 0) AS attendance_percentage,
            (SELECT AVG((marks_obtained / total_marks) * 100) FROM marks WHERE student_id = s.id) AS avg_marks,
            (SELECT COUNT(*) FROM leave_requests WHERE student_id = s.id AND status = 'approved') AS leave_count
        FROM students s
    """
    rows = DBService.query(query)

    # Generate CSV in memory
    def generate_csv():
        output = StringIO()
        writer = csv.writer(output)
        # Header
        writer.writerow(['student_id', 'student_name', 'class', 'attendance_percentage', 'avg_marks', 'leave_count', 'risk_flag'])
        
        for r in rows:
            att_pct = r['attendance_percentage'] or 0.0
            avg_m = r['avg_marks'] or 0.0
            leave_c = r['leave_count'] or 0
            
            # Analytics Risk Flag Formulation
            risk_flag = 'High Risk' if (att_pct < 75.0 or avg_m < 40.0) else 'Low Risk'
            
            writer.writerow([r['student_id'], r['name'], r['class'], round(att_pct, 2), round(avg_m, 2), leave_c, risk_flag])
            
        return output.getvalue()

    return Response(
        generate_csv(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=attendance_bi_dataset.csv"}
    )
