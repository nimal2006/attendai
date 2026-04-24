
from services.db_service import DBService

def setup():
    # Link user 'parent1' (user_id 3) to parent 'Mr.Dilli' (parent_id 1)
    DBService.query('UPDATE parents SET user_id=3 WHERE parent_id=1', fetch=False)

    # Link student 'Arun Kumar' (student_id 4) to parent 'Mr.Dilli' (parent_id 1)
    DBService.query('INSERT IGNORE INTO parent_student (parent_id, student_id) VALUES (1, 4)', fetch=False)

    # Mark Arun Kumar as Present for Today
    DBService.query('INSERT INTO attendance (student_id, date, status, time) VALUES (4, CURDATE(), "Present", CURTIME()) ON DUPLICATE KEY UPDATE status="Present"', fetch=False)

    print('Parent setup complete.')

if __name__ == "__main__":
    setup()
