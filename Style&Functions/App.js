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
            const headers = { 'Authorization': `Bearer ${this.token}` };
            
            const [usersRes, deptsRes, sessionsRes, appsRes, evalsRes, reviewsRes, notifRes] = await Promise.all([
                fetch(`${this.API_URL}/users`, { headers }),
                fetch(`${this.API_URL}/departments`),
                fetch(`${this.API_URL}/sessions`, { headers }),
                fetch(`${this.API_URL}/applications`, { headers }),
                fetch(`${this.API_URL}/evaluations`, { headers }),
                fetch(`${this.API_URL}/hodReviews`, { headers }),
                fetch(`${this.API_URL}/notifications`, { headers })
            ]);

            this.state.users = await usersRes.json();
            this.state.departments = await deptsRes.json();
            this.state.sessions = await sessionsRes.json();
            this.state.applications = await appsRes.json();
            this.state.evaluations = await evalsRes.json();
            this.state.hodReviews = await reviewsRes.json();
            this.state.notifications = await notifRes.json();

            // Provide backward compatibility for scripts reading from localStorage directly
            localStorage.setItem('evaluations', JSON.stringify(this.state.evaluations));
            localStorage.setItem('hodReviews', JSON.stringify(this.state.hodReviews));
            localStorage.setItem('applications', JSON.stringify(this.state.applications));
        } catch (e) {
            console.error('Failed to fetch state', e);
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
        const res = await fetch(`${this.API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify({ id: 'SESSION-' + Date.now(), name })
        });
        const data = await res.json();
        if (res.ok) await this.fetchState();
        return { ok: res.ok, message: data.message || data.error };
    },

    async closeActiveSession() {
        if (!this.isHOD()) return false;
        await fetch(`${this.API_URL}/sessions/close-active`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        await this.fetchState();
        return true;
    },

    getNotifications() { return this.state.notifications; },

    async addNotification(userId, message, type = 'info', link = null) {
        await fetch(`${this.API_URL}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify({ id: 'NOTIF-' + Date.now(), userId, message, type, link })
        });
        await this.fetchState();
        this.updateNotificationBadge();
    },

    getUnreadCount() {
        return this.state.notifications.filter(n => !n.read).length;
    },

    async markNotificationRead(notifId) {
        await fetch(`${this.API_URL}/notifications/${notifId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const notif = this.state.notifications.find(n => n.id === notifId);
        if (notif) notif.read = 1;
        this.updateNotificationBadge();
    },

    async markAllRead() {
        await fetch(`${this.API_URL}/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.state.notifications.forEach(n => n.read = 1);
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
