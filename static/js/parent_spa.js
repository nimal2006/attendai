document.addEventListener('DOMContentLoaded', () => {
    // Auth
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'parent') { window.location.href = '/'; return; }
    const sn = document.getElementById('sidebarUserName');
    if (sn) sn.textContent = user.username || 'Parent';

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
        if (targetId === 'view-academics') fetchGrades();
        if (targetId === 'view-leave') fetchLeaveHistory();
    }

    navLinks.forEach(link => link.addEventListener('click', () => navigateTo(link.getAttribute('data-target'))));

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

    // Load dashboard
    loadParentDashboard();
    initParentCharts();
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
async function loadParentDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    // Try to get linked student data
    try {
        const res = await fetch(`/api/data/students?user_id=${user.id}&role=parent`);
        const d = await res.json();
        if (d.success && d.students.length > 0) {
            const s = d.students[0]; // First linked student
            document.getElementById('p_studentName').textContent = s.name;
            document.getElementById('p_studentClass').textContent = `Class ${s.class} | Student ID: ${s.student_id || s.id}`;
            document.getElementById('bio_name').textContent = s.name;
            document.getElementById('bio_class').textContent = s.class;
            document.getElementById('bio_roll').textContent = s.roll_number || '-';
            document.getElementById('bio_id').textContent = s.student_id || s.id;
        }
    } catch (e) { console.error(e); }

    try {
        const res = await fetch('/api/data/stats/admin');
        const d = await res.json();
        if (d.success) {
            document.getElementById('p_attPct').textContent = d.stats.attendance_pct + '%';
            document.getElementById('p_acadPct').textContent = d.stats.avg_performance + '%';
            document.getElementById('p_alertCount').textContent = d.stats.risk_count || 0;
            document.getElementById('p_todayStatus').textContent = d.stats.attendance_pct > 0 ? 'PRESENT' : 'ABSENT';
        }
    } catch (e) { console.error(e); }
}

// ═══ GRADES ═══
async function fetchGrades() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const sRes = await fetch(`/api/data/students?user_id=${user.id}&role=parent`);
        const sData = await sRes.json();
        if (!sData.success || !sData.students.length) return;
        const sid = sData.students[0].student_id || sData.students[0].id;

        const res = await fetch(`/api/data/marks/${sid}`);
        const d = await res.json();
        const tb = document.getElementById('gradesTableBody');
        const avgBadge = document.getElementById('acadAvgBadge');
        if (!tb) return;

        if (d.success && d.marks && d.marks.length > 0) {
            tb.innerHTML = '';
            let totalPct = 0;
            d.marks.forEach(m => {
                const pct = Math.round((m.marks / m.total_marks) * 100);
                totalPct += pct;
                const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F';
                const badgeClass = pct >= 70 ? 'badge-present' : pct >= 50 ? 'badge-late' : 'badge-absent';
                tb.innerHTML += `<tr>
                    <td><strong>${m.subject}</strong></td>
                    <td>${m.exam_type || '-'}</td>
                    <td>${m.marks}</td><td>${m.total_marks}</td>
                    <td><span class="badge ${badgeClass}">${pct}%</span></td>
                    <td><span class="badge ${badgeClass}">${grade}</span></td>
                </tr>`;
            });
            const avg = Math.round(totalPct / d.marks.length);
            avgBadge.textContent = `Avg: ${avg}%`;
        } else {
            tb.innerHTML = '<tr><td colspan="6" class="empty-state">No marks recorded yet</td></tr>';
        }
    } catch (e) { console.error(e); }
}

// ═══ LEAVE ═══
const leaveForm = document.getElementById('leaveForm');
if (leaveForm) {
    leaveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const sRes = await fetch('/api/data/students');
            const sData = await sRes.json();
            const sid = sData.students[0]?.student_id || sData.students[0]?.id || 1;

            const res = await fetch('/api/data/leaves/apply', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: sid,
                    from_date: document.getElementById('l_from').value,
                    to_date: document.getElementById('l_to').value,
                    reason: document.getElementById('l_reason').value
                })
            });
            const d = await res.json();
            showToast(d.message, d.success ? 'success' : 'error');
            if (d.success) {
                e.target.reset();
                fetchLeaveHistory();
            }
        } catch (err) { showToast('Submission failed', 'error'); }
    });
}

async function fetchLeaveHistory() {
    try {
        const res = await fetch('/api/data/leaves');
        const d = await res.json();
        const tb = document.getElementById('leaveHistoryBody');
        if (!tb) return;
        if (d.success && d.leaves && d.leaves.length > 0) {
            tb.innerHTML = '';
            d.leaves.forEach(l => {
                const badge = l.status === 'Approved' ? 'badge-present' : l.status === 'Rejected' ? 'badge-absent' : 'badge-pending';
                tb.innerHTML += `<tr><td>${l.from_date} → ${l.to_date}</td><td>${l.reason}</td><td><span class="badge ${badge}">${l.status}</span></td></tr>`;
            });
        }
    } catch (e) { console.error(e); }
}

// ═══ CALENDAR ═══
function renderCalendar() {
    const grid = document.getElementById('parentCalGrid');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    grid.innerHTML = days.map(d => `<div style="font-weight:700;color:var(--primary);text-align:center;font-size:0.75rem;">${d}</div>`).join('');
    for (let i = 1; i <= 30; i++) {
        let bg = 'var(--bg-surface)';
        if (i === 12 || i === 13) bg = 'rgba(245,158,11,0.2)';
        else if (i === 18) bg = 'rgba(239,68,68,0.2)';
        else if (i % 7 !== 0 && i % 6 !== 0) bg = 'rgba(16,185,129,0.2)';
        grid.innerHTML += `<div style="background:${bg};padding:12px;border-radius:var(--radius-sm);text-align:center;font-size:0.85rem;font-weight:500;">${i}</div>`;
    }
}

function logout() { localStorage.removeItem('user'); window.location.href = '/'; }

// ═══ CHARTS ═══
function initParentCharts() {
    const aCtx = document.getElementById('parentAttChart');
    if (aCtx) {
        new Chart(aCtx.getContext('2d'), {
            type: 'line',
            data: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], datasets: [{ label: 'Attendance %', data: [95, 88, 92, 85], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#10b981' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b95a5', font: { family: 'Inter', size: 11 } } } }, scales: { x: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' }, min: 50, max: 100 } } }
        });
    }
    const sCtx = document.getElementById('parentSubjectChart');
    if (sCtx) {
        new Chart(sCtx.getContext('2d'), {
            type: 'radar',
            data: { labels: ['Math', 'Physics', 'Chemistry', 'English', 'CS'], datasets: [{ label: 'Score %', data: [88, 74, 92, 85, 90], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', pointBackgroundColor: '#3b82f6' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b95a5', font: { family: 'Inter', size: 11 } } } }, scales: { r: { ticks: { color: '#5a6577', backdropColor: 'transparent' }, grid: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#8b95a5' }, suggestedMin: 0, suggestedMax: 100 } } }
        });
    }
    const hCtx = document.getElementById('parentAttHistChart');
    if (hCtx) {
        new Chart(hCtx.getContext('2d'), {
            type: 'bar',
            data: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], datasets: [{ label: 'Present Days', data: [22, 20, 23, 18, 21, 19], backgroundColor: '#10b981', borderRadius: 6 }, { label: 'Absent', data: [1, 3, 0, 4, 2, 3], backgroundColor: '#ef4444', borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b95a5' } } }, scales: { x: { ticks: { color: '#5a6577' }, grid: { display: false } }, y: { ticks: { color: '#5a6577' }, grid: { color: 'rgba(255,255,255,0.03)' } } } }
        });
    }
}
