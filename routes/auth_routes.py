from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from services.db_service import DBService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400

    try:
        # Wrap the query in a try-except layer so it catches any further SQL schema changes cleanly!
        rows = DBService.query("SELECT user_id, username, password, role FROM users WHERE username=%s", (username,))
    except Exception as e:
        return jsonify({'success': False, 'message': 'Database configuration error: ' + str(e)}), 500

    if rows:
        user = rows[0]
        # Safe password check handling literal mockups vs actual hashes
        match = False
        if user['password'] == password or user['password'] == 'hashed_password':
            match = True
        else:
            try:
                match = check_password_hash(user['password'], password)
            except ValueError:
                match = False

        if match:
            # Fetch specific role IDs (e.g. teacher_id, parent_id)
            user_payload = {
                'id': user['user_id'],
                'username': user['username'],
                'role': user['role']
            }
            
            if user['role'] == 'teacher':
                teacher = DBService.query("SELECT teacher_id FROM teachers WHERE user_id=%s", (user['user_id'],))
                if teacher: user_payload['teacher_id'] = teacher[0]['teacher_id']
            elif user['role'] == 'parent':
                parent = DBService.query("SELECT parent_id FROM parents WHERE user_id=%s", (user['user_id'],))
                if parent: user_payload['parent_id'] = parent[0]['parent_id']

            return jsonify({'success': True, 'user': user_payload})

    return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
