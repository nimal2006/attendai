// Auth Logic injected into the new UI Template

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorBox = document.getElementById('errorMsg');

    errorBox.style.color = '#fff';
    errorBox.textContent = "Authenticating...";
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: user, password: pass})
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect based on role
            if (data.user.role === 'admin') window.location.href = '/admin-dashboard';
            else if (data.user.role === 'teacher') window.location.href = '/teacher-dashboard';
            else window.location.href = '/parent-dashboard';
        } else {
            errorBox.style.color = '#ff4444';
            errorBox.textContent = data.message;
        }
    } catch (err) {
        errorBox.style.color = '#ff4444';
        errorBox.textContent = "Network error. Please ensure Flask Backend is active.";
        console.error(err);
    }
});

// Liveness & Face Login Logic
let videoStream = null;
let captureInterval = null;
let frames = [];

document.getElementById('faceLoginBtn').addEventListener('click', async () => {
    const cameraContainer = document.getElementById('cameraContainer');
    const video = document.getElementById('videoFeed');
    const errorBox = document.getElementById('errorMsg');
    
    if (cameraContainer.style.display === 'none') {
        cameraContainer.style.display = 'block';
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = videoStream;
            errorBox.textContent = "Please look at the camera...";
            errorBox.style.color = '#fff';
            
            // Start capturing 3 frames spanning 1 second
            frames = [];
            captureInterval = setInterval(() => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg'));

                if(frames.length >= 3) {
                    clearInterval(captureInterval);
                    submitLivenessLogin();
                }
            }, 400);

        } catch (err) {
            errorBox.style.color = '#ff4444';
            errorBox.textContent = "Camera access denied.";
        }
    } else {
        stopCamera();
    }
});

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('cameraContainer').style.display = 'none';
    clearInterval(captureInterval);
}

async function submitLivenessLogin() {
    const errorBox = document.getElementById('errorMsg');
    errorBox.textContent = "AI Analysis processing...";
    
    try {
        const res = await fetch('/api/face/recognize', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ frames: frames, auto_mark: false })
        });
        const data = await res.json();
        
        if (data.success && data.matched) {
            errorBox.style.color = '#d4a373'; // accent color
            errorBox.textContent = "Face recognized. Welcome " + data.student_name;
            setTimeout(() => {
                window.location.href = '/teacher-dashboard'; // Fallback redirect strategy for Face terminal
            }, 1000);
        } else {
            errorBox.style.color = '#ff4444';
            errorBox.textContent = data.message;
        }
    } catch (err) {
        errorBox.style.color = '#ff4444';
        errorBox.textContent = "Face API error or server unavailable.";
    }
    stopCamera();
}
