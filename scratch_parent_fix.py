
from services.db_service import DBService

def run_fix():
    print("Starting final database linkage patch...")
    
    # 1. Ensure user 'parent1' exists and get ID
    user = DBService.query("SELECT user_id FROM users WHERE username='parent1' LIMIT 1")
    if not user:
        print("Creating missing user 'parent1'...")
        DBService.query("INSERT INTO users (username, password, role) VALUES ('parent1', 'parent123', 'parent')", fetch=False)
        user = DBService.query("SELECT user_id FROM users WHERE username='parent1'")
    
    uid = user[0]['user_id']

    # 2. Link to a Parent profile
    parent = DBService.query("SELECT parent_id FROM parents WHERE user_id=%s", (uid,))
    if not parent:
        print("Creating parent profile for user...")
        DBService.query("INSERT INTO parents (name, phone, user_id) VALUES ('Guardian One', '9876543210', %s)", (uid,), fetch=False)
        parent = DBService.query("SELECT parent_id FROM parents WHERE user_id=%s", (uid,))
    
    pid = parent[0]['parent_id']

    # 3. Find the student 'Arun Kumar'
    student = DBService.query("SELECT student_id, name FROM students WHERE name='Arun Kumar' LIMIT 1")
    if not student:
        print("Student Arun Kumar not found. Creating student...")
        DBService.query("INSERT INTO students (name, class, roll_number, section, school_id) VALUES ('Arun Kumar', '10-A', 'S001', 'A', 1)", fetch=False)
        student = DBService.query("SELECT student_id FROM students WHERE name='Arun Kumar' LIMIT 1")

    sid = student[0]['student_id']

    # 4. Create the final link
    DBService.query("INSERT IGNORE INTO parent_student (parent_id, student_id) VALUES (%s, %s)", (pid, sid), fetch=False)
    
    # 5. Add some fresh attendance for today so it doesn't show 'Loading'
    DBService.query("INSERT IGNORE INTO attendance (student_id, status, date, time) VALUES (%s, 'Present', CURDATE(), CURTIME())", (sid,), fetch=False)

    print(f"PATCH SUCCESSFUL: User parent1 (uid:{uid}) is now linked to Student Arun Kumar (sid:{sid})")

if __name__ == "__main__":
    run_fix()
