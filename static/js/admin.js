document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
        window.location.href = '/'; 
        return;
    }

    try {
        const res = await fetch('/api/data/stats/admin');
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('totStudents').textContent = data.stats.total_students;
            document.getElementById('attPercent').textContent = data.stats.attendance_pct + '%';
            document.getElementById('avgPerf').textContent = data.stats.avg_performance + '%';
            document.getElementById('riskCount').textContent = data.stats.risk_count;

            const logsTable = document.getElementById('cheatLogs');
            logsTable.innerHTML = '';
            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    logsTable.innerHTML += `<tr>
                        <td>${new Date(log.attempt_timestamp).toLocaleString()}</td>
                        <td style="color:#ff3366">${log.reason}</td>
                    </tr>`;
                });
            } else {
                logsTable.innerHTML = `<tr><td colspan="2">No suspicious activities logged.</td></tr>`;
            }
        }
    } catch (err) {
        console.error("Failed to load admin data", err);
    }

    // Handle Student Creation
    document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('stuName').value,
            roll_number: document.getElementById('stuRoll').value,
            class_name: document.getElementById('stuClass').value
        };
        const res = await fetch('/api/data/students/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        document.getElementById('studentMsg').textContent = data.message;
        if(data.success) {
            document.getElementById('studentMsg').style.color = '#00ffcc';
            e.target.reset();
        } else {
            document.getElementById('studentMsg').style.color = '#ff3366';
        }
    });

    // Handle Face Registration via WebRTC
    let regVideoStream = null;
    document.getElementById('startRegCam').addEventListener('click', async () => {
        const video = document.getElementById('regVideo');
        if (!regVideoStream) {
            try {
                regVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = regVideoStream;
                video.style.display = 'block';
                document.getElementById('captureFaceBtn').style.display = 'inline-block';
                document.getElementById('startRegCam').textContent = 'Stop Camera';
            } catch(e) {
                alert("Camera access denied.");
            }
        } else {
            regVideoStream.getTracks().forEach(track => track.stop());
            regVideoStream = null;
            video.style.display = 'none';
            document.getElementById('captureFaceBtn').style.display = 'none';
            document.getElementById('startRegCam').textContent = 'Start Camera';
        }
    });

    document.getElementById('captureFaceBtn').addEventListener('click', async () => {
        const studentId = document.getElementById('targetStuID').value;
        if(!studentId) { alert("Please enter Student ID"); return; }
        
        const video = document.getElementById('regVideo');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const msgBox = document.getElementById('faceRegMsg');
        msgBox.textContent = "Encoding face to DB...";
        msgBox.style.color = 'white';

        const res = await fetch('/api/face/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: studentId,
                image: canvas.toDataURL('image/jpeg')
            })
        });
        const data = await res.json();
        msgBox.textContent = data.message;
        msgBox.style.color = data.success ? '#00ffcc' : '#ff3366';
    });
});
