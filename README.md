# EduTrack — AI Attendance & Student Management System

A working prototype of an AI-powered attendance and student management system built with Flask, MySQL, and OpenCV face recognition.

---

## Project Structure

```
attendance_system/
├── app.py                  # Flask backend (all APIs)
├── requirements.txt        # Python dependencies
├── setup_db.sql            # Manual MySQL setup script
├── README.md
└── templates/
    ├── login.html          # Login page
    ├── admin.html          # Admin dashboard
    └── attendance.html     # Face recognition page
```

---

## Quick Start

### 1. Prerequisites

- Python 3.9+
- MySQL Server running
- (Optional) Webcam for face recognition

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure MySQL

Edit `app.py` (lines 22-28) to match your MySQL credentials:

```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',       # ← Your MySQL user
    'password': '',       # ← Your MySQL password
    'database': 'attendance_system',
}
```

Or run the SQL setup manually:
```bash
mysql -u root -p < setup_db.sql
```

### 4. (Optional) Enable Face Recognition

Install face recognition libraries:
```bash
# macOS / Linux
pip install cmake dlib face_recognition opencv-python

# Windows: install CMake first from https://cmake.org/download/
# Then: pip install dlib face_recognition opencv-python
```

Uncomment the optional lines in `requirements.txt`.

### 5. Run the app

```bash
python app.py
```

Visit: **http://localhost:5000**

---

## Login Credentials

| Username   | Password      | Role    |
|------------|---------------|---------|
| `admin`    | `admin123`    | Admin   |
| `teacher1` | `teacher123`  | Teacher |

---

## API Endpoints

### Auth
| Method | Endpoint  | Description       |
|--------|-----------|-------------------|
| POST   | /login    | Authenticate user |

### Students
| Method | Endpoint   | Description      |
|--------|------------|------------------|
| GET    | /students  | List all students |
| POST   | /students  | Add a student    |

### Attendance
| Method | Endpoint     | Description              |
|--------|--------------|--------------------------|
| GET    | /attendance  | Get records (filterable) |
| POST   | /attendance  | Mark attendance          |

### Marks
| Method | Endpoint | Description     |
|--------|----------|-----------------|
| GET    | /marks   | Get all marks   |
| POST   | /marks   | Add marks entry |

### Leave
| Method | Endpoint | Description               |
|--------|----------|---------------------------|
| GET    | /leave   | Get leave requests        |
| POST   | /leave   | Create leave request      |
| PUT    | /leave   | Approve/reject leave      |

### Face Recognition
| Method | Endpoint         | Description              |
|--------|------------------|--------------------------|
| POST   | /face/register   | Register student face    |
| POST   | /face/recognize  | Recognize face in image  |

### Stats
| Method | Endpoint | Description          |
|--------|----------|----------------------|
| GET    | /stats   | Dashboard statistics |

---

## Face Recognition Flow

1. **Register**: Go to Face Recognition page → Register Face tab → Select student → Capture
2. **Recognize**: Go to Face Recognition page → Start Camera → Capture → System matches and shows student
3. **Auto-mark**: Click "Mark Attendance" after recognition

> If `face_recognition` is not installed, the system runs in **demo mode** with simulated results.

---

## Extending the System

- **Add authentication middleware**: JWT tokens or Flask-Login sessions
- **Role-based views**: Teacher/parent portals
- **SMS/Email alerts**: Integrate Twilio/SendGrid for absent alerts
- **Analytics dashboard**: Charts with Chart.js or Plotly
- **Mobile app**: React Native frontend using the same REST APIs
- **Liveness detection**: Anti-spoofing via blink detection
- **Export reports**: PDF/Excel generation with ReportLab or openpyxl

---

## Notes

- Passwords are stored as plain text for prototype simplicity — use bcrypt in production
- No JWT auth — add Flask-JWT-Extended for production
- Face encodings stored as binary blobs — consider a vector DB (Milvus, Qdrant) for scale
