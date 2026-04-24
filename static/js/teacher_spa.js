document.addEventListener('DOMContentLoaded', () => {
    // Auth
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'teacher') { window.location.href = '/'; return; }
    const sn = document.getElementById('sidebarUserName');
    if (sn) sn.textContent = user.username || 'Instructor';

    // SPA Nav
    const navLinks = document.querySelectorAll('.nav-item');
    const viewTitle = document.getElementById('currentViewTitle');
    let isAnimating = false;

    function navigateTo(targetId) {
        if (isAnimating) return;
        const cur = document.querySelector('.view-section.active');
        if (cur && cur.id === targetId) return;
        navLinks.forEach(l => l.classList.remove('active'));
        const tl2 = document.querySelector(`[data-target="${targetId}"]`);
        if (tl2) { tl2.classList.add('active'); viewTitle.textContent = tl2.textContent.trim(); }
        isAnimating = true;
        const next = document.getElementById(targetId);
        const tl = gsap.timeline({ onComplete: () => isAnimating = false });
        if (cur) tl.to(cur, { opacity: 0, y: 15, duration: 0.15, onComplete: () => cur.classList.remove('active') });
        tl.call(() => next.classList.add('active'));
        tl.fromTo(next, { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.2 });
        if (targetId === 'view-calendar') renderCalendar();
        if (targetId === 'view-class') fetchClassRoster();
        if (targetId === 'view-leaves') fetchLeaveRequests();
        if (targetId === 'view-manual-att') fetchTeacherAttLog();
    }

    navLinks.forEach(link => link.addEventListener('click', () => navigateTo(link.getAttribute('data-target'))));
    document.querySelectorAll('.action-card[data-goto]').forEach(b => b.addEventListener('click', () => navigateTo(b.dataset.goto)));

    // Theme
    const themeToggle = document.getElementById('checkbox');
    if (themeToggle) {
        if (localStorage.getItem('theme') === 'light') { document.body.classList.add('light-theme'); themeToggle.checked = true; }
        themeToggle.addEventListener('change', e => {
            document.body.classList.toggle('light-theme', e.target.checked);
            localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
        });
    }

    // Sidebar toggle
    const st = document.getElementById('sidebarToggle');
    if (st) st.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

    // Network
    const networkStatus = document.getElementById('networkStatus');
    const networkText = document.getElementById('networkText');
    function updateNet() {
        if (navigator.onLine) {
            networkStatus.className = 'status-pill'; networkText.textContent = 'Online';
            flushOfflineQueue(); loadDashboard();
        } else {
            networkStatus.className = 'status-pill offline'; networkText.textContent = 'Offline';
        }
    }
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();

    // Search
    const rs = document.getElementById('rosterSearch');
    if (rs) rs.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#classRosterBody tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none');
    });

    // Charts
    initTeacherCharts();
});

// ═══ TOAST ═══
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ═══ DASHBOARD ═══
async function loadDashboard() {
    try {
        const res = await fetch('/api/data/stats/admin');
        const d = await res.json();
        if (d.success) {
            document.getElementById('kp_total').textContent = d.stats.total_students;
            document.getElementById('kp_present').textContent = Math.round(d.stats.total_students * d.stats.attendance_pct / 100);
            document.getElementById('kp_absent').textContent = Math.round(d.stats.total_students * (100 - d.stats.attendance_pct) / 100);
            document.getElementById('kp_late').textContent = '0';
        }
    } catch (e) { console.error(e); }
}

// ═══ CLASS ROSTER ═══
async function fetchClassRoster() {
    try {
        const res = await fetch('/api/data/students');
        const d = await res.json();
        const tb = document.getElementById('classRosterBody');
        if (!tb) return;
        if (d.success && d.students.length > 0) {
            tb.innerHTML = '';
            d.students.forEach(s => {
                tb.innerHTML += `<tr>
                    <td>${s.student_id || s.id}</td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.class}</td>
                    <td><span class="badge badge-present">--</span></td>
                </tr>`;
            });
        }
    } catch (e) { console.error(e); }
}

// ═══ ATTENDANCE LOG ═══
async function fetchTeacherAttLog() {
    try {
        const res = await fetch('/api/data/attendance/today');
        const d = await res.json();
        const tb = document.getElementById('teacherAttLog');
        if (!tb) return;
        if (d.success && d.records && d.records.length > 0) {
            tb.innerHTML = '';
            d.records.forEach(r => {
                const badge = r.status === 'Present' ? 'badge-present' : r.status === 'Absent' ? 'badge-absent' : 'badge-late';
                tb.innerHTML += `<tr><td>${r.student_id}</td><td>${r.student_name || '-'}</td><td><span class="badge ${badge}">${r.status}</span></td><td>${r.time || '-'}</td></tr>`;
            });
        } else {
            tb.innerHTML = '<tr><td colspan="4" class="empty-state">No entries for today</td></tr>';
        }
    } catch (e) { console.error(e); }
}

// ═══ LEAVE REQUESTS ═══
async function fetchLeaveRequests() {
    try {
        const res = await fetch('/api/data/leaves?status=Pending');
        const d = await res.json();
        const tb = document.getElementById('leaveQueue');
        const badge = document.getElementById('leaveCountBadge');
        if (!tb) return;
        if (d.success && d.leaves && d.leaves.length > 0) {
            tb.innerHTML = '';
            badge.textContent = d.leaves.length + ' Pending';
            d.leaves.forEach(l => {
                const id = l.request_id;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${l.student_name || l.student_id}</td>
                    <td>${l.from_date}</td><td>${l.to_date}</td>
                    <td>${l.reason}</td>
                    <td>
                        <button class="btn-glow approve-btn" style="padding:3px 10px;font-size:0.7rem;"><i class="fas fa-check"></i></button>
                        <button class="btn-outline reject-btn" style="padding:3px 10px;font-size:0.7rem;color:var(--danger);border-color:var(--danger);margin-left:4px;"><i class="fas fa-times"></i></button>
                    </td>
                `;
                tr.querySelector('.approve-btn').addEventListener('click', () => handleLeave(id, 'Approved'));
                tr.querySelector('.reject-btn').addEventListener('click', () => handleLeave(id, 'Rejected'));
                tb.appendChild(tr);
            });
        } else {
            tb.innerHTML = '<tr><td colspan="5" class="empty-state">No pending requests</td></tr>';
            badge.textContent = '0 Pending';
        }
    } catch (e) { console.error(e); }
}

async function handleLeave(id, action) {
    try {
        const res = await fetch('/api/data/leaves/' + id, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: action })
        });
        const d = await res.json();
        showToast(d.message || `Leave ${action}`, d.success ? 'success' : 'error');
        fetchLeaveRequests();
    } catch (e) { showToast('Failed', 'error'); }
}

// ═══ MANUAL ATTENDANCE ═══
document.getElementById('manualAttForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const stdId = document.getElementById('attStudentId').value;
    const status = document.getElementById('attStatus').value;
    const payload = { student_id: stdId, status };
    const qList = document.getElementById('markedList');

    if (!navigator.onLine) {
        let cache = JSON.parse(localStorage.getItem('att_queue') || '[]');
        cache.push(payload);
        localStorage.setItem('att_queue', JSON.stringify(cache));
        qList.innerHTML += `<div class="audit-entry"><span class="audit-time">${new Date().toLocaleTimeString()}</span><span class="audit-msg">Roll: ${stdId} — CACHED</span></div>`;
        showToast('Cached for offline sync', 'info');
    } else {
        try {
            const res = await fetch('/api/data/attendance/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const d = await res.json();
            if (d.success) {
                qList.innerHTML += `<div class="audit-entry"><span class="audit-time">${new Date().toLocaleTimeString()}</span><span class="audit-msg">ID: ${stdId} — ${status.toUpperCase()}</span></div>`;
                showToast(`${stdId} marked ${status}`, 'success');
                fetchTeacherAttLog(); // REFRESH LOG
            } else {
                showToast(d.message || 'Failed to mark', 'error');
            }
        } catch (err) { showToast('Network error', 'error'); }
    }
    e.target.reset();
});

async function flushOfflineQueue() {
    let cache = JSON.parse(localStorage.getItem('att_queue') || '[]');
    if (cache.length > 0) {
        for (const p of cache) {
            await fetch('/api/data/attendance/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
        }
        localStorage.removeItem('att_queue');
        showToast(`Synced ${cache.length} cached entries`, 'success');
    }
}

// ═══ MARKS FORM ═══
document.getElementById('marksForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('/api/data/marks/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: document.getElementById('m_studentId').value,
                subject: document.getElementById('m_subject').value,
                marks: document.getElementById('m_marks').value,
                total_marks: document.getElementById('m_total').value,
                exam_type: document.getElementById('m_exam').value
            })
        });
        const d = await res.json();
        showToast(d.message, d.success ? 'success' : 'error');
        if (d.success) e.target.reset();
    } catch (err) { showToast('Network error', 'error'); }
});

// ═══ SMS ═══
document.getElementById('smsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('/api/data/comms/sms/broadcast', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: document.getElementById('smsTarget').value, message: document.getElementById('smsBody').value })
        });
        const d = await res.json();
        showToast(d.message, d.success ? 'success' : 'error');
        if (d.success) e.target.reset();
    } catch (err) { showToast('SMS failed', 'error'); }
});

// ═══ CAMERA ═══
let camStream = null, scanInterval = null, frames = [], isScanningPaused = false;

function openSuccessModal(name) {
    isScanningPaused = true;
    const modal = document.getElementById('successModal');
    const card = document.getElementById('successCard');
    const now = new Date();
    
    document.getElementById('successName').textContent = name;
    document.getElementById('successTime').textContent = `Time: ${now.toLocaleTimeString()}`;
    document.getElementById('successDate').textContent = `Date: ${now.toLocaleDateString()}`;
    
    modal.style.display = 'flex';
    gsap.to(card, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" });
}

window.closeSuccessModal = function() {
    const card = document.getElementById('successCard');
    const modal = document.getElementById('successModal');
    
    gsap.to(card, { scale: 0.8, opacity: 0, duration: 0.3, onComplete: () => {
        modal.style.display = 'none';
        isScanningPaused = false;
        frames = []; // Reset frames
    }});
}

document.getElementById('startAttCam').addEventListener('click', async function () {
    const video = document.getElementById('attVideo');
    const ph = document.getElementById('attPlaceholder');
    const guide = document.getElementById('scanGuide');
    const msg = document.getElementById('attMsg');
    if (!camStream) {
        try {
            camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
            video.srcObject = camStream; 
            ph.style.display = 'none'; 
            video.style.display = 'block';
            guide.style.display = 'block';
            this.innerHTML = '<i class="fas fa-stop"></i> Sleep Scanner';
            msg.textContent = 'Scanner Active. Center face in guide.'; 
            msg.style.color = 'var(--primary-glow)';
            scanInterval = setInterval(extractAndIdentify, 2000);
        } catch (e) { showToast('Camera access denied', 'error'); }
    } else {
        camStream.getTracks().forEach(t => t.stop()); 
        clearInterval(scanInterval); 
        camStream = null;
        video.style.display = 'none'; 
        ph.style.display = 'flex';
        guide.style.display = 'none';
        this.innerHTML = '<i class="fas fa-video"></i> Wake Scanner'; 
        msg.textContent = '';
    }
});

async function extractAndIdentify() {
    if (!navigator.onLine || isScanningPaused) return;
    const video = document.getElementById('attVideo');
    if (!video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    frames.push(canvas.toDataURL('image/jpeg'));

    if (frames.length >= 3) {
        document.getElementById('attMsg').textContent = 'Authenticating...';
        try {
            const res = await fetch('/api/face/recognize', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ frames, auto_mark: true }) 
            });
            const d = await res.json();
            const msg = document.getElementById('attMsg');
            const qList = document.getElementById('markedList');

            if (d.success && d.matched) {
                msg.style.color = 'var(--primary-glow)'; 
                msg.textContent = `${d.student_name} Verified.`;
                qList.innerHTML += `<div class="audit-entry"><span class="audit-time">${new Date().toLocaleTimeString()}</span><span class="audit-msg">${d.student_name} — AI Match</span></div>`;
                
                // Show the professional success popup
                openSuccessModal(d.student_name);
                fetchTeacherAttLog(); // Refresh the log in background
            } else { 
                msg.style.color = 'var(--danger)'; 
                msg.textContent = 'Face not recognized.'; 
                frames = []; // Clear frames to try again
            }
        } catch (e) { console.error(e); }
        if (!isScanningPaused) frames = [];
    }
}

// ═══ CALENDAR ═══
function renderCalendar() {
    const grid = document.getElementById('calGrid');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    grid.innerHTML = days.map(d => `<div style="font-weight:700;color:var(--primary);text-align:center;font-size:0.75rem;">${d}</div>`).join('');
    for (let i = 1; i <= 30; i++) {
        let bg = 'var(--bg-surface)';
        if (i % 7 === 0) bg = 'rgba(239,68,68,0.15)';
        else if (i % 5 === 0) bg = 'rgba(245,158,11,0.15)';
        else bg = 'rgba(16,185,129,0.15)';
        grid.innerHTML += `<div style="background:${bg};padding:12px;border-radius:var(--radius-sm);text-align:center;font-size:0.85rem;font-weight:500;">${i}</div>`;
    }
}

function logout() { localStorage.removeItem('user'); window.location.href = '/'; }

// ═══ CHARTS ═══
function initTeacherCharts() {
    const wCtx = document.getElementById('teacherWeeklyChart');
    if (wCtx) {
        new Chart(wCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{ label: 'Present', data: [42, 39, 44, 41, 38, 30], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.4, pointRadius: 4 },
                    { label: 'Absent', data: [3, 6, 1, 4, 7, 2], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.4, pointRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b95a5', font: { family: 'Inter', size: 11 } } } }, scales: { x: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } } } }
        });
    }
    const gCtx = document.getElementById('gradeChart');
    if (gCtx) {
        new Chart(gCtx.getContext('2d'), {
            type: 'bar',
            data: { labels: ['Physics', 'Math', 'Chemistry', 'English', 'CS'], datasets: [{ label: 'Class Avg', data: [72, 85, 78, 90, 88], backgroundColor: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'], borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b95a5' } } }, scales: { x: { ticks: { color: '#5a6577' }, grid: { display: false } }, y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' }, beginAtZero: true, max: 100 } } }
        });
    }
    const tCtx = document.getElementById('trendChart');
    if (tCtx) {
        new Chart(tCtx.getContext('2d'), {
            type: 'line',
            data: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], datasets: [{ label: 'Attendance %', data: [92, 88, 91, 85], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b95a5' } } }, scales: { x: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' }, min: 50, max: 100 } } }
        });
    }
}
