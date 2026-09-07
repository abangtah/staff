/* ============================================
   PROFILE PAGE LOGIC
   ============================================ */

const Profile = {
    tempCerts: [],
    tempProfileImage: null,

    init() {
        if (!App.checkAuth()) return;
        this.renderProfile();
        this.setupEditModal();
    },

    renderProfile() {
        const user = App.getCurrentUser();
        if (!user) return;

        document.getElementById('profileName').textContent = user.fullName || 'Unknown';
        document.getElementById('profileRole').textContent = user.role || 'Staff';
        document.getElementById('profileSystemId').textContent = user.id || 'N/A';
        document.getElementById('profileStaffId').textContent = user.staffId || 'N/A';
        document.getElementById('profileEmail').textContent = user.email || 'N/A';
        document.getElementById('profileDepartment').textContent = user.department || 'N/A';
        document.getElementById('profileRoleBadge').innerHTML = `<span class="badge badge-${user.role.toLowerCase()}">${user.role}</span>`;
        document.getElementById('profilePhone').textContent = user.phone || 'Not set';
        document.getElementById('profileJoined').textContent = App.formatDate(user.createdAt);
        document.getElementById('profileBio').textContent = user.bio || 'No bio added yet.';

        // Avatar - use profile image if available
        const avatarEl = document.getElementById('profileAvatar');
        if (user.profileImage) {
            avatarEl.innerHTML = `<img src="${user.profileImage}" class="profile-avatar-img" alt="${user.fullName}">`;
        } else {
            avatarEl.innerHTML = '<i class="bi bi-person-fill"></i>';
        }

        // Certificates
        const certs = user.certificates || [];
        const certContainer = document.getElementById('profileCerts');
        if (certs.length > 0) {
            certContainer.innerHTML = certs.map((cert, i) => `
                <div class="cert-item">
                    <i class="bi bi-file-earmark-text"></i>
                    <span class="cert-item-name">${cert.name}</span>
                    <span class="text-gray" style="font-size: 12px;">${App.formatDate(cert.date)}</span>
                </div>
            `).join('');
        }
    },

    setupEditModal() {
        const modal = document.getElementById('editProfileModal');
        const user = App.getCurrentUser();

        document.getElementById('editProfileBtn').addEventListener('click', () => {
            document.getElementById('editName').value = user.fullName || '';
            document.getElementById('editStaffId').value = user.staffId || '';
            document.getElementById('editPhone').value = user.phone || '';
            document.getElementById('editBio').value = user.bio || '';
            this.tempCerts = [...(user.certificates || [])];
            this.tempProfileImage = user.profileImage || null;
            this.renderCertList();
            this.renderEditProfilePreview();
            modal.classList.add('active');
        });

        document.getElementById('closeEditModal').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        document.getElementById('saveProfile').addEventListener('click', () => {
            this.saveProfile();
        });

        // Profile image change
        const profileInput = document.getElementById('editProfileImage');
        if (profileInput) {
            profileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        this.tempProfileImage = evt.target.result;
                        this.renderEditProfilePreview();
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Certificate upload
        const uploadArea = document.getElementById('certUploadArea');
        const certInput = document.getElementById('certInput');

        uploadArea.addEventListener('click', () => certInput.click());

        certInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => {
                this.tempCerts.push({
                    name: file.name,
                    date: new Date().toISOString(),
                    size: file.size
                });
            });
            this.renderCertList();
        });
    },

    renderEditProfilePreview() {
        const preview = document.getElementById('editProfilePreview');
        const icon = document.querySelector('#editProfileModal .profile-upload-icon');

        if (this.tempProfileImage) {
            preview.src = this.tempProfileImage;
            preview.classList.remove('hidden');
            if (icon) icon.style.display = 'none';
        } else {
            preview.classList.add('hidden');
            if (icon) icon.style.display = 'block';
        }
    },

    renderCertList() {
        const container = document.getElementById('certList');
        if (this.tempCerts.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = this.tempCerts.map((cert, i) => `
            <div class="cert-item">
                <i class="bi bi-file-earmark-text"></i>
                <span class="cert-item-name">${cert.name}</span>
                <button class="cert-item-remove" onclick="Profile.removeCert(${i})">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        `).join('');
    },

    removeCert(index) {
        this.tempCerts.splice(index, 1);
        this.renderCertList();
    },

    saveProfile() {
        const users = App.getUsers();
        const currentUser = App.getCurrentUser();
        const userIndex = users.findIndex(u => u.id === currentUser.id);

        if (userIndex === -1) return;

        // Check staff ID uniqueness if changed
        const newStaffId = document.getElementById('editStaffId').value.trim();
        if (newStaffId !== currentUser.staffId) {
            const existing = users.find(u => u.staffId === newStaffId && u.id !== currentUser.id);
            if (existing) {
                App.showToast('Staff ID already exists', 'error');
                return;
            }
        }

        users[userIndex].fullName = document.getElementById('editName').value.trim();
        users[userIndex].staffId = newStaffId;
        users[userIndex].phone = document.getElementById('editPhone').value.trim();
        users[userIndex].bio = document.getElementById('editBio').value.trim();
        users[userIndex].certificates = this.tempCerts;

        // Save profile image if changed
        if (this.tempProfileImage !== undefined) {
            users[userIndex].profileImage = this.tempProfileImage;
        }

        localStorage.setItem('users', JSON.stringify(users));
        App.setCurrentUser(users[userIndex]);

        document.getElementById('editProfileModal').classList.remove('active');
        this.renderProfile();

        // Refresh topbar avatar
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Profile.init();
});
