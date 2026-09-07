/* ============================================
   HOD EVALUATION LOGIC - SESSION BASED
   ============================================ */
const Evaluation = {
    currentStaff: null,
    allStaff: [],

    init() {
        if (!App.checkAuth()) return;
        if (!App.isHOD()) {
            window.location.href = 'dashboard.html';
            return;
        }
        this.renderSessionState();
        this.allStaff = this.getApprovedLecturers();
        this.renderStaffList(this.allStaff);
        this.setupFilters();
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
                <div><i class="bi bi-calendar-x"></i><div><strong>No active session</strong><small>Create a session from the HOD dashboard before reviewing staff.</small></div></div>
            </div>`;
    },

    getApprovedLecturers() {
        const user = App.getCurrentUser();
        const users = App.getUsers();
        const applications = JSON.parse(localStorage.getItem('applications')) || [];
        const session = this.getActiveSession();
        if (!session) return [];

        const approvedStaffIds = new Set(
            applications.filter(a => a.status === 'Approved' && a.sessionId === session.id).map(a => a.staffId)
        );

        return users.filter(u => u.role === 'Lecturer' && u.isActive !== false && approvedStaffIds.has(u.id) && u.department === user.department);
    },

    hasBeenEvaluated(staffId) {
        const session = this.getActiveSession();
        if (!session) return false;
        return (JSON.parse(localStorage.getItem('hodReviews')) || [])
            .some(e => e.staffId === staffId && e.sessionId === session.id);
    },

    getEvaluation(staffId) {
        const session = this.getActiveSession();
        if (!session) return null;
        return (JSON.parse(localStorage.getItem('hodReviews')) || [])
            .find(e => e.staffId === staffId && e.sessionId === session.id) || null;
    },

    renderStaffList(staff) {
        const tbody = document.getElementById('evalTableBody');
        if (!tbody) return;
        const session = this.getActiveSession();

        if (!session || staff.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray py-4">
                <i class="bi bi-calendar2-x" style="font-size:24px;display:block;margin-bottom:10px"></i>
                ${session ? 'No approved lecturers available for this session.' : 'No active appraisal session. Create a new session first.'}
            </td></tr>`;
            return;
        }

        tbody.innerHTML = staff.map(s => {
            const review = this.getEvaluation(s.id);
            const done = !!review;
            return `<tr>
                <td><strong>${App.escapeHtml ? App.escapeHtml(s.fullName) : s.fullName}</strong></td>
                <td>${s.staffId}</td>
                <td>${s.department}</td>
                <td>${done ? App.formatDate(review.date) : 'Not yet reviewed'}</td>
                <td>${done ? '<span class="badge badge-evaluated">Reviewed</span>' : '<span class="badge badge-pending">Pending Review</span>'}</td>
                <td>${done ? `<button class="btn btn-sm btn-outline-secondary" disabled><i class="bi bi-lock-fill"></i> Reviewed</button>` : `<button class="btn btn-sm btn-primary eval-btn" data-id="${s.id}"><i class="bi bi-clipboard-check"></i> Review</button>`}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.eval-btn').forEach(btn => btn.addEventListener('click', () => this.openEvalModal(btn.dataset.id)));
    },

    setupSearch() {
        const input = document.getElementById('evalSearch');
        if (!input) return;
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            this.renderStaffList(this.allStaff.filter(s => s.fullName.toLowerCase().includes(q) || s.staffId.toLowerCase().includes(q)));
        });
    },

    setupFilters() {
        const deptFilter = document.getElementById('deptFilter');
        if (deptFilter) deptFilter.style.display = 'none';
    },

    openEvalModal(staffId) {
        if (!this.getActiveSession()) { App.showToast('Create an appraisal session first.', 'error'); return; }
        if (this.hasBeenEvaluated(staffId)) { App.showToast('You have already reviewed this lecturer for this session.', 'error'); this.renderStaffList(this.allStaff); return; }
        const staff = App.getUsers().find(u => u.id === staffId);
        if (!staff) return;
        this.currentStaff = staff;
        document.getElementById('evalStaffName').textContent = staff.fullName;
        document.getElementById('evalStaffDept').textContent = `${staff.department} • ${this.getActiveSession().name}`;
        
        // Calculate average student score
        const evals = JSON.parse(localStorage.getItem('evaluations')) || [];
        const studentEvals = evals.filter(e => e.staffId === staffId && e.sessionId === this.getActiveSession().id && e.evaluatorRole === 'Student');
        let avgScore = 0;
        if (studentEvals.length > 0) {
            const sum = studentEvals.reduce((s, e) => s + (e.totalScore || 0), 0);
            avgScore = Math.round(sum / studentEvals.length);
        }
        
        document.getElementById('totalScoreDisplay').textContent = `${avgScore}%`;
        document.getElementById('scoreProgress').style.width = `${avgScore}%`;
        
        document.getElementById('hodRecommendation').value = '';
        document.getElementById('evalComments').value = '';
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
        // No longer needed
    },

    async submitEvaluation() {
        const session = this.getActiveSession();
        if (!session || !this.currentStaff) return;
        if (this.hasBeenEvaluated(this.currentStaff.id)) {
            App.showToast('You have already reviewed this lecturer.', 'error');
            document.getElementById('evalModal').classList.remove('active');
            this.renderStaffList(this.allStaff);
            return;
        }

        const recommendation = document.getElementById('hodRecommendation').value;
        if (!recommendation) {
            App.showToast('Please select a recommendation.', 'error');
            return;
        }

        const reviewPayload = {
            id: 'HODREV-' + Date.now(),
            sessionId: session.id,
            sessionName: session.name,
            staffId: this.currentStaff.id,
            department: this.currentStaff.department,
            recommendation: recommendation,
            comments: document.getElementById('evalComments').value.trim()
        };

        try {
            const res = await App.addHodReview(reviewPayload);
            
            if (res.ok) {
                await App.addNotification(this.currentStaff.id, `Your ${session.name} results have been reviewed by the HOD and sent to the VC.`, 'info', 'dashboard.html');
                document.getElementById('evalModal').classList.remove('active');
                App.showToast('Review submitted successfully!');
                await App.fetchState();
                this.allStaff = this.getApprovedLecturers();
                this.renderStaffList(this.allStaff);
            } else {
                App.showToast('Failed to submit review', 'error');
            }
        } catch (e) {
            App.showToast('Network error', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Evaluation.init());
