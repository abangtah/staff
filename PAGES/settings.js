/* ============================================
   SETTINGS PAGE LOGIC
   ============================================ */

const Settings = {
    init() {
        if (!App.checkAuth()) return;
        this.renderAccountInfo();
        this.setupTabs();
        this.setupChangePassword();
        this.setupNotificationsToggle();
        this.setupDangerZone();
    },

    renderAccountInfo() {
        const user = App.getCurrentUser();
        if (!user) return;

        document.getElementById('settingsName').value = user.fullName || '';
        document.getElementById('settingsEmail').value = user.email || '';
        document.getElementById('settingsStaffId').value = user.staffId || '';
        document.getElementById('settingsPhone').value = user.phone || '';
        document.getElementById('settingsBio').value = user.bio || '';
    },

    setupTabs() {
        document.querySelectorAll('.settings-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.tab;

                document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
                document.getElementById(target).classList.add('active');
            });
        });
    },

    setupChangePassword() {
        const form = document.getElementById('changePasswordForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newSettingsPassword').value;
            const confirmPassword = document.getElementById('confirmSettingsPassword').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                App.showToast('Please fill in all password fields', 'error');
                return;
            }

            const user = App.getCurrentUser();
            if (currentPassword !== user.password) {
                App.showToast('Current password is incorrect', 'error');
                return;
            }

            if (newPassword.length < 6) {
                App.showToast('New password must be at least 6 characters', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                App.showToast('New passwords do not match', 'error');
                return;
            }

            // Update password
            const users = App.getUsers();
            const userIndex = users.findIndex(u => u.id === user.id);
            if (userIndex !== -1) {
                users[userIndex].password = newPassword;
                localStorage.setItem('users', JSON.stringify(users));

                // Update current user
                user.password = newPassword;
                App.setCurrentUser(user);

                // Send notification
                App.addNotification(
                    user.id,
                    'Your password was changed successfully.',
                    'success',
                    'settings.html'
                );

                App.showToast('Password changed successfully!');
                form.reset();
            }
        });

        // Toggle password visibility
        const toggleCurrent = document.getElementById('toggleCurrentPassword');
        if (toggleCurrent) {
            toggleCurrent.addEventListener('click', () => {
                const input = document.getElementById('currentPassword');
                input.type = input.type === 'password' ? 'text' : 'password';
                toggleCurrent.querySelector('i').className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }

        const toggleNew = document.getElementById('toggleNewSettingsPassword');
        if (toggleNew) {
            toggleNew.addEventListener('click', () => {
                const input = document.getElementById('newSettingsPassword');
                input.type = input.type === 'password' ? 'text' : 'password';
                toggleNew.querySelector('i').className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }
    },

    setupNotificationsToggle() {
        const emailToggle = document.getElementById('emailNotif');
        const evalToggle = document.getElementById('evalNotif');
        const appToggle = document.getElementById('appNotif');

        // Load saved preferences
        const prefs = JSON.parse(localStorage.getItem('notificationPrefs')) || {};
        if (emailToggle) emailToggle.checked = prefs.email !== false;
        if (evalToggle) evalToggle.checked = prefs.evaluation !== false;
        if (appToggle) appToggle.checked = prefs.application !== false;

        const saveBtn = document.getElementById('saveNotifPrefs');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const prefs = {
                    email: emailToggle ? emailToggle.checked : true,
                    evaluation: evalToggle ? evalToggle.checked : true,
                    application: appToggle ? appToggle.checked : true
                };
                localStorage.setItem('notificationPrefs', JSON.stringify(prefs));
                App.showToast('Notification preferences saved!');
            });
        }
    },

    setupDangerZone() {
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to deactivate your account? This cannot be undone.')) {
                    const users = App.getUsers();
                    const user = App.getCurrentUser();
                    const index = users.findIndex(u => u.id === user.id);
                    if (index !== -1) {
                        users[index].isActive = false;
                        localStorage.setItem('users', JSON.stringify(users));
                        App.logout();
                    }
                }
            });
        }

        const clearBtn = document.getElementById('clearDataBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (App.isVC()) {
                    if (confirm('WARNING: This will delete ALL system data. Are you sure?')) {
                        localStorage.clear();
                        App.showToast('All data cleared. Reloading...');
                        setTimeout(() => location.reload(), 1500);
                    }
                } else {
                    App.showToast('Only VC can clear all data', 'error');
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Settings.init();
});
