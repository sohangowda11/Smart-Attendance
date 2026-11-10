let pieChart, barChart, lineChart;
let allStudents = [];
let allLogs = [];
let eventPollingInterval = null;
let cameraActive = false;
let searchTimeout = null;
let currentRegStudentId = null;

// --- THEME MANAGEMENT ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        document.body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

// Execute immediately to prevent "white flash"
initTheme();

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

// --- UTILS ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
    toast.classList.add('show');
    
    if (type === 'success') {
        const audio = document.getElementById('successSound');
        if (audio) audio.play().catch(e => console.log('Audio blocked by browser'));
    }
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');
    const existing = button.getElementsByClassName('ripple')[0];
    if (existing) existing.remove();
    button.appendChild(circle);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.classList.remove('show');
        // Specific cleanup for wizards/cameras
        if (modalId === 'addStudentModal') {
            stopRegistrationFeed();
        }
    }
}

// --- AUTH ---
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    btn.classList.add('loading');
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({username: u, password: p})
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            window.location.href = '/dashboard';
        } else {
            const err = document.getElementById('loginError');
            err.classList.remove('hidden');
        }
    } catch(err) {
        showToast("Network Error", "error");
    } finally {
        btn.classList.remove('loading');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', {method: 'POST'});
        window.location.href = '/login';
    } catch(e) {}
}

async function toggleCloudSync() {
    try {
        const res = await fetch('/api/admin/toggle-sync', {method:'POST'});
        if(res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await res.json();
        const btn = document.getElementById('cloudBtn');
        if (data.cloud_sync) {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
            showToast("Cloud Sync Enabled");
        } else {
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
            showToast("Cloud Sync Disabled", "error");
        }
    } catch(e) { console.error(e); }
}

// --- DASHBOARD DATA ---
async function loadDashboardData() {
    initTheme();
    try {
        const resStats = await fetch('/api/stats');
        if(resStats.status === 401) {
            window.location.href = "/login";
            return;
        }
        
        const stats = await resStats.json();
        
        document.getElementById('stat-total').innerText = stats.total_students;
        document.getElementById('stat-present').innerText = stats.present_today;
        document.getElementById('stat-absent').innerText = stats.absent_today;
        document.getElementById('stat-weekly').innerText = stats.weekly_pct + '%';
        document.getElementById('stat-monthly').innerText = stats.advanced.avg_class_attendance + '%';
        
        const resWeekly = await fetch('/api/chart/weekly');
        const weeklyData = await resWeekly.json();
        
        const resMonthly = await fetch('/api/chart/monthly');
        const monthlyData = await resMonthly.json();

        initCharts(stats.present_today, stats.absent_today, weeklyData, monthlyData);
        renderAdvancedAnalytics(stats.advanced);

        const resS = await fetch('/api/students');
        allStudents = await resS.json();

    } catch (error) {
        console.error("Error loading dashboard data", error);
    }
}

function renderAdvancedAnalytics(advanced) {
    const topBody = document.getElementById('topRegularBody');
    if (topBody) {
        topBody.innerHTML = advanced.top_5.map(s => `
            <tr><td><strong>${s.name}</strong></td><td>${s.days} Days</td></tr>
        `).join('');
    }

    const riskBody = document.getElementById('atRiskBody');
    if (riskBody) {
        if (advanced.below_75.length === 0) {
            riskBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">All students on track!</td></tr>';
        } else {
            riskBody.innerHTML = advanced.below_75.map(s => `
                <tr><td>${s.name}</td><td style="color:var(--danger); font-weight:600;">${s.pct}%</td></tr>
            `).join('');
        }
    }
}

function initCharts(present, absent, weeklyData, monthlyData) {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = document.body.classList.contains('dark-mode') ? "#cbd5e1" : "#64748b";
    
    // Pie Chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent'],
            datasets: [{
                data: [present, absent],
                backgroundColor: [
                    getComputedStyle(document.documentElement).getPropertyValue('--success').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--danger').trim()
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', 
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Bar Chart
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: weeklyData.labels,
            datasets: [{
                label: 'Present Students',
                data: weeklyData.values,
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// --- SEARCH LOGIC (DEBOUNCED) ---
function handleGlobalSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase();
        
        const results = allStudents.filter(s => 
            s.name.toLowerCase().includes(query) || 
            s.usn.toLowerCase().includes(query)
        );

        const modal = document.getElementById('studentsModal');
        if (modal && modal.classList.contains('show')) {
            document.getElementById('studentSearch').value = query;
            renderStudentsTable(results);
        } else if (query.length > 0) {
            if (!window.location.pathname.includes('logs')) {
                 openStudentsModal(query);
            }
        }
    }, 300);
}

function filterStudents() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById('studentSearch').value.toLowerCase();
        const filtered = allStudents.filter(s => 
            s.name.toLowerCase().includes(query) || s.usn.toLowerCase().includes(query)
        );
        renderStudentsTable(filtered);
    }, 300);
}

// --- ATTENDANCE SESSION MANAGEMENT ---
function openSessionSetup() {
    if (cameraActive) return showToast("A session is already active", "error");
    
    const now = new Date();
    document.getElementById('sessionDate').value = now.toISOString().split('T')[0];
    document.getElementById('sessionTime').value = now.toTimeString().slice(0, 5);
    
    document.getElementById('sessionSetupModal').classList.add('show');
}

async function startAttendanceSession(e) {
    if (e) e.preventDefault();
    
    const date = document.getElementById('sessionDate').value;
    const time = document.getElementById('sessionTime').value;

    if (!date || !time) return showToast("Please select date and time", "error");

    try {
        const res = await fetch('/api/session/start', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date, time })
        });

        if (res.ok) {
            closeModal('sessionSetupModal');
            startCameraStream();
            showToast(`Session started for ${date} ${time}`);
        } else {
            showToast("Failed to start session", "error");
        }
    } catch (err) {
        showToast("Server communication error", "error");
    }
}

function startCameraStream() {
    if (cameraActive) return;
    cameraActive = true;

    const modal = document.getElementById('cameraModal');
    const feed = document.getElementById('cameraFeed');
    const loader = document.getElementById('cameraLoader');

    if (modal) {
        modal.classList.add('show');
        loader.style.display = 'flex';
        feed.src = '/api/video_feed';

        feed.onload = () => {
            loader.style.display = 'none';
        };
    } else {
        // Recognition page (index.html) logic
        const videoFeed = document.getElementById('videoFeed');
        const placeholder = document.getElementById('cameraPlaceholder');
        if (videoFeed) {
            videoFeed.src = '/api/video_feed';
            videoFeed.style.display = 'block';
            placeholder.style.display = 'none';
        }
    }

    if (eventPollingInterval) clearInterval(eventPollingInterval);
    eventPollingInterval = setInterval(pollDetectionEvents, 1500);
}

async function stopCameraAttendance() {
    cameraActive = false;
    
    const cameraModal = document.getElementById('cameraModal');
    const cameraFeed = document.getElementById('cameraFeed');
    const videoFeed = document.getElementById('videoFeed');
    const placeholder = document.getElementById('cameraPlaceholder');

    // Shutdown stream
    if (cameraFeed) cameraFeed.src = "";
    if (videoFeed) {
        videoFeed.src = "";
        videoFeed.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }

    if (cameraModal) cameraModal.classList.remove('show');
    
    if (eventPollingInterval) clearInterval(eventPollingInterval);

    // Stop session on backend
    try {
        await fetch('/api/session/stop', { method: 'POST' });
        showToast("Session ended", "success");
    } catch (e) {
        console.error("Failed to stop session cleanly", e);
    }
}

// Special handler for recognition-only page
async function startRecognitionSession() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);

    try {
        const res = await fetch('/api/session/start', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ date, time })
        });
        if (res.ok) {
            startCameraStream();
        } else {
            showToast("Failed to initialize camera server", "error");
        }
    } catch (e) { showToast("Network error", "error"); }
}

async function pollDetectionEvents() {
    try {
        const res = await fetch('/api/recent_events');
        if (res.status === 401) return;
        const events = await res.json();
        
        events.forEach(ev => {
            if (ev.status === 'present') {
                 showToast(`Marked Present: ${ev.name}`);
            } else if (ev.status === 'already_present') {
                 showToast(`${ev.name} already present in session`, 'error');
            }
        });
    } catch (e) { console.error("Polling error", e); }
}

// --- STUDENT DRILLDOWN ---
async function openStudentDrilldown(id) {
    try {
        const res = await fetch(`/api/student/${id}/details`);
        const data = await res.json();
        
        document.getElementById('ddName').innerText = data.name;
        document.getElementById('ddUSN').innerText = data.usn;
        document.getElementById('ddTotal').innerText = data.total_days;
        document.getElementById('ddWeekly').innerText = data.weekly_percentage + '%';
        document.getElementById('ddMonthly').innerText = data.monthly_percentage + '%';
        
        const logsBody = document.getElementById('ddLogsBody');
        logsBody.innerHTML = data.attendance.map(l => `
            <tr><td>${l.date}</td><td>${l.time}</td><td>${l.status}</td></tr>
        `).join('');
        
        document.getElementById('studentDrilldownModal').classList.add('show');
    } catch (e) {
        showToast("Error loading student profile", "error");
    }
}

// --- MANUAL ATTENDANCE ---
async function openManualAttendanceModal() {
    const select = document.getElementById('manStudentId');
    select.innerHTML = '<option value="">Loading students...</option>';
    
    try {
        const res = await fetch('/api/students');
        const students = await res.json();
        select.innerHTML = '<option value="">-- Select Student --</option>' + 
            students.map(s => `<option value="${s.id}">${s.name} (${s.usn})</option>`).join('');
        
        const now = new Date();
        document.getElementById('manDate').value = now.toISOString().split('T')[0];
        document.getElementById('manTime').value = now.toTimeString().slice(0, 5);
        
        document.getElementById('manualAttendanceModal').classList.add('show');
    } catch (e) {
        showToast("Failed to load students", "error");
    }
}

async function submitManualAttendance(e) {
    e.preventDefault();
    const payload = {
        student_id: parseInt(document.getElementById('manStudentId').value),
        date: document.getElementById('manDate').value,
        time: document.getElementById('manTime').value,
        status: document.getElementById('manStatus').value
    };
    
    try {
        const res = await fetch('/api/admin/attendance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Attendance updated successfully!");
            closeModal('manualAttendanceModal');
            loadDashboardData();
        } else {
            showToast(data.message || "Update failed", "error");
        }
    } catch (e) {
        showToast("Server error", "error");
    }
}

// --- LOGS PAGE ---
async function fetchLogs() {
    initTheme();
    try {
        const res = await fetch('/api/logs');
        if (res.status === 401) { window.location.href = '/login'; return; }
        allLogs = await res.json();
        populateLogsTable();
    } catch (e) {
        showToast("Error loading logs", "error");
    }
}

function populateLogsTable() {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;
    
    const filter = document.getElementById('logFilter').value.toLowerCase();
    const filtered = allLogs.filter(l => 
        l.name.toLowerCase().includes(filter) || 
        l.usn.toLowerCase().includes(filter) || 
        l.date.includes(filter)
    );
    
    tbody.innerHTML = filtered.map(l => `
        <tr>
            <td>${l.date}</td>
            <td>${l.time}</td>
            <td><strong>${l.name}</strong></td>
            <td><span style="color:var(--text-secondary);">${l.usn}</span></td>
            <td><span class="btn-sm btn-secondary" style="font-size:0.7rem;">${l.status}</span></td>
        </tr>
    `).join('');
}

// --- DIRECTORY LOGIC ---
async function openStudentsModal(initialQuery = "") {
    const modal = document.getElementById('studentsModal');
    try {
        const res = await fetch('/api/students');
        if (res.status === 401) { window.location.href='/login'; return; }
        allStudents = await res.json();
        document.getElementById('modalStudentCount').innerText = allStudents.length;
        
        if (initialQuery) {
            document.getElementById('studentSearch').value = initialQuery;
            filterStudents();
        } else {
            renderStudentsTable(allStudents);
        }
        
        modal.classList.add('show');
    } catch (error) {
        showToast("Failed to load students", "error");
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = students.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td><code>${s.usn}</code></td>
            <td><button class="btn btn-sm btn-secondary" onclick="openStudentDrilldown(${s.id})"><i class="fa-solid fa-address-card"></i> View Profile</button></td>
            <td class="table-actions">
                <button class="btn btn-sm btn-primary" onclick="manualTag(${s.id})" title="Force Mark Present"><i class="fa-solid fa-check"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id}, '${s.name}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function deleteStudent(id, name) {
    if(!confirm(`Delete student ${name}?`)) return;
    try {
        const res = await fetch(`/api/admin/students/${id}`, {method: 'DELETE'});
        if(res.ok) {
            showToast(`${name} deleted.`);
            openStudentsModal(document.getElementById('studentSearch').value); 
            loadDashboardData();
        }
    } catch(e) { showToast("Failed to delete", "error"); }
}

async function manualTag(id) {
    try {
        const res = await fetch(`/api/admin/attendance`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({student_id: id, status: 'Quick - Present'})
        });
        if(res.ok) {
            showToast('Attendance logged.');
            loadDashboardData();
        }
    } catch(e) { showToast("Network error.", "error"); }
}

function downloadCSV() {
    window.location.href = '/api/export';
}

document.addEventListener('keydown', e => { 
    if(e.key === 'Escape') {
        closeModal('studentsModal');
        closeModal('studentDrilldownModal');
        closeModal('manualAttendanceModal');
        closeModal('sessionSetupModal');
        closeModal('addStudentModal');
        stopCameraAttendance();
    }
});

// --- ADD STUDENT WIZARD ---
function openAddStudentModal() {
    // Reset wizard state
    currentRegStudentId = null;
    document.getElementById('newStudentName').value = "";
    document.getElementById('newStudentUSN').value = "";
    
    document.getElementById('addStudentStep1').classList.remove('hidden');
    document.getElementById('addStudentStep2').classList.add('hidden');
    
    document.getElementById('addStudentModal').classList.add('show');
    setTimeout(() => document.getElementById('newStudentName').focus(), 300);
}

async function nextToCapture(e) {
    if (e) e.preventDefault();
    
    const name = document.getElementById('newStudentName').value.trim();
    const usn = document.getElementById('newStudentUSN').value.trim().toUpperCase();
    const btn = document.getElementById('addStudentNextBtn');

    if (!name || !usn) {
        return showToast("Both Name and USN are required", "error");
    }

    btn.disabled = true;
    btn.classList.add('loading');

    try {
        const res = await fetch('/api/students/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, usn })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            currentRegStudentId = data.student_id;
            
            // Transition to Step 2
            document.getElementById('addStudentStep1').classList.add('hidden');
            document.getElementById('addStudentStep2').classList.remove('hidden');
            
            startRegistrationFeed();
            showToast("Details saved. Please look at the camera.");
        } else {
            showToast(data.message || "Failed to add student", "error");
        }
    } catch (err) {
        showToast("Server connection error", "error");
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

function startRegistrationFeed() {
    const feed = document.getElementById('registrationFeed');
    const loader = document.getElementById('regCameraLoader');
    
    loader.style.display = 'flex';
    feed.src = '/api/video_feed';
    
    feed.onload = () => {
        loader.style.display = 'none';
    };
    
    feed.onerror = () => {
        showToast("Failed to connect to camera", "error");
    };
}

function stopRegistrationFeed() {
    const feed = document.getElementById('registrationFeed');
    if (feed) feed.src = "";
}

function backToStep1() {
    stopRegistrationFeed();
    document.getElementById('addStudentStep1').classList.remove('hidden');
    document.getElementById('addStudentStep2').classList.add('hidden');
}

async function captureFace() {
    if (!currentRegStudentId) return showToast("Invalid student ID", "error");
    
    const btn = document.getElementById('captureFaceBtn');
    btn.disabled = true;
    btn.classList.add('loading');

    try {
        const res = await fetch('/api/students/register-face', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ student_id: currentRegStudentId })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showToast("Student Registered Successfully!");
            closeModal('addStudentModal');
            loadDashboardData();
        } else {
            showToast(data.message || "Face registration failed", "error");
        }
    } catch (err) {
        showToast("Error communicating with processing engine", "error");
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}
