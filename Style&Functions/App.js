/* ============================================
   STAFF APPRAISAL & EVALUATION SYSTEM
   App.js - Central Router & Core Logic (Backend Connected)
   ============================================ */

const App = {
    currentUser: null,
    token: null,
    state: {
        users: [],
        departments: [],
        sessions: [],
        applications: [],
        evaluations: [],
        hodReviews: [],
        notifications: []
    },
    API_URL: '/api',

    async init() {
        if (!localStorage.getItem('departments')) {
            localStorage.setItem('departments', JSON.stringify(['Computer Science', 'Mathematics', 'Physics', 'Information Technology', 'Software Engineering']));
        }
        
        let existingUsers = JSON.parse(localStorage.getItem('users')) || [];
        if (!existingUsers.some(u => u.email === 'vc@university.edu')) {
            const defaultUsers = [
                { id: 'VC-001', email: 'vc@university.edu', password: 'vc123456', fullName: 'Vice Chancellor', role: 'VC', department: 'Administration', isActive: true },
                { id: 'HOD-001', email: 'hod@university.edu', password: 'hod123456', fullName: 'Head of Computer Science', role: 'HOD', department: 'Computer Science', isActive: true },
                { id: 'LEC-001', email: 'lecturer@university.edu', password: 'lec123456', fullName: 'Dr. Lecturer', role: 'Lecturer', department: 'Computer Science', staffId: 'LEC-100001', isActive: true },
                { id: 'STU-001', email: 'student@university.edu', password: 'stu123456', fullName: 'John Student', role: 'Student', department: 'Computer Science', staffId: 'STU-200001', isActive: true }
            ];
            existingUsers = [...existingUsers, ...defaultUsers];
            localStorage.setItem('users', JSON.stringify(existingUsers));
        }

        this.token = localStorage.getItem('token');
        if (this.token) {
            this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
            await this.fetchState();
        }
        this.checkAuth();
        this.setupEventListeners();
    },

    async fetchState() {
        if (!this.token) return;
        try {
            this.state.users = JSON.parse(localStorage.getItem('users')) || [];
            this.state.departments = JSON.parse(localStorage.getItem('departments')) || [];
            this.state.sessions = JSON.parse(localStorage.getItem('sessions')) || [];
            this.state.applications = JSON.parse(localStorage.getItem('applications')) || [];
            this.state.evaluations = JSON.parse(localStorage.getItem('evaluations')) || [];
            this.state.hodReviews = JSON.parse(localStorage.getItem('hodReviews')) || [];
            this.state.notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        } catch (e) {
            console.error('Failed to fetch state from localStorage', e);
        }
    },

    checkAuth() {
        const path = window.location.pathname.toLowerCase();
        const href = window.location.href.toLowerCase();

        const isAuthPage = path === '/' ||
                           path.endsWith('/index.html') ||
                           path.endsWith('index.html') ||
                           path.includes('login') || 
                           path.includes('signup') ||
                           path.includes('forgot') ||
                           path.includes('password') ||
                           href.includes('login.html') ||
                           href.includes('signup.html') ||
                           href.includes('forgot-password.html');

        if (!this.currentUser && !isAuthPage) {
            window.location.href = '../index.html';
            return false;
        }

        if (this.currentUser) {
            if (!isAuthPage) {
                const page = path.split('/').pop().replace('.html','');
                const protectedPage = ['evaluation','staff-applications','leaderboard','departments','apply-for-eval'];
                if (protectedPage.includes(page) && !this.canAccess(page)) {
                    window.location.href = 'dashboard.html';
                    return false;
                }
                this.renderNav();
            }
        }
        return true;
    },

    setupEventListeners() {
        return;
    },

    generateSystemId() {
        const year = new Date().getFullYear();
        let maxSeq = 0;
        const users = this.state.users || [];
        users.filter(u => u.id && u.id.includes(`STF/${year}`)).forEach(u => {
            const parts = u.id.split('/');
            if (parts.length === 3) {
                const seq = parseInt(parts[2], 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        });
        const nextSeq = String(maxSeq + 1).padStart(3, '0');
        return `STF/${year}/${nextSeq}`;
    },

    getUsers() { return this.state.users; },
    getCurrentUser() { return this.currentUser; },

    setCurrentUser(user, token) {
        this.currentUser = user;
        this.token = token;
        localStorage.setItem('currentUser', JSON.stringify(user));
        if (token) localStorage.setItem('token', token);
    },

    logout() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        window.location.href = '../index.html';
    },

    showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'exclamation-triangle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    renderNav() {},

    hasRole(role) { return this.currentUser && this.currentUser.role === role; },
    isHOD() { return this.hasRole('HOD'); },
    isVC() { return this.hasRole('VC'); },
    isLecturer() { return this.hasRole('Lecturer'); },
    isStudent() { return this.hasRole('Student'); },

    getRolePermissions() {
        if (!this.currentUser) return [];
        const perms = {
            'VC': ['dashboard', 'profile', 'leaderboard', 'departments', 'settings'],
            'HOD': ['dashboard', 'profile', 'evaluation', 'staff-applications', 'leaderboard', 'settings'],
            'Lecturer': ['dashboard', 'profile', 'apply-for-eval', 'settings'],
            'Student': ['student-evaluation', 'profile', 'settings']
        };
        return perms[this.currentUser.role] || [];
    },

    canAccess(page) { return this.getRolePermissions().includes(page); },

    fileIcon(name) {
        const n = String(name || '').toLowerCase();
        if (n.endsWith('.pdf')) return 'bi-file-earmark-pdf';
        if (n.endsWith('.doc') || n.endsWith('.docx')) return 'bi-file-earmark-word';
        if (n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png') || n.endsWith('.webp')) return 'bi-file-earmark-image';
        return 'bi-file-earmark-text';
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    getDepartments() { return this.state.departments; },

    getSessions() { return this.state.sessions; },
    getActiveSession() { return this.state.sessions.find(s => s.status === 'Open') || null; },

    async createAppraisalSession(name) {
        if (!this.isHOD()) return { ok: false, message: 'Only HOD can create sessions.' };
        const session = { id: 'SESSION-' + Date.now(), name, status: 'Open', createdBy: this.currentUser.id, createdAt: new Date().toISOString() };
        this.state.sessions.push(session);
        localStorage.setItem('sessions', JSON.stringify(this.state.sessions));
        return { ok: true, message: 'Session created' };
    },

    async closeActiveSession() {
        if (!this.isHOD()) return false;
        this.state.sessions.forEach(s => {
            if (s.status === 'Open') {
                s.status = 'Closed';
                s.closedAt = new Date().toISOString();
            }
        });
        localStorage.setItem('sessions', JSON.stringify(this.state.sessions));
        return true;
    },

    getNotifications() { 
        return this.state.notifications.filter(n => n.userId === this.currentUser?.id).sort((a,b) => new Date(b.date) - new Date(a.date)); 
    },

    async addNotification(userId, message, type = 'info', link = null) {
        const notif = { id: 'NOTIF-' + Date.now(), userId, message, type, link, date: new Date().toISOString(), read: 0 };
        this.state.notifications.push(notif);
        localStorage.setItem('notifications', JSON.stringify(this.state.notifications));
        this.updateNotificationBadge();
    },

    getUnreadCount() {
        return this.state.notifications.filter(n => n.userId === this.currentUser?.id && !n.read).length;
    },

    async markNotificationRead(notifId) {
        const notif = this.state.notifications.find(n => n.id === notifId);
        if (notif) {
            notif.read = 1;
            localStorage.setItem('notifications', JSON.stringify(this.state.notifications));
        }
        this.updateNotificationBadge();
    },

    async markAllRead() {
        this.state.notifications.forEach(n => {
            if (n.userId === this.currentUser?.id) n.read = 1;
        });
        localStorage.setItem('notifications', JSON.stringify(this.state.notifications));
        this.updateNotificationBadge();
    },

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            const count = this.getUnreadCount();
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    async addApplication(payload) {
        this.state.applications.push(payload);
        localStorage.setItem('applications', JSON.stringify(this.state.applications));
        return { ok: true };
    },

    async updateApplicationStatus(id, status) {
        const app = this.state.applications.find(a => a.id === id);
        if (app) {
            app.status = status;
            localStorage.setItem('applications', JSON.stringify(this.state.applications));
            return { ok: true };
        }
        return { ok: false };
    },

    async addEvaluation(payload) {
        this.state.evaluations.push(payload);
        localStorage.setItem('evaluations', JSON.stringify(this.state.evaluations));
        return { ok: true };
    },

    async addHodReview(payload) {
        this.state.hodReviews.push(payload);
        localStorage.setItem('hodReviews', JSON.stringify(this.state.hodReviews));
        return { ok: true };
    },

    toggleDarkMode() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'true' : 'false');
        this.updateDarkModeIcon();
    },

    loadDarkMode() {
        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) document.body.classList.add('dark-mode');
        this.updateDarkModeIcon();
    },

    updateDarkModeIcon() {
        const icon = document.getElementById('darkModeIcon');
        if (icon) icon.className = document.body.classList.contains('dark-mode') ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    App.loadDarkMode();
});
