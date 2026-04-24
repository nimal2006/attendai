document.addEventListener('DOMContentLoaded', async () => {
    // Already checking auth inside teacher.html, but let's augment form submittals

    document.getElementById('manualAttForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const stdId = document.getElementById('attStudentId').value;
        const status = document.getElementById('attStatus').value;

        const res = await fetch('/api/data/attendance/mark', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: stdId, status: status })
        });
        const data = await res.json();
        alert(data.message);
    });

    document.getElementById('marksForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        // Grabbing inputs anonymously to match structure defined previously
        const inputs = e.target.querySelectorAll('input, select');
        const payload = {
            student_id: inputs[0].value,
            subject: inputs[1].value,
            marks_obtained: inputs[2].value,
            total_marks: inputs[3].value,
            exam_type: inputs[4].value
        };

        const res = await fetch('/api/data/marks/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert(data.message);
    });

    // We can also poll leaves here using /api/data/leaves/pending and injecting rows
});
