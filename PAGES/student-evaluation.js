/* ============================================
   STUDENT EVALUATION LOGIC - SESSION BASED
   ============================================ */
const StudentEvaluation = {
    currentStaff: null,
    allStaff: [],
    criteria: [
        'Teaching Effectiveness',
        'Subject Knowledge',
        'Communication Skills',
        'Classroom Management',
        'Accessibility / Availability',
        'Fairness in Grading',
        'Course Content Quality'
    ],

    init() {
        if (!App.checkAuth()) return;
        if (!App.isStudent()) {
            window.location.href = 'dashboard.html';
            return;
        }
        this.renderSessionState();
        this.allStaff = this.getLecturers();
        this.renderStaffList(this.allStaff);
        this.setupModal();
        this.setupScoreCalculation();
        this.setupSearch();
    },

    getActiveSession() { return App.getActiveSession(); },

    renderSessionState() {
        const session = this.getActiveSession();
        const box = document.getElementById('evaluationSessionState');
        if (!box) return;
        box.innerHTML = session ? `
            <div class="session-banner active-session">
                <div><i class="bi bi-calendar2-check-fill"></i><div><strong>${session.name}</strong><small>Active appraisal session</small></div></div>
                <span class="badge badge-approved">OPEN</span>
            </div>` : `
            <div class="session-banner closed-session">
                <div><i class="bi bi-calendar-x"></i><div><strong>No active session</strong><small>Evaluation is currently closed.</small></div></div>
            </div>`;
    },

    getLecturers() {
        const user = App.getCurrentUser();
        const users = App.getUsers();
        // Students can evaluate all active lecturers in their department
        return users.filter(u => u.role === 'Lecturer' && u.isActive !== false && u.department === user.department);
    },

    hasBeenEvaluated(staffId) {
        const session = this.getActiveSession();
        if (!session) return false;
        const user = App.getCurrentUser();
        return (JSON.parse(localStorage.getItem('evaluations')) || [])
            .some(e => e.staffId === staffId && e.sessionId === session.id && e.evaluatorId === user.id);
    },

    renderStaffList(staff) {
        const tbody = document.getElementById('evalTableBody');
        if (!tbody) return;
        const session = this.getActiveSession();

        if (!session || staff.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-gray py-4">
                <i class="bi bi-calendar2-x" style="font-size:24px;display:block;margin-bottom:10px"></i>
                ${session ? 'No lecturers available for evaluation.' : 'No active evaluation session.'}
            </td></tr>`;
            return;
        }

        tbody.innerHTML = staff.map(s => {
            const done = this.hasBeenEvaluated(s.id);
            return `<tr>
                <td><strong>${App.escapeHtml ? App.escapeHtml(s.fullName) : s.fullName}</strong></td>
                <td>${s.department}</td>
                <td>${done ? '<span class="badge badge-evaluated">Completed</span>' : '<span class="badge badge-pending">Pending</span>'}</td>
                <td>${done ? `<button class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-lock-fill"></i> Evaluated</button>` : `<button class="btn btn-sm btn-primary eval-btn" data-id="${s.id}"><i class="bi bi-clipboard-check"></i> Evaluate</button>`}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.eval-btn').forEach(btn => btn.addEventListener('click', () => this.openEvalModal(btn.dataset.id)));
    },

    setupSearch() {
        const input = document.getElementById('evalSearch');
        if (!input) return;
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            this.renderStaffList(this.allStaff.filter(s => s.fullName.toLowerCase().includes(q)));
        });
    },

    openEvalModal(staffId) {
        if (!this.getActiveSession()) { App.showToast('No active evaluation session.', 'error'); return; }
        if (this.hasBeenEvaluated(staffId)) { App.showToast('You have already evaluated this lecturer.', 'error'); this.renderStaffList(this.allStaff); return; }
        const staff = App.getUsers().find(u => u.id === staffId);
        if (!staff) return;
        this.currentStaff = staff;
        document.getElementById('evalStaffName').textContent = staff.fullName;
        document.getElementById('evalStaffDept').textContent = `${staff.department} • ${this.getActiveSession().name}`;
        for (let i = 1; i <= 7; i++) document.getElementById('score' + i).value = 0;
        document.getElementById('evalComments').value = '';
        this.updateTotalScore();
        document.getElementById('evalModal').classList.add('active');
    },

    setupModal() {
        document.getElementById('closeEvalModal')?.addEventListener('click', () => document.getElementById('evalModal').classList.remove('active'));
        document.getElementById('cancelEval')?.addEventListener('click', () => document.getElementById('evalModal').classList.remove('active'));
        document.getElementById('submitEval')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.submitEvaluation();
        });
    },

    setupScoreCalculation() {
        for (let i = 1; i <= 7; i++) document.getElementById('score' + i)?.addEventListener('input', () => this.updateTotalScore());
    },

    updateTotalScore() {
        let total = 0;
        for (let i = 1; i <= 7; i++) total += Math.min(10, Math.max(0, Number(document.getElementById('score' + i).value) || 0));
        const percentage = Math.round((total / 70) * 100);
        document.getElementById('totalScoreDisplay').textContent = `${percentage}% (${total} / 70)`;
        document.getElementById('scoreProgress').style.width = percentage + '%';
    },

    async submitEvaluation() {
        const session = this.getActiveSession();
        if (!session || !this.currentStaff) return;
        if (this.hasBeenEvaluated(this.currentStaff.id)) {
            App.showToast('You have already evaluated this lecturer.', 'error');
            document.getElementById('evalModal').classList.remove('active');
            this.renderStaffList(this.allStaff);
            return;
        }

        const scores = {};
        let rawTotal = 0;
        for (let i = 1; i <= 7; i++) {
            const value = Math.min(10, Math.max(0, Number(document.getElementById('score' + i).value) || 0));
            scores['criterion' + i] = value;
            rawTotal += value;
        }
        const percentage = Math.round((rawTotal / 70) * 100);
        const evaluationPayload = {
            id: 'EVAL-' + Date.now(),
            sessionId: session.id,
            sessionName: session.name,
            staffId: this.currentStaff.id,
            department: this.currentStaff.department,
            scores,
            totalRaw: rawTotal,
            totalScore: percentage,
            comments: document.getElementById('evalComments').value.trim()
        };

        try {
            const res = await App.addEvaluation(evaluationPayload);
            
            if (res.ok) {
                await App.addNotification(this.currentStaff.id, `A student has submitted an evaluation for ${session.name}.`, 'info', 'dashboard.html');
                document.getElementById('evalModal').classList.remove('active');
                App.showToast('Evaluation submitted successfully!');
                await App.fetchState();
                this.allStaff = this.getLecturers();
                this.renderStaffList(this.allStaff);
            } else {
                App.showToast('Failed to submit evaluation', 'error');
            }
        } catch (e) {
            App.showToast('Network error', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => StudentEvaluation.init());
