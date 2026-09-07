/* ============================================
   DASHBOARD PAGE LOGIC
   ============================================ */

const Dashboard = {
    init() {
        if (!App.checkAuth()) return;
        this.renderSessionManager();
        this.renderStats();
        this.renderRecentEvaluations();
        this.renderDeptOverview();
        this.renderDepartmentStaffDirectory();
    },

    renderSessionManager() {
        const box = document.getElementById('hodSessionManager');
        const user = App.getCurrentUser();
        if (!box || !user || user.role !== 'HOD') { if (box) box.innerHTML = ''; return; }
        const sessions = App.getSessions().slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        const active = App.getActiveSession();
        box.innerHTML = `
            <div class="card session-manager">
                <div class="card-header"><div><h3 class="card-title">Appraisal Sessions</h3><small class="text-gray">Create a new session when the current appraisal cycle is finished.</small></div>
                <span class="badge ${active ? 'badge-approved' : 'badge-pending'}">${active ? active.name + ' • OPEN' : 'NO ACTIVE SESSION'}</span></div>
                <div class="card-body"><div class="session-controls">
                    <div class="input-group"><span class="input-group-text"><i class="bi bi-calendar2-plus"></i></span><input id="newSessionName" class="form-control" placeholder="e.g. 2026/2027" inputmode="numeric"></div>
                    <button class="btn btn-primary" id="createSessionBtn"><i class="bi bi-plus-circle"></i> Create New Session</button>
                    ${active ? '<button class="btn btn-outline-danger" id="closeSessionBtn"><i class="bi bi-lock"></i> Close Current</button>' : ''}
                </div>
                <div class="session-history">${sessions.slice(0,5).map(s => `<span class="session-chip ${s.status === 'Open' ? 'current' : ''}"><i class="bi bi-calendar3"></i>${s.name}<small>${s.status}</small></span>`).join('') || '<span class="text-gray">No sessions created yet.</span>'}</div></div>
            </div>`;
        document.getElementById('createSessionBtn')?.addEventListener('click', async () => {
            const result = await App.createAppraisalSession(document.getElementById('newSessionName').value);
            App.showToast(result.message || 'New appraisal session created.', result.ok ? 'success' : 'error');
            if (result.ok) { this.renderSessionManager(); this.renderStats(); }
        });
        document.getElementById('closeSessionBtn')?.addEventListener('click', async () => {
            if (confirm('Close the current appraisal session? Lecturers will need a new session before they can apply again.')) {
                await App.closeActiveSession(); this.renderSessionManager(); this.renderStats(); App.showToast('Appraisal session closed.');
            }
        });
    },

    renderStats() {
        const user = App.getCurrentUser();
        const users = App.getUsers();
        const evaluations = JSON.parse(localStorage.getItem('evaluations')) || [];

        let stats = [];

        if (user.role === 'VC') {
            const totalStaff = users.filter(u => u.role !== 'VC' && u.isActive !== false).length;
            const totalDepts = App.getDepartments().length;
            const totalEvals = evaluations.length;
            stats = [
                { icon: 'people-fill', color: 'primary', value: totalStaff, label: 'Total Staff', link: '../PAGES/departments.html' },
                { icon: 'building', color: 'info', value: totalDepts, label: 'Departments', link: '../PAGES/departments.html' },
                { icon: 'clipboard-check', color: 'success', value: totalEvals, label: 'Completed Evaluations', link: '../PAGES/leaderboard.html' },
                { icon: 'trophy-fill', color: 'warning', value: totalEvals, label: 'Leaderboard Records', link: '../PAGES/leaderboard.html' }
            ];
        } else if (user.role === 'HOD') {
            const deptStaff = users.filter(u => u.department === user.department && u.role === 'Lecturer' && u.isActive !== false).length;
            const deptEvals = evaluations.filter(e => e.department === user.department).length;
            const pendingApps = (JSON.parse(localStorage.getItem('applications')) || [])
                .filter(a => a.department === user.department && a.status === 'Pending').length;
            const avgScore = this.getDeptAvgScore(user.department);

            stats = [
                { icon: 'people-fill', color: 'primary', value: deptStaff, label: 'Dept Lecturers', link: '../PAGES/evaluation.html' },
                { icon: 'clipboard-check', color: 'success', value: deptEvals, label: 'Reviewed Results', link: '../PAGES/evaluation.html' },
                { icon: 'file-earmark-text', color: 'warning', value: pendingApps, label: 'Pending Apps', link: '../PAGES/staff-applications.html' },
                { icon: 'star-fill', color: 'info', value: avgScore, label: 'Avg Score', link: '../PAGES/leaderboard.html' }
            ];
        } else if (user.role === 'Student') {
            const myEvals = evaluations.filter(e => e.evaluatorId === user.id);
            const activeSession = App.getActiveSession();
            
            stats = [
                { icon: 'clipboard-check', color: 'primary', value: myEvals.length, label: 'Evaluations Submitted', link: '../PAGES/student-evaluation.html' },
                { icon: 'calendar2-check', color: 'success', value: activeSession ? activeSession.name : 'Closed', label: 'Current Session', link: '../PAGES/student-evaluation.html' },
                { icon: 'building', color: 'info', value: user.department, label: 'Department', link: '#' }
            ];
        } else {
            // Lecturer
            const myEvals = evaluations.filter(e => e.staffId === user.id);
            const reviews = JSON.parse(localStorage.getItem('hodReviews')) || [];
            const reviewedEvals = myEvals.filter(e => reviews.some(r => r.staffId === e.staffId && r.sessionId === e.sessionId));
            const myApps = (JSON.parse(localStorage.getItem('applications')) || []).filter(a => a.staffId === user.id);
            const certCount = (user.certificates || []).length;
            const activeSession = App.getActiveSession();
            const activeApp = activeSession ? myApps.find(a => a.sessionId === activeSession.id) : null;

            stats = [
                { icon: 'clipboard-check', color: 'primary', value: reviewedEvals.length, label: 'Evaluations Completed', link: '../PAGES/dashboard.html' },
                { icon: 'calendar2-check', color: 'success', value: activeSession ? activeSession.name : 'Closed', label: 'Current Session', link: '../PAGES/apply-for-eval.html' },
                { icon: 'file-earmark-text', color: 'warning', value: activeApp ? activeApp.status : 'Not Applied', label: 'Current Application', link: '../PAGES/apply-for-eval.html' },
                { icon: 'award', color: 'info', value: certCount, label: 'Certificates', link: '../PAGES/profile.html' }
            ];
        }

        const html = stats.map(s => `
            <a href="${s.link}" class="stats-card-link">
                <div class="stats-card">
                    <div class="stats-icon ${s.color}">
                        <i class="bi bi-${s.icon}"></i>
                    </div>
                    <div class="stats-info">
                        <h3>${s.value}</h3>
                        <p>${s.label}</p>
                    </div>
                </div>
            </a>
        `).join('');

        document.getElementById('statsRow').innerHTML = html;
    },


    renderDepartmentStaffDirectory() {
        const container = document.getElementById('departmentStaffDirectory');
        const user = App.getCurrentUser();
        if (!container || !user) return;

        const users = App.getUsers();
        const departments = App.getDepartments();

        // HOD gets a complete directory for only their own department.
        if (user.role === 'HOD') {
            const dept = user.department || 'Unassigned';
            const hod = users.find(u => u.id === user.id && u.role === 'HOD' && u.isActive !== false)
                || users.find(u => u.department === dept && u.role === 'HOD' && u.isActive !== false);

            const lecturers = users
                .filter(u => u.department === dept && u.role !== 'VC' && u.id !== (hod && hod.id) && u.isActive !== false)
                .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));

            const people = hod ? [hod, ...lecturers] : lecturers;
            container.innerHTML = `
                <div class="card department-directory-card mb-4">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title"><i class="bi bi-people-fill me-2"></i>${this.escapeHtml(dept)} Staff Directory</h3>
                            <small class="text-gray">All active staff registered under your department.</small>
                        </div>
                        <span class="badge badge-primary">${people.length} ${people.length === 1 ? 'Staff' : 'Staff'}</span>
                    </div>
                    <div class="card-body">
                        ${people.length ? `
                            <div class="department-staff-list">
                                ${people.map((person, index) => `
                                    <div class="department-staff-item ${person.role === 'HOD' ? 'is-hod' : ''}">
                                        <div class="staff-avatar"><i class="bi bi-person-fill"></i></div>
                                        <div class="staff-directory-info">
                                            <strong>${this.escapeHtml(person.fullName || 'Unnamed Staff')}</strong>
                                            <span>${this.escapeHtml(person.staffId || 'No Staff ID')} ${person.role === 'HOD' ? '<b class="directory-role">HOD</b>' : '<b class="directory-role lecturer-role">Lecturer</b>'}</span>
                                        </div>
                                        <span class="directory-number">${index + 1}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="empty-state py-3"><i class="bi bi-people"></i><p>No staff registered in this department yet.</p></div>'}
                    </div>
                </div>`;
            return;
        }

        // VC gets one automatically generated card for every department.
        if (user.role === 'VC') {
            container.innerHTML = `
                <div class="mb-3">
                    <h3 class="section-heading"><i class="bi bi-building me-2"></i>Department Staff Directory</h3>
                    <p class="text-gray mb-0">Complete staff lists and headcounts for every department.</p>
                </div>
                <div class="row g-3">
                    ${departments.length ? departments.map(dept => {
                        const hod = users.find(u => u.department === dept && u.role === 'HOD' && u.isActive !== false);
                        const lecturers = users
                            .filter(u => u.department === dept && u.role !== 'VC' && u.id !== (hod && hod.id) && u.isActive !== false)
                            .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
                        const people = hod ? [hod, ...lecturers] : lecturers;
                        return `
                            <div class="col-12 col-md-6 col-xl-4">
                                <div class="card department-directory-card h-100">
                                    <div class="card-header">
                                        <div>
                                            <h4 class="card-title mb-1">${this.escapeHtml(dept)}</h4>
                                            <small class="text-gray">${people.length} ${people.length === 1 ? 'staff member' : 'staff members'}</small>
                                        </div>
                                        <span class="dept-count-badge">${people.length}</span>
                                    </div>
                                    <div class="card-body p-3">
                                        ${people.length ? `
                                            <div class="department-staff-list compact">
                                                ${people.map((person, index) => `
                                                    <div class="department-staff-item ${person.role === 'HOD' ? 'is-hod' : ''}">
                                                        <div class="staff-avatar"><i class="bi bi-person-fill"></i></div>
                                                        <div class="staff-directory-info">
                                                            <strong>${this.escapeHtml(person.fullName || 'Unnamed Staff')}</strong>
                                                            <span>${this.escapeHtml(person.staffId || 'No Staff ID')} ${person.role === 'HOD' ? '<b class="directory-role">HOD</b>' : '<b class="directory-role lecturer-role">Lecturer</b>'}</span>
                                                        </div>
                                                        <span class="directory-number">${index + 1}</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : '<div class="directory-empty"><i class="bi bi-person-x"></i><span>No staff registered yet</span></div>'}
                                    </div>
                                </div>
                            </div>`;
                    }).join('') : '<div class="col-12"><div class="empty-state"><i class="bi bi-building"></i><p>No departments created yet.</p></div></div>'}
                </div>`;
            return;
        }

        // Lecturer does not need the full directory.
        container.innerHTML = '';
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[char]));
    },
    getDeptAvgScore(dept) {
        const evaluations = JSON.parse(localStorage.getItem('evaluations')) || [];
        const deptEvals = evaluations.filter(e => e.department === dept);
        if (deptEvals.length === 0) return 0;
        const total = deptEvals.reduce((sum, e) => sum + (e.totalScore || 0), 0);
        return (total / deptEvals.length).toFixed(1);
    },

    renderRecentEvaluations() {
        const evaluations = JSON.parse(localStorage.getItem('evaluations')) || [];
        const reviews = JSON.parse(localStorage.getItem('hodReviews')) || [];
        const users = App.getUsers();
        const user = App.getCurrentUser();
        const recentLink = document.getElementById('recentEvaluationsLink');
        if (recentLink) {
            if (user.role === 'HOD') {
                recentLink.href = 'evaluation.html';
                recentLink.textContent = 'View All';
                recentLink.classList.remove('hidden');
            } else if (user.role === 'VC') {
                recentLink.href = 'leaderboard.html';
                recentLink.textContent = 'View Leaderboard';
                recentLink.classList.remove('hidden');
            } else {
                recentLink.classList.add('hidden');
            }
        }

        let recent = evaluations;
        if (user.role === 'HOD') {
            recent = evaluations.filter(e => e.department === user.department);
        } else if (user.role === 'Lecturer') {
            // Group by session to avoid duplicating the same session multiple times since multiple students evaluate
            const grouped = {};
            evaluations.filter(e => e.staffId === user.id).forEach(e => {
                if(!grouped[e.sessionId]) grouped[e.sessionId] = { ...e, evalsCount:0, totalScoreSum:0 };
                grouped[e.sessionId].evalsCount++;
                grouped[e.sessionId].totalScoreSum += (e.totalScore||0);
            });
            recent = Object.values(grouped).map(g => ({...g, totalScore: Math.round(g.totalScoreSum / g.evalsCount)}));
        } else if (user.role === 'Student') {
            recent = evaluations.filter(e => e.evaluatorId === user.id);
        }

        recent = recent.slice(-5).reverse();

        if (recent.length === 0) {
            document.getElementById('recentEvalsBody').innerHTML = `
                <tr><td colspan="4" class="text-center text-gray py-4">No evaluations yet</td></tr>
            `;
            return;
        }

        const html = recent.map(e => {
            const staff = users.find(u => u.id === e.staffId);
            const review = reviews.find(r => r.staffId === e.staffId && r.sessionId === e.sessionId);
            
            let actionBadge = '<span class="badge badge-evaluated">Evaluated</span>';
            let scoreDisplay = '<strong>' + (e.totalScore || 0) + '%</strong>';
            
            if (user.role === 'Lecturer' && review) {
                actionBadge = `<span class="badge ${review.recommendation.includes('promotion') ? 'badge-approved' : 'badge-danger'}">${review.recommendation.includes('promotion') ? 'Promoted' : 'Warned'}</span>`;
            } else if (user.role === 'Lecturer' && !review) {
                actionBadge = '<span class="badge badge-pending">Pending Review</span>';
                scoreDisplay = '<span class="text-gray">Hidden</span>';
            }

            return `
                <tr>
                    <td>${staff ? staff.fullName : 'Unknown'}</td>
                    <td>${e.sessionName || 'N/A'}</td>
                    <td>${scoreDisplay}</td>
                    <td>${actionBadge}</td>
                </tr>
            `;
        }).join('');

        document.getElementById('recentEvalsBody').innerHTML = html;
    },

    renderDeptOverview() {
        const user = App.getCurrentUser();
        const container = document.getElementById('deptOverview');

        if (user.role === 'Lecturer' || user.role === 'Student') {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-building"></i>
                    <h3>${user.department}</h3>
                    <p>Your department</p>
                </div>
            `;
            return;
        }

        const depts = user.role === 'VC' ? App.getDepartments() : [user.department];
        const users = App.getUsers();

        const html = depts.map(dept => {
            const staffCount = users.filter(u => u.department === dept && u.role === 'Lecturer' && u.isActive !== false).length;
            const hod = users.find(u => u.department === dept && u.role === 'HOD' && u.isActive !== false);
            return `
                <div class="d-flex justify-content-between align-center mb-3 pb-3" style="border-bottom: 1px solid #eee;">
                    <div>
                        <h5 class="mb-1">${dept}</h5>
                        <p class="text-gray mb-0" style="font-size: 13px;">HOD: ${hod ? hod.fullName : 'Not Assigned'}</p>
                    </div>
                    <span class="badge badge-primary">${staffCount} Staff</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html || '<p class="text-gray text-center">No departments</p>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Dashboard.init();
});
