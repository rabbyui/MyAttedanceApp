/* ═══════════════════════════════════════════════════════════════
   Attendance Tracker - Full Application Logic
   ═══════════════════════════════════════════════════════════════ */

;(function() {
  'use strict';

  // ─── Storage Keys ──────────────────────────────────────────────
  const STORAGE_KEYS = {
    CONTROL_NUMBER: 'att_tracker_control',
    STUDENTS: 'att_tracker_students',
    ATTENDANCE: 'att_tracker_attendance',
  };

  // ─── State ─────────────────────────────────────────────────────
  let state = {
    controlNumber: null,
    students: [],
    attendance: [],
    currentDate: new Date().toISOString().slice(0, 10),
    editStudentId: null,
    attendanceChanges: {},
  };

  // ─── DOM Refs ──────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Init ──────────────────────────────────────────────────────
  function init() {
    loadState();
    setupEventListeners();
    setupScreens();
  }

  // ─── Storage ───────────────────────────────────────────────────
  function loadState() {
    try {
      const pin = localStorage.getItem(STORAGE_KEYS.CONTROL_NUMBER);
      state.controlNumber = pin || null;

      const studentsData = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      state.students = studentsData ? JSON.parse(studentsData) : [];

      const attData = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      state.attendance = attData ? JSON.parse(attData) : [];
    } catch (e) {
      console.error('Error loading state:', e);
      state.controlNumber = null;
      state.students = [];
      state.attendance = [];
    }
  }

  function saveStudents() {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(state.students));
    } catch (e) {
      console.error('Error saving students:', e);
      showToast('Error saving students');
    }
  }

  function saveAttendance() {
    try {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(state.attendance));
    } catch (e) {
      console.error('Error saving attendance:', e);
      showToast('Error saving attendance');
    }
  }

  function saveControlNumber(pin) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTROL_NUMBER, pin);
      state.controlNumber = pin;
    } catch (e) {
      console.error('Error saving control number:', e);
    }
  }

  function resetAllData() {
    localStorage.removeItem(STORAGE_KEYS.CONTROL_NUMBER);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    state = {
      controlNumber: null,
      students: [],
      attendance: [],
      currentDate: new Date().toISOString().slice(0, 10),
      editStudentId: null,
      attendanceChanges: {},
    };
  }

  // ─── Screen Management ─────────────────────────────────────────
  function showScreen(screenId) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  }

  function showPage(pageId) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');
  }

  function setupScreens() {
    if (!state.controlNumber) {
      showScreen('screen-setup');
    } else {
      showScreen('screen-login');
      resetPinEntry();
    }
  }

  // ─── Event Listeners ──────────────────────────────────────────
  function setupEventListeners() {
    // Setup screen
    $('#btn-setup').addEventListener('click', handleSetup);
    $('#setup-number').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSetup();
    });
    $('#setup-confirm').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSetup();
    });

    // Login screen (numpad)
    document.querySelectorAll('.numpad-btn').forEach(btn => {
      btn.addEventListener('click', handleNumpadClick);
    });

    // Logout
    $('#btn-logout').addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = btn.dataset.page || 'dashboard';
        if (targetPage !== 'attendance' && hasUnsavedAttendance()) {
          showConfirmDialog(
            'Unsaved Changes',
            'You have unsaved attendance changes. Discard them?',
            () => {
              resetAttendanceChanges();
              showPage(targetPage);
              refreshDashboard();
            }
          );
          return;
        }
        showPage(targetPage);
        refreshDashboard();
      });
    });

    // Dashboard actions
    $('#dash-take-attendance').addEventListener('click', openAttendance);
    $('#dash-manage-students').addEventListener('click', () => {
      showPage('students');
      renderStudentList();
    });
    $('#dash-history').addEventListener('click', () => {
      showPage('history');
      renderHistory();
    });
    $('#dash-settings').addEventListener('click', () => {
      showPage('settings');
      clearSettingsMessages();
    });

    // Student management
    $('#btn-add-student').addEventListener('click', openAddStudent);
    $('#student-form').addEventListener('submit', handleSaveStudent);
    $('#btn-delete-student').addEventListener('click', handleDeleteStudent);
    $('#student-search').addEventListener('input', renderStudentList);

    // Attendance
    $('#attendance-date').addEventListener('change', (e) => {
      const newDate = e.target.value;
      if (hasUnsavedAttendance()) {
        showConfirmDialog(
          'Unsaved Changes',
          'Changing the date will discard unsaved attendance changes. Continue?',
          () => {
            state.currentDate = newDate;
            resetAttendanceChanges();
            renderAttendanceList();
          },
          () => {
            // Reset date picker to previous value
            $('#attendance-date').value = state.currentDate;
          }
        );
      } else {
        state.currentDate = newDate;
        resetAttendanceChanges();
        renderAttendanceList();
      }
    });
    $('#btn-mark-all-present').addEventListener('click', () => markAllAttendance('present'));
    $('#btn-mark-all-absent').addEventListener('click', () => markAllAttendance('absent'));
    $('#btn-save-attendance').addEventListener('click', saveCurrentAttendance);

    // History
    $('#history-date-from').addEventListener('change', renderHistory);
    $('#history-date-to').addEventListener('change', renderHistory);
    $('#history-status-filter').addEventListener('change', renderHistory);
    $('#btn-export-history').addEventListener('click', exportHistoryCSV);

    // Settings
    $('#btn-change-pin').addEventListener('click', handleChangePin);
    $('#btn-export-data').addEventListener('click', exportAllData);
    $('#btn-import-data').addEventListener('click', () => $('#import-file-input').click());
    $('#import-file-input').addEventListener('change', handleImportData);
    $('#btn-reset-data').addEventListener('click', handleResetData);

    // Confirm dialog (cancel is handled below)
  }

  // ─── CONTROL NUMBER: Setup ─────────────────────────────────────
  function handleSetup() {
    const pin = $('#setup-number').value.trim();
    const confirm = $('#setup-confirm').value.trim();
    const errorEl = $('#setup-error');

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      errorEl.textContent = 'Please enter exactly 4 digits.';
      return;
    }
    if (pin !== confirm) {
      errorEl.textContent = 'Control numbers do not match.';
      return;
    }

    errorEl.textContent = '';
    saveControlNumber(pin);
    showToast('Control number set successfully!');
    showScreen('screen-login');
    resetPinEntry();
  }

  // ─── CONTROL NUMBER: Login (Numpad) ────────────────────────────
  let currentPin = '';

  function resetPinEntry() {
    currentPin = '';
    updatePinDisplay();
    $('#login-error').textContent = '';
  }

  function updatePinDisplay() {
    for (let i = 0; i < 4; i++) {
      const dot = document.querySelector(`.pin-dot[data-i="${i}"]`);
      if (dot) {
        dot.classList.toggle('filled', i < currentPin.length);
        dot.classList.remove('error');
      }
    }
  }

  function handleNumpadClick(e) {
    const value = e.currentTarget.dataset.value;
    if (!value) return;

    $('#login-error').textContent = '';

    if (value === 'clear') {
      currentPin = currentPin.slice(0, -1);
      updatePinDisplay();
      return;
    }

    if (value === 'go') {
      verifyPin();
      return;
    }

    if (currentPin.length >= 4) return;
    currentPin += value;
    updatePinDisplay();

    if (currentPin.length === 4) {
      setTimeout(verifyPin, 150);
    }
  }

  function verifyPin() {
    if (currentPin.length !== 4) {
      $('#login-error').textContent = 'Enter all 4 digits.';
      shakePinDots();
      return;
    }

    if (currentPin === state.controlNumber) {
      showScreen('screen-app');
      showPage('dashboard');
      refreshDashboard();
      resetPinEntry();
    } else {
      $('#login-error').textContent = 'Incorrect control number. Try again.';
      shakePinDots();
      currentPin = '';
      setTimeout(updatePinDisplay, 400);
    }
  }

  function shakePinDots() {
    document.querySelectorAll('.pin-dot').forEach(d => {
      d.classList.add('error');
    });
  }

  // ─── LOGOUT ────────────────────────────────────────────────────
  function handleLogout() {
    showConfirmDialog(
      'Logout',
      'Are you sure you want to logout?',
      () => {
        showScreen('screen-login');
        resetPinEntry();
        showToast('Logged out');
      }
    );
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────
  function refreshDashboard() {
    const total = state.students.length;
    $('#stat-total').textContent = total;

    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = state.attendance.filter(r => r.date === today);

    const present = todayRecords.filter(r => r.status === 'present').length;
    const absent = todayRecords.filter(r => r.status === 'absent').length;
    const late = todayRecords.filter(r => r.status === 'late').length;

    $('#stat-present-today').textContent = present;
    $('#stat-absent-today').textContent = absent;
    $('#stat-late-today').textContent = late;

    // Today's preview list
    const container = $('#today-preview');
    if (todayRecords.length === 0) {
      container.innerHTML = '<p class="empty-state">No attendance taken yet today.</p>';
      return;
    }

    let html = '';
    todayRecords.forEach(rec => {
      const student = state.students.find(s => s.id === rec.studentId);
      if (!student) return;
      const statusLabels = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
      html += `
        <div class="today-student-item">
          <strong>${escapeHtml(student.name)}</strong>
          <span class="badge badge-${rec.status}">${statusLabels[rec.status] || rec.status}</span>
        </div>`;
    });
    container.innerHTML = html || '<p class="empty-state">No students found.</p>';
  }

  // ─── STUDENT MANAGEMENT ────────────────────────────────────────
  function renderStudentList() {
    const container = $('#student-list');
    const searchTerm = ($('#student-search').value || '').toLowerCase();

    let filtered = state.students;
    if (searchTerm) {
      filtered = state.students.filter(s =>
        s.name.toLowerCase().includes(searchTerm) ||
        (s.class && s.class.toLowerCase().includes(searchTerm)) ||
        (s.studentId && s.studentId.toLowerCase().includes(searchTerm))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-state">' +
        (state.students.length === 0
          ? 'No students yet. Add your first student!'
          : 'No students match your search.') +
        '</p>';
      return;
    }

    let html = '';
    filtered.forEach(s => {
      const initial = s.name.charAt(0).toUpperCase();
      html += `
        <div class="student-card">
          <div class="student-avatar">${escapeHtml(initial)}</div>
          <div class="student-info">
            <div class="student-name">${escapeHtml(s.name)}</div>
            <div class="student-meta">${escapeHtml(s.class || 'No class')}${s.studentId ? ' · ' + escapeHtml(s.studentId) : ''}</div>
          </div>
          <div class="student-actions">
            <button class="btn-edit-student" data-id="${s.id}">Edit</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', () => openEditStudent(btn.dataset.id));
    });
  }

  function openAddStudent() {
    state.editStudentId = null;
    $('#add-student-title').textContent = 'Add Student';
    $('#student-form').reset();
    $('#student-name').value = '';
    $('#student-class').value = '';
    $('#student-id-number').value = '';
    $('#edit-notes-group').style.display = 'none';
    $('#btn-save-student').textContent = 'Save Student';
    $('#btn-delete-student').style.display = 'none';
    $('#student-form-error').textContent = '';
    showPage('add-student');
    $('#student-name').focus();
  }

  function openEditStudent(id) {
    const student = state.students.find(s => s.id === id);
    if (!student) return;

    state.editStudentId = id;
    $('#add-student-title').textContent = 'Edit Student';
    $('#student-name').value = student.name || '';
    $('#student-class').value = student.class || '';
    $('#student-id-number').value = student.studentId || '';
    $('#student-created-display').textContent = student.createdAt
      ? 'Added ' + new Date(student.createdAt).toLocaleDateString()
      : '';
    $('#edit-notes-group').style.display = 'block';
    $('#btn-save-student').textContent = 'Update Student';
    $('#btn-delete-student').style.display = 'block';
    $('#student-form-error').textContent = '';
    showPage('add-student');
    $('#student-name').focus();
  }

  function handleSaveStudent(e) {
    e.preventDefault();
    const name = $('#student-name').value.trim();
    const cls = $('#student-class').value.trim();
    const studentId = $('#student-id-number').value.trim();
    const errorEl = $('#student-form-error');

    if (!name) {
      errorEl.textContent = 'Student name is required.';
      return;
    }
    if (!cls) {
      errorEl.textContent = 'Class/Section is required.';
      return;
    }

    errorEl.textContent = '';

    if (state.editStudentId) {
      // Edit existing
      const student = state.students.find(s => s.id === state.editStudentId);
      if (student) {
        student.name = name;
        student.class = cls;
        student.studentId = studentId || '';
        saveStudents();
        showToast('Student updated!');
      }
    } else {
      // Add new
      const newStudent = {
        id: generateId(),
        name: name,
        class: cls,
        studentId: studentId || '',
        createdAt: new Date().toISOString(),
      };
      state.students.push(newStudent);
      saveStudents();
      showToast('Student added!');
    }

    showPage('students');
    renderStudentList();
  }

  function handleDeleteStudent() {
    if (!state.editStudentId) return;

    showConfirmDialog(
      'Delete Student',
      'Are you sure you want to delete this student? All their attendance records will also be removed.',
      () => {
        const id = state.editStudentId;
        state.students = state.students.filter(s => s.id !== id);
        state.attendance = state.attendance.filter(r => r.studentId !== id);
        saveStudents();
        saveAttendance();
        showToast('Student deleted.');
        state.editStudentId = null;
        showPage('students');
        renderStudentList();
      }
    );
  }

  // ─── ATTENDANCE ────────────────────────────────────────────────
  function openAttendance() {
    state.currentDate = new Date().toISOString().slice(0, 10);
    $('#attendance-date').value = state.currentDate;
    resetAttendanceChanges();
    showPage('attendance');
    renderAttendanceList();
  }

  function resetAttendanceChanges() {
    state.attendanceChanges = {};
  }

  function hasUnsavedAttendance() {
    return Object.keys(state.attendanceChanges).length > 0;
  }

  function getAttendanceForDate(date) {
    return state.attendance.filter(r => r.date === date);
  }

  function renderAttendanceList() {
    const container = $('#attendance-list');
    const date = state.currentDate;
    const existingRecords = getAttendanceForDate(date);

    if (state.students.length === 0) {
      container.innerHTML = '<p class="empty-state">No students to mark. Add students first!</p>';
      return;
    }

    // Build a map of studentId -> existing status
    const existingMap = {};
    existingRecords.forEach(r => {
      existingMap[r.studentId] = r.status;
    });

    let html = '';
    state.students.forEach((student, index) => {
      const currentStatus = state.attendanceChanges[student.id] || existingMap[student.id] || '';
      const statusLabels = [
        { key: 'present', label: 'P', title: 'Present', cls: 'present' },
        { key: 'absent', label: 'A', title: 'Absent', cls: 'absent' },
        { key: 'late', label: 'L', title: 'Late', cls: 'late' },
        { key: 'excused', label: 'E', title: 'Excused', cls: 'excused' },
      ];

      let btnsHtml = '';
      statusLabels.forEach(sl => {
        const selected = currentStatus === sl.key ? `selected-${sl.cls}` : '';
        btnsHtml += `<button class="status-btn ${selected}" data-student-id="${student.id}" data-status="${sl.key}" title="${sl.title}">${sl.label}</button>`;
      });

      html += `
        <div class="attendance-item" style="animation-delay:${index * 30}ms">
          <div class="attendance-student-info">
            <div class="attendance-student-name">${escapeHtml(student.name)}</div>
            <div class="attendance-student-class">${escapeHtml(student.class || '')}</div>
          </div>
          <div class="attendance-status-btns">${btnsHtml}</div>
        </div>`;
    });
    container.innerHTML = html;

    // Attach click handlers
    container.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.dataset.studentId;
        const status = btn.dataset.status;

        // Update state
        state.attendanceChanges[studentId] = status;

        // Update UI for this student's buttons
        const parent = btn.closest('.attendance-status-btns');
        parent.querySelectorAll('.status-btn').forEach(b => {
          b.className = 'status-btn';
          if (b.dataset.status === status) {
            b.classList.add(`selected-${status}`);
          }
        });
      });
    });

    // Clear save message
    $('#attendance-save-msg').textContent = '';
  }

  function markAllAttendance(status) {
    const date = state.currentDate;
    state.students.forEach(student => {
      state.attendanceChanges[student.id] = status;
    });
    renderAttendanceList();
    showToast(`All marked as ${status}`);
  }

  function saveCurrentAttendance() {
    const date = state.currentDate;
    const changes = state.attendanceChanges;
    const changeCount = Object.keys(changes).length;
    const btn = $('#btn-save-attendance');

    if (changeCount === 0) {
      const msg = $('#attendance-save-msg');
      msg.textContent = 'No changes to save.';
      msg.style.color = 'var(--warning)';
      msg.style.opacity = '1';
      setTimeout(() => { msg.style.opacity = '0'; }, 2500);
      return;
    }

    // Disable button to prevent double-save
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';
    btn.style.opacity = '.7';

    // Remove existing records for this date
    state.attendance = state.attendance.filter(r => r.date !== date);

    // Add new records for each student with a status set
    Object.entries(changes).forEach(([studentId, status]) => {
      if (status) {
        state.attendance.push({
          id: generateId(),
          studentId: studentId,
          date: date,
          status: status,
          timestamp: new Date().toISOString(),
        });
      }
    });

    saveAttendance();

    // Reset changes so back-navigation doesn't warn
    state.attendanceChanges = {};

    const msg = $('#attendance-save-msg');
    msg.textContent = `✅ Attendance saved for ${formatDate(date)}! (${changeCount} students)`;
    msg.style.color = 'var(--success)';
    msg.style.opacity = '1';

    // Re-enable button
    btn.disabled = false;
    btn.textContent = '💾 Save Attendance';
    btn.style.opacity = '1';

    showToast('Attendance saved!');
  }

  // ─── HISTORY ───────────────────────────────────────────────────
  function renderHistory() {
    const dateFrom = $('#history-date-from').value;
    const dateTo = $('#history-date-to').value;
    const statusFilter = $('#history-status-filter').value;

    let records = [...state.attendance];

    // Date filter
    if (dateFrom) {
      records = records.filter(r => r.date >= dateFrom);
    }
    if (dateTo) {
      records = records.filter(r => r.date <= dateTo);
    }

    // Status filter
    if (statusFilter !== 'all') {
      records = records.filter(r => r.status === statusFilter);
    }

    // Sort by date descending, then by student name
    records.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const sa = state.students.find(s => s.id === a.studentId);
      const sb = state.students.find(s => s.id === b.studentId);
      return (sa?.name || '').localeCompare(sb?.name || '');
    });

    // Stats
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const excused = records.filter(r => r.status === 'excused').length;

    $('#hist-present').textContent = present;
    $('#hist-absent').textContent = absent;
    $('#hist-late').textContent = late;
    $('#hist-excused').textContent = excused;

    // List
    const container = $('#history-list');
    if (records.length === 0) {
      container.innerHTML = '<p class="empty-state">No attendance records found.</p>';
      return;
    }

    const statusLabels = {
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      excused: 'Excused',
    };

    let html = '';
    records.forEach((rec, i) => {
      const student = state.students.find(s => s.id === rec.studentId);
      if (!student) return;

      const d = new Date(rec.date + 'T00:00:00');
      const day = d.getDate();
      const month = d.toLocaleString('default', { month: 'short' });

      html += `
        <div class="history-record" style="animation: slideUp .25s ease ${i * 20}ms both">
          <div class="history-date-badge">
            <span class="history-day">${day}</span>
            <span class="history-month">${month}</span>
          </div>
          <div class="history-info">
            <div class="history-student-name">${escapeHtml(student.name)}</div>
            <div class="history-student-class">${escapeHtml(student.class || '')}</div>
          </div>
          <span class="badge badge-${rec.status}">${statusLabels[rec.status] || rec.status}</span>
        </div>`;
    });
    container.innerHTML = html;
  }

  function exportHistoryCSV() {
    const dateFrom = $('#history-date-from').value;
    const dateTo = $('#history-date-to').value;
    const statusFilter = $('#history-status-filter').value;

    let records = [...state.attendance];
    if (dateFrom) records = records.filter(r => r.date >= dateFrom);
    if (dateTo) records = records.filter(r => r.date <= dateTo);
    if (statusFilter !== 'all') records = records.filter(r => r.status === statusFilter);

    records.sort((a, b) => a.date.localeCompare(b.date));

    const statusLabels = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };

    let csv = 'Date,Student Name,Class,Student ID,Status\n';
    records.forEach(rec => {
      const student = state.students.find(s => s.id === rec.studentId);
      const name = student ? student.name : 'Unknown';
      const cls = student ? (student.class || '') : '';
      const sid = student ? (student.studentId || '') : '';
      const status = statusLabels[rec.status] || rec.status;
      csv += `"${rec.date}","${name}","${cls}","${sid}","${status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('CSV exported!');
  }

  // ─── SETTINGS ──────────────────────────────────────────────────
  function clearSettingsMessages() {
    $('#settings-error').textContent = '';
    $('#settings-success').textContent = '';
  }

  function handleChangePin() {
    const current = $('#settings-current-pin').value.trim();
    const newPin = $('#settings-new-pin').value.trim();
    const confirm = $('#settings-confirm-pin').value.trim();
    const errorEl = $('#settings-error');
    const successEl = $('#settings-success');

    errorEl.textContent = '';
    successEl.textContent = '';

    if (current !== state.controlNumber) {
      errorEl.textContent = 'Current control number is incorrect.';
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      errorEl.textContent = 'New control number must be exactly 4 digits.';
      return;
    }

    if (newPin !== confirm) {
      errorEl.textContent = 'New control numbers do not match.';
      return;
    }

    saveControlNumber(newPin);
    successEl.textContent = '✅ Control number updated!';
    $('#settings-current-pin').value = '';
    $('#settings-new-pin').value = '';
    $('#settings-confirm-pin').value = '';
    showToast('Control number changed!');
  }

  function exportAllData() {
    const data = {
      controlNumber: state.controlNumber,
      students: state.students,
      attendance: state.attendance,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Data exported!');
  }

  function handleImportData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        if (!data.students || !data.attendance) {
          showToast('Invalid backup file.');
          return;
        }

        showConfirmDialog(
          'Import Data',
          `This will replace all current data with the backup. You have ${data.students.length} students and ${data.attendance.length} attendance records in the backup. Continue?`,
          () => {
            state.students = data.students || [];
            state.attendance = data.attendance || [];
            if (data.controlNumber) {
              state.controlNumber = data.controlNumber;
              saveControlNumber(data.controlNumber);
            }
            saveStudents();
            saveAttendance();
            showToast(`Imported ${state.students.length} students and ${state.attendance.length} records.`);
            refreshDashboard();
          }
        );
      } catch (err) {
        showToast('Invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleResetData() {
    showConfirmDialog(
      '⚠️ Reset All Data',
      'This will permanently delete all students, attendance records, and the control number. This action cannot be undone. Are you absolutely sure?',
      () => {
        resetAllData();
        showToast('All data has been reset.');
        setupScreens();
      }
    );
  }

  // ─── UTILITY ───────────────────────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ─── TOAST ─────────────────────────────────────────────────────
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ─── CONFIRM DIALOG ────────────────────────────────────────────
  let confirmCallback = null;

  function showConfirmDialog(title, message, onConfirm, onCancel) {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#confirm-dialog').style.display = 'flex';
    confirmCallback = { onConfirm, onCancel };
  }

  function closeConfirmDialog() {
    $('#confirm-dialog').style.display = 'none';
    confirmCallback = null;
  }

  $('#confirm-ok').addEventListener('click', () => {
    const cb = confirmCallback;
    closeConfirmDialog();
    if (cb && cb.onConfirm) cb.onConfirm();
  });

  $('#confirm-cancel').addEventListener('click', () => {
    const cb = confirmCallback;
    closeConfirmDialog();
    if (cb && cb.onCancel) cb.onCancel();
  });

  // ─── PWA: Register Service Worker ──────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Service worker registration failed silently
      });
    });
  }

  // ─── Start ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
