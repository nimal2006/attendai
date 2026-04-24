document.addEventListener('DOMContentLoaded', () => {
    // ═══════════════════════════════════════════
    // 1. AUTH GUARD
    // ═══════════════════════════════════════════
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
        window.location.href = '/';
        return;
    }
    const sidebarUserName = document.getElementById('sidebarUserName');
    if (sidebarUserName) sidebarUserName.textContent = user.username || 'Admin User';

    // ═══════════════════════════════════════════
    // 2. SPA NAVIGATION (GSAP)
    // ═══════════════════════════════════════════
    const navLinks = document.querySelectorAll('.nav-item');
    const viewTitle = document.getElementById('currentViewTitle');
    let isAnimating = false;

    function navigateTo(targetId) {
        if (isAnimating) return;
        const currentActive = document.querySelector('.view-section.active');
        if (currentActive && currentActive.id === targetId) return;

        navLinks.forEach(l => l.classList.remove('active'));
        const targetLink = document.querySelector(`[data-target="${targetId}"]`);
        if (targetLink) {
            targetLink.classList.add('active');
            viewTitle.textContent = targetLink.textContent.trim();
        }

        isAnimating = true;
        const nextView = document.getElementById(targetId);
        const tl = gsap.timeline({ onComplete: () => isAnimating = false });

        if (currentActive) {
            tl.to(currentActive, { opacity: 0, y: 15, duration: 0.15, onComplete: () => currentActive.classList.remove('active') });
        }
        tl.call(() => nextView.classList.add('active'));
        tl.fromTo(nextView, { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.2 });

        // Tab-specific data fetching
        if (targetId === 'view-students') fetchStudents();
        if (targetId === 'view-teachers') fetchTeachers();
        if (targetId === 'view-parents') { fetchParents(); fetchStudents(); }
        if (targetId === 'view-attendance') { fetchAttendance(); populateStudentDropdowns(); }
        if (targetId === 'view-academic') populateStudentDropdowns();
        if (targetId === 'view-sms') fetchSmsLogs();
        if (targetId === 'view-alerts') fetchNotifications();
        if (targetId === 'view-esp32lcd') populateLcdDropdown();
        if (targetId === 'view-esp32cam') loadSavedESP32CamIP();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => navigateTo(link.getAttribute('data-target')));
    });

    // Quick Actions buttons
    document.querySelectorAll('.action-card[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
    });

    // ═══════════════════════════════════════════
    // 3. THEME TOGGLE
    // ═══════════════════════════════════════════
    const themeToggle = document.getElementById('checkbox');
    if (themeToggle) {
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('light-theme', e.target.checked);
            localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
        });
    }

    // ═══════════════════════════════════════════
    // 4. SIDEBAR TOGGLE (MOBILE)
    // ═══════════════════════════════════════════
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }

    // ═══════════════════════════════════════════
    // 5. NETWORK STATUS
    // ═══════════════════════════════════════════
    const networkStatus = document.getElementById('networkStatus');
    const networkText = document.getElementById('networkText');

    function updateNetworkStatus() {
        if (navigator.onLine) {
            networkStatus.className = 'status-pill';
            networkText.textContent = 'Online';
            forceSync();
        } else {
            networkStatus.className = 'status-pill offline';
            networkText.textContent = 'Offline';
            loadFromCache();
        }
    }
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    // ═══════════════════════════════════════════
    // 6. VOICE CONTROL
    // ═══════════════════════════════════════════
    setupVoiceControl();

    // ═══════════════════════════════════════════
    // 7. STUDENT SEARCH
    // ═══════════════════════════════════════════
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('#studentTableBody tr').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(q) ? '' : 'none';
            });
        });
    }

    // ═══════════════════════════════════════════
    // 8. ATTENDANCE DATE BADGE
    // ═══════════════════════════════════════════
    const attDateBadge = document.getElementById('attDateBadge');
    if (attDateBadge) attDateBadge.textContent = new Date().toLocaleDateString();

    // ═══════════════════════════════════════════
    // 9. DASHBOARD CHARTS
    // ═══════════════════════════════════════════
    initDashboardCharts();
});

// ═══════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════
function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ═══════════════════════════════════════════════
// DATA SYNC
// ═══════════════════════════════════════════════
async function forceSync() {
    if (!navigator.onLine) return showToast('Cannot sync while offline.', 'error');
    try {
        const statsRes = await fetch('/api/data/stats/admin');
        const statsData = await statsRes.json();
        if (statsData.success) {
            localStorage.setItem('admin_stats_cache', JSON.stringify(statsData));
            renderDashboard(statsData);
        }
        await fetchStudents();
        await fetchTeachers();
        await fetchParents();
        const networkText = document.getElementById('networkText');
        networkText.textContent = 'Synced';
        setTimeout(() => { if (navigator.onLine) networkText.textContent = 'Online'; }, 2500);
    } catch (err) {
        console.error('Sync failed:', err);
    }
}

function loadFromCache() {
    const c1 = localStorage.getItem('admin_stats_cache');
    if (c1) renderDashboard(JSON.parse(c1));
    const c2 = localStorage.getItem('admin_students_cache');
    if (c2) renderStudents(JSON.parse(c2));
    const c3 = localStorage.getItem('admin_teachers_cache');
    if (c3) renderTeachers(JSON.parse(c3));
    const c4 = localStorage.getItem('admin_parents_cache');
    if (c4) renderParents(JSON.parse(c4));
}

// ═══════════════════════════════════════════════
// RENDER: DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard(data) {
    document.getElementById('kp_students').textContent = data.stats.total_students;
    document.getElementById('kp_att').textContent = data.stats.attendance_pct + '%';
    document.getElementById('kp_perf').textContent = data.stats.avg_performance + '%';
    document.getElementById('kp_risk').textContent = data.stats.risk_count;

    // At-Risk Table
    const riskTable = document.getElementById('riskTableBody');
    if (riskTable) {
        riskTable.innerHTML = '';
        if (data.stats.at_risk_list && data.stats.at_risk_list.length > 0) {
            data.stats.at_risk_list.forEach(s => {
                riskTable.innerHTML += `<tr>
                    <td>${s.id}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.class}</td>
                    <td><span class="badge ${s.attendance_pct < 75 ? 'badge-absent' : 'badge-late'}">${s.attendance_pct}%</span></td>
                    <td><span class="badge ${s.avg_marks < 50 ? 'badge-absent' : 'badge-late'}">${s.avg_marks}%</span></td>
                    <td><button class="btn-outline" style="padding:4px 12px;font-size:0.75rem;" onclick="showToast('Intervention alert dispatched','info')"><i class="fas fa-bell"></i> Alert</button></td>
                </tr>`;
            });
        } else {
            riskTable.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--success);"><i class="fas fa-check-circle"></i> All students performing well</td></tr>`;
        }
    }

    // Anti-Cheat Logs
    const logsTable = document.getElementById('antiCheatLogs');
    if (logsTable) {
        logsTable.innerHTML = '';
        if (data.logs && data.logs.length > 0) {
            data.logs.forEach(log => {
                logsTable.innerHTML += `<tr>
                    <td>${new Date(log.attempt_timestamp).toLocaleString()}</td>
                    <td style="color:var(--danger)">${log.reason}</td>
                    <td><span class="badge badge-pending">Review</span></td>
                </tr>`;
            });
        } else {
            logsTable.innerHTML = `<tr><td colspan="3" class="empty-state">No suspicious activities logged.</td></tr>`;
        }
    }
}

// ═══════════════════════════════════════════════
// FETCH & RENDER: STUDENTS
// ═══════════════════════════════════════════════
async function fetchStudents() {
    if (!navigator.onLine) return;
    try {
        const res = await fetch('/api/data/students');
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('admin_students_cache', JSON.stringify(data.students));
            renderStudents(data.students);
        }
    } catch (e) { console.error(e); }
}

function renderStudents(arr) {
    const tb = document.getElementById('studentTableBody');
    const linkSel = document.getElementById('linkStudentSelect');
    const attSel = document.getElementById('attStudentSelect');
    const marksSel = document.getElementById('marksStudentSelect');

    if (tb) {
        tb.innerHTML = '';
        arr.forEach(s => {
            const sid = s.student_id || s.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sid}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.roll_number || '-'}</td>
                <td>${s.class}</td>
                <td>
                    <button class="btn-outline del-student-btn" style="padding:3px 10px;font-size:0.7rem;color:var(--danger);border-color:var(--danger);" data-id="${sid}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            const delBtn = tr.querySelector('.del-student-btn');
            delBtn.addEventListener('click', () => deleteStudent(sid));
            tb.appendChild(tr);
        });
    }

    // Populate dropdowns
    [linkSel, attSel, marksSel].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">Select Student...</option>';
        arr.forEach(s => {
            sel.innerHTML += `<option value="${s.student_id || s.id}">${s.name} (${s.student_id || s.id})</option>`;
        });
    });
}

async function deleteStudent(id) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
        const res = await fetch(`/api/data/students/${id}`, { method: 'DELETE' });
        const data = await res.json();
        showToast(data.message, data.success ? 'success' : 'error');
        if (data.success) fetchStudents();
    } catch (e) { showToast('Delete failed', 'error'); }
}

// ═══════════════════════════════════════════════
// FETCH & RENDER: TEACHERS
// ═══════════════════════════════════════════════
async function fetchTeachers() {
    if (!navigator.onLine) return;
    try {
        const res = await fetch('/api/entity/teachers');
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('admin_teachers_cache', JSON.stringify(data.teachers));
            renderTeachers(data.teachers);
        }
    } catch (e) { console.error(e); }
}

function renderTeachers(arr) {
    const tb = document.getElementById('teacherTableBody');
    if (!tb) return;
    tb.innerHTML = '';
    arr.forEach(t => {
        const tid = t.teacher_id;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tid}</td>
            <td><strong>${t.name}</strong></td>
            <td>${t.subject}</td>
            <td>
                <button class="btn-outline del-teacher-btn" style="padding:3px 10px;font-size:0.7rem;color:var(--danger);border-color:var(--danger);" data-id="${tid}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        const delBtn = tr.querySelector('.del-teacher-btn');
        delBtn.addEventListener('click', () => deleteTeacher(tid));
        tb.appendChild(tr);
    });
}

async function deleteTeacher(id) {
    if (!confirm('Remove this teacher?')) return;
    try {
        const res = await fetch(`/api/entity/teachers/${id}`, { method: 'DELETE' });
        const data = await res.json();
        showToast(data.message, data.success ? 'success' : 'error');
        if (data.success) fetchTeachers();
    } catch (e) { showToast('Delete failed', 'error'); }
}

// ═══════════════════════════════════════════════
// FETCH & RENDER: PARENTS
// ═══════════════════════════════════════════════
async function fetchParents() {
    if (!navigator.onLine) return;
    try {
        const res = await fetch('/api/entity/parents');
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('admin_parents_cache', JSON.stringify(data.parents));
            renderParents(data.parents);
        }
    } catch (e) { console.error(e); }
}

function renderParents(arr) {
    const sel = document.getElementById('linkParentSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Guardian...</option>';
    arr.forEach(p => {
        sel.innerHTML += `<option value="${p.parent_id}">${p.name} — ${p.phone}</option>`;
    });
}

// ═══════════════════════════════════════════════
// FETCH & RENDER: ATTENDANCE
// ═══════════════════════════════════════════════
async function fetchAttendance() {
    try {
        const res = await fetch('/api/data/attendance/today');
        const data = await res.json();
        const tb = document.getElementById('attendanceTableBody');
        if (!tb) return;
        if (data.success && data.records && data.records.length > 0) {
            tb.innerHTML = '';
            data.records.forEach(r => {
                const statusBadge = r.status === 'Present' ? 'badge-present' :
                                    r.status === 'Absent' ? 'badge-absent' :
                                    r.status === 'Late' ? 'badge-late' : 'badge-pending';
                tb.innerHTML += `<tr>
                    <td>${r.student_id}</td>
                    <td>${r.student_name || '-'}</td>
                    <td>${r.class || '-'}</td>
                    <td><span class="badge ${statusBadge}">${r.status}</span></td>
                    <td>-</td>
                    <td>${r.time || '-'}</td>
                </tr>`;
            });
        } else {
            tb.innerHTML = '<tr><td colspan="6" class="empty-state">No attendance records for today</td></tr>';
        }
    } catch (e) {
        console.error(e);
    }
}

async function populateStudentDropdowns() {
    let cached = localStorage.getItem('admin_students_cache');
    if (!cached) {
        // Fetch fresh if cache is empty
        try {
            const res = await fetch('/api/data/students');
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('admin_students_cache', JSON.stringify(data.students));
                cached = JSON.stringify(data.students);
            }
        } catch (e) { console.error('Failed to fetch students for dropdowns:', e); }
    }
    if (cached) renderStudents(JSON.parse(cached));
}

// ═══════════════════════════════════════════════
// FETCH: SMS LOGS
// ═══════════════════════════════════════════════
async function fetchSmsLogs() {
    try {
        const res = await fetch('/api/data/sms/logs');
        const data = await res.json();
        const tb = document.getElementById('smsLogTable');
        if (!tb) return;
        if (data.success && data.logs && data.logs.length > 0) {
            tb.innerHTML = '';
            data.logs.forEach(l => {
                const badge = l.sms_status === 'Sent' ? 'badge-sent' :
                              l.sms_status === 'Failed' ? 'badge-failed' : 'badge-skipped';
                tb.innerHTML += `<tr>
                    <td>${l.phone || '-'}</td>
                    <td>${l.event_type || '-'}</td>
                    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.message || '-'}</td>
                    <td><span class="badge ${badge}">${l.sms_status}</span></td>
                </tr>`;
            });
        } else {
            tb.innerHTML = '<tr><td colspan="4" class="empty-state">No SMS logs available</td></tr>';
        }
    } catch (e) { console.error(e); }
}

// ═══════════════════════════════════════════════
// FETCH: NOTIFICATIONS
// ═══════════════════════════════════════════════
async function fetchNotifications() {
    try {
        const res = await fetch('/api/data/notifications');
        const data = await res.json();
        const container = document.getElementById('alertsList');
        if (!container) return;
        container.innerHTML = '';
        if (data.success && data.notifications && data.notifications.length > 0) {
            data.notifications.forEach(n => {
                container.innerHTML += `<div class="alert-item alert-warning"><i class="fas fa-exclamation-triangle"></i><span>${n.msg} — ${new Date(n.time).toLocaleString()}</span></div>`;
            });
        } else {
            container.innerHTML = '<div class="alert-item alert-success"><i class="fas fa-check-circle"></i><span>All systems normal. No alerts.</span></div>';
        }
    } catch (e) { console.error(e); }
}

// ═══════════════════════════════════════════════
// FORM BINDINGS — UNIVERSAL HELPER
// ═══════════════════════════════════════════════
function bindForm(formId, endpoint, mapper, refreshCb) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!navigator.onLine) return showToast('System offline.', 'error');
        const payload = mapper();
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
                e.target.reset();
                if (refreshCb) refreshCb();
            } else {
                showToast('Error: ' + data.message, 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });
}

// Bind all forms
bindForm('addStudentForm', '/api/data/students/add', () => ({
    name: document.getElementById('stuName').value,
    roll_number: document.getElementById('stuRoll').value,
    class_name: document.getElementById('stuClass').value
}), fetchStudents);

bindForm('addTeacherForm', '/api/entity/teachers', () => ({
    name: document.getElementById('teacherName').value,
    subject: document.getElementById('teacherSubject').value,
    school_id: 1
}), fetchTeachers);

bindForm('addParentForm', '/api/entity/parents', () => ({
    name: document.getElementById('parentName').value,
    phone: document.getElementById('parentPhone').value
}), fetchParents);

bindForm('linkParentForm', '/api/entity/parents/link', () => ({
    parent_id: document.getElementById('linkParentSelect').value,
    student_id: document.getElementById('linkStudentSelect').value
}), null);

bindForm('markAttendanceForm', '/api/data/attendance/mark', () => ({
    student_id: document.getElementById('attStudentSelect').value,
    status: document.getElementById('attStatus').value
}), fetchAttendance);

bindForm('addMarksForm', '/api/data/marks/add', () => ({
    student_id: document.getElementById('marksStudentSelect').value,
    subject: document.getElementById('marksSubject').value,
    marks: document.getElementById('marksObtained').value,
    total_marks: document.getElementById('marksTotal').value,
    exam_type: document.getElementById('marksExamType').value
}), null);

bindForm('smsBroadcastForm', '/api/data/comms/sms/broadcast', () => ({
    target: document.getElementById('smsTarget').value,
    message: document.getElementById('smsMessage').value
}), fetchSmsLogs);

// ═══════════════════════════════════════════════
// CAMERA (FACE REG)
// ═══════════════════════════════════════════════
let hwStream = null;
const startRegCam = document.getElementById('startRegCam');
if (startRegCam) {
    startRegCam.addEventListener('click', async () => {
        const video = document.getElementById('regVideo');
        const placeholder = document.getElementById('camPlaceholder');
        const captureBtn = document.getElementById('captureFaceBtn');

        if (!hwStream) {
            try {
                hwStream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = hwStream;
                placeholder.style.display = 'none';
                video.style.display = 'block';
                captureBtn.style.display = 'inline-flex';
                startRegCam.innerHTML = '<i class="fas fa-stop"></i> Stop Camera';
            } catch (e) { showToast('Camera access denied', 'error'); }
        } else {
            hwStream.getTracks().forEach(t => t.stop());
            hwStream = null;
            video.style.display = 'none';
            placeholder.style.display = 'flex';
            captureBtn.style.display = 'none';
            startRegCam.innerHTML = '<i class="fas fa-video"></i> Open Camera';
        }
    });
}

// Capture face and send for encoding
const captureFaceBtn = document.getElementById('captureFaceBtn');
if (captureFaceBtn) {
    captureFaceBtn.addEventListener('click', async () => {
        const video = document.getElementById('regVideo');
        const studentId = document.getElementById('targetStuID').value;
        const msgEl = document.getElementById('faceRegMsg');

        if (!studentId) {
            showToast('Enter a Student ID first', 'error');
            return;
        }
        if (!hwStream) {
            showToast('Start the camera first', 'error');
            return;
        }

        msgEl.textContent = 'Capturing frames for encoding...';
        msgEl.style.color = 'var(--primary)';

        // Capture 3 frames from the video with a small delay between each
        const frames = [];
        for (let i = 0; i < 3; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            frames.push(canvas.toDataURL('image/jpeg'));
            await new Promise(r => setTimeout(r, 400));
        }

        msgEl.textContent = 'Sending to face encoding API...';

        try {
            const res = await fetch('/api/face/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, images: frames })
            });
            const data = await res.json();
            if (data.success) {
                msgEl.textContent = data.message;
                msgEl.style.color = 'var(--success)';
                showToast(data.message, 'success');
            } else {
                msgEl.textContent = data.message;
                msgEl.style.color = 'var(--danger)';
                showToast(data.message, 'error');
            }
        } catch (err) {
            msgEl.textContent = 'Network error during encoding';
            msgEl.style.color = 'var(--danger)';
            showToast('Face encoding failed: ' + err.message, 'error');
        }
    });
}

// ═══════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/';
}

// ═══════════════════════════════════════════════
// VOICE CONTROL
// ═══════════════════════════════════════════════
function setupVoiceControl() {
    const micBtn = document.getElementById('micBtn');
    if (!micBtn) return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        micBtn.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    let isListening = false;

    micBtn.addEventListener('click', () => {
        if (!isListening) {
            recognition.start();
            micBtn.classList.add('listening');
        } else {
            recognition.stop();
        }
    });

    recognition.onstart = () => { isListening = true; };

    recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
    };

    recognition.onresult = (event) => {
        const cmd = event.results[0][0].transcript.toLowerCase();
        showToast(`Voice: "${cmd}"`, 'info');

        const routes = {
            'dashboard': 'view-dashboard', 'home': 'view-dashboard',
            'student': 'view-students', 'students': 'view-students',
            'teacher': 'view-teachers', 'teachers': 'view-teachers',
            'parent': 'view-parents', 'parents': 'view-parents',
            'attendance': 'view-attendance',
            'academic': 'view-academic', 'marks': 'view-academic',
            'face': 'view-face-reg', 'camera': 'view-face-reg',
            'alert': 'view-alerts', 'sms': 'view-sms',
            'report': 'view-reports', 'setting': 'view-settings'
        };

        for (const [keyword, target] of Object.entries(routes)) {
            if (cmd.includes(keyword)) {
                const link = document.querySelector(`[data-target="${target}"]`);
                if (link) link.click();
                return;
            }
        }
        showToast('Command not recognized', 'error');
    };
}

// ═══════════════════════════════════════════════
// DASHBOARD CHARTS
// ═══════════════════════════════════════════════
function initDashboardCharts() {
    // Weekly Attendance Chart
    const weeklyCtx = document.getElementById('weeklyAttChart');
    if (weeklyCtx) {
        new Chart(weeklyCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    label: 'Present',
                    data: [42, 39, 44, 41, 38, 30],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981'
                }, {
                    label: 'Absent',
                    data: [3, 6, 1, 4, 7, 2],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#ef4444'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#8b95a5', font: { family: 'Inter', size: 11 } } } },
                scales: {
                    x: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } },
                    y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } }
                }
            }
        });
    }

    // Status Pie Chart
    const pieCtx = document.getElementById('statusPieChart');
    if (pieCtx) {
        new Chart(pieCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent', 'Late'],
                datasets: [{
                    data: [85, 10, 5],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#8b95a5', font: { family: 'Inter', size: 11 }, padding: 16 } } },
                cutout: '65%'
            }
        });
    }

    // Academic bar chart
    const gradeCtx = document.getElementById('gradeChart');
    if (gradeCtx) {
        new Chart(gradeCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Physics', 'Math', 'Chemistry', 'English', 'Computer Sci'],
                datasets: [{
                    label: 'Class Averages',
                    data: [72, 85, 78, 90, 88],
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#8b95a5', font: { family: 'Inter', size: 11 } } } },
                scales: {
                    x: { ticks: { color: '#5a6577' }, grid: { display: false } },
                    y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' }, beginAtZero: true, max: 100 }
                }
            }
        });
    }
}

// ═══════════════════════════════════════════════
// ESP32-CAM FUNCTIONS
// ═══════════════════════════════════════════════
let esp32CamConnected = false;

function loadSavedESP32CamIP() {
    const savedIP = localStorage.getItem('esp32_cam_ip');
    const savedPort = localStorage.getItem('esp32_cam_port');
    if (savedIP) document.getElementById('esp32CamIP').value = savedIP;
    if (savedPort) document.getElementById('esp32CamPort').value = savedPort;
}

function connectESP32Cam() {
    const ip = document.getElementById('esp32CamIP').value.trim();
    const port = document.getElementById('esp32CamPort').value.trim() || '81';
    if (!ip) return showToast('Enter ESP32-CAM IP address', 'error');

    const streamUrl = `http://${ip}:${port}/stream`;
    const streamImg = document.getElementById('esp32CamStream');
    const placeholder = document.getElementById('esp32CamPlaceholder');
    const statusBadge = document.getElementById('esp32camStatus');
    const container = document.getElementById('esp32StreamContainer');
    const captureBtn = document.getElementById('esp32CamCapture');

    // Save for persistence
    localStorage.setItem('esp32_cam_ip', ip);
    localStorage.setItem('esp32_cam_port', port);

    if (esp32CamConnected) {
        // Disconnect
        streamImg.src = '';
        streamImg.style.display = 'none';
        placeholder.style.display = 'flex';
        container.classList.remove('connected');
        statusBadge.textContent = 'Disconnected';
        statusBadge.className = 'badge badge-pending';
        captureBtn.disabled = true;
        document.getElementById('connectEsp32Cam').innerHTML = '<i class="fas fa-plug"></i> Connect';
        esp32CamConnected = false;
        showToast('ESP32-CAM disconnected', 'info');
        return;
    }

    // Connect
    showToast(`Connecting to ESP32-CAM at ${ip}:${port}...`, 'info');
    streamImg.src = streamUrl;
    streamImg.style.display = 'block';
    placeholder.style.display = 'none';
    container.classList.add('connected');
    statusBadge.textContent = 'Connected';
    statusBadge.className = 'badge badge-present';
    captureBtn.disabled = false;
    document.getElementById('connectEsp32Cam').innerHTML = '<i class="fas fa-stop"></i> Disconnect';
    esp32CamConnected = true;

    streamImg.onerror = () => {
        showToast('ESP32-CAM stream failed. Check IP and port.', 'error');
        streamImg.style.display = 'none';
        placeholder.style.display = 'flex';
        container.classList.remove('connected');
        statusBadge.textContent = 'Error';
        statusBadge.className = 'badge badge-absent';
        captureBtn.disabled = true;
        esp32CamConnected = false;
        document.getElementById('connectEsp32Cam').innerHTML = '<i class="fas fa-plug"></i> Connect';
    };
}

function captureESP32Frame() {
    const ip = document.getElementById('esp32CamIP').value.trim();
    if (!ip) return;
    const captureUrl = `http://${ip}/capture`;
    showToast('Capturing frame from ESP32-CAM...', 'info');
    // The ESP32-CAM /capture endpoint returns a JPEG image
    // We can use it directly for face recognition
    fetch(captureUrl)
        .then(r => r.blob())
        .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
                showToast('Frame captured! Sending for face recognition...', 'success');
                // Send to face rec API
                fetch('/api/face/recognize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frames: [reader.result], auto_mark: true })
                }).then(r => r.json()).then(d => {
                    if (d.success && d.matched) showToast(`Recognized: ${d.student_name} — Marked Present`, 'success');
                    else showToast('Face not recognized', 'error');
                }).catch(() => showToast('Recognition API error', 'error'));
            };
            reader.readAsDataURL(blob);
        })
        .catch(() => showToast('ESP32-CAM capture failed. Check connection.', 'error'));
}

// ═══════════════════════════════════════════════
// ESP32 LCD FUNCTIONS
// ═══════════════════════════════════════════════
function connectESP32LCD() {
    const ip = document.getElementById('esp32LcdIP').value.trim();
    const port = document.getElementById('esp32LcdPort').value.trim() || '80';
    if (!ip) return showToast('Enter ESP32 LCD IP address', 'error');

    localStorage.setItem('esp32_lcd_ip', ip);
    localStorage.setItem('esp32_lcd_port', port);

    const statusBadge = document.getElementById('esp32lcdStatus');

    // Ping the ESP32 to test connection
    showToast(`Testing connection to ESP32 LCD at ${ip}:${port}...`, 'info');

    // Try fetching to see if device responds (will likely fail due to CORS, but we save the IP)
    fetch(`http://${ip}:${port}/`, { mode: 'no-cors', signal: AbortSignal.timeout(3000) })
        .then(() => {
            statusBadge.textContent = 'Connected';
            statusBadge.className = 'badge badge-present';
            showToast('ESP32 LCD connected! It will poll /api/hw/esp32/attendance for data.', 'success');
        })
        .catch(() => {
            // Even if CORS blocks, the IP is saved
            statusBadge.textContent = 'IP Saved';
            statusBadge.className = 'badge badge-sent';
            showToast(`ESP32 LCD IP saved (${ip}). Configure the ESP32 to poll this server.`, 'info');
        });
}

function populateLcdDropdown() {
    const cached = localStorage.getItem('admin_students_cache');
    const sel = document.getElementById('lcdStudentSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select student...</option>';
    if (cached) {
        JSON.parse(cached).forEach(s => {
            sel.innerHTML += `<option value="${s.student_id || s.id}" data-name="${s.name}">${s.name} (${s.student_id || s.id})</option>`;
        });
    }
}

// Push to LCD Form
const pushForm = document.getElementById('pushToLcdForm');
if (pushForm) {
    pushForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sel = document.getElementById('lcdStudentSelect');
        const studentId = sel.value;
        const studentName = sel.options[sel.selectedIndex]?.dataset?.name || 'Unknown';
        const status = document.getElementById('lcdStatusSelect').value;
        const ip = localStorage.getItem('esp32_lcd_ip');
        const port = localStorage.getItem('esp32_lcd_port') || '80';

        if (!studentId) return showToast('Select a student', 'error');

        // 1. Save the data to the server API (so ESP32 can poll it)
        try {
            await fetch('/api/hw/esp32/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, name: studentName, status: status })
            });
            showToast(`Pushed: ${studentName} → ${status}`, 'success');
        } catch (err) {
            showToast('Push failed', 'error');
        }

        // 2. Also try to push directly to ESP32 if IP is available
        if (ip) {
            try {
                await fetch(`http://${ip}:${port}/display?name=${encodeURIComponent(studentName)}&status=${encodeURIComponent(status)}`, { mode: 'no-cors' });
            } catch (e) { /* CORS may block, that's okay — ESP32 polls the server */ }
        }
    });
}
