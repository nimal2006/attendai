-- 🔥 CREATE DATABASE
CREATE DATABASE IF NOT EXISTS attendance_system;
USE attendance_system;

-- 👤 USERS
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(255),
    role ENUM('admin', 'teacher', 'parent'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 🏫 SCHOOLS
CREATE TABLE schools (
    school_id INT AUTO_INCREMENT PRIMARY KEY,
    school_name VARCHAR(100),
    location VARCHAR(100)
);

-- 👨🏫 TEACHERS
CREATE TABLE teachers (
    teacher_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    subject VARCHAR(100),
    school_id INT,
    user_id INT,
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 👤 STUDENTS
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    class VARCHAR(20),
    section VARCHAR(10),
    school_id INT,
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE
);

-- 👨👩👧 PARENTS
CREATE TABLE parents (
    parent_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    phone VARCHAR(15),
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 🔗 PARENT-STUDENT RELATION
CREATE TABLE parent_student (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT,
    student_id INT,
    FOREIGN KEY (parent_id) REFERENCES parents(parent_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 📸 FACE DATA
CREATE TABLE face_data (
    face_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    face_encoding BLOB,
    image_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 📅 ATTENDANCE
CREATE TABLE attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    date DATE,
    status ENUM('Present', 'Absent', 'Late', 'Leave'),
    time TIME,
    UNIQUE(student_id, date),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 📊 MARKS
CREATE TABLE marks (
    mark_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    subject VARCHAR(100),
    exam_type VARCHAR(50),
    marks INT,
    total_marks INT,
    date DATE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 📩 LEAVE REQUESTS
CREATE TABLE leave_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    from_date DATE,
    to_date DATE,
    reason TEXT,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    requested_by VARCHAR(20),
    approved_by VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 🚨 ALERTS
CREATE TABLE alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    message TEXT,
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 🛡️ SUSPICIOUS LOGS (ANTI-CHEAT)
CREATE TABLE suspicious_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    reason VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 📊 MARKS / GRADES
CREATE TABLE IF NOT EXISTS marks (
    mark_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    subject VARCHAR(100),
    marks INT,
    total_marks INT DEFAULT 100,
    exam_type VARCHAR(50),
    date DATE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 📱 SMS LOGS
CREATE TABLE IF NOT EXISTS sms_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20),
    event_type VARCHAR(50),
    message TEXT,
    sms_status VARCHAR(20) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 👨‍👩‍👧 PARENT-STUDENT LINKING
CREATE TABLE IF NOT EXISTS parent_student (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT,
    student_id INT,
    FOREIGN KEY (parent_id) REFERENCES parents(parent_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 👁️ RECOGNITION LOGS
CREATE TABLE IF NOT EXISTS recognition_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    method VARCHAR(50),
    confidence DOUBLE,
    result VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 🔥 SAMPLE DATA (OPTIONAL)

INSERT INTO schools (school_name, location)
VALUES ('Rural Govt School', 'Tamil Nadu');

INSERT INTO users (username, password, role)
VALUES 
('admin1', 'hashed_password', 'admin'),
('teacher1', 'hashed_password', 'teacher'),
('parent1', 'hashed_password', 'parent');
