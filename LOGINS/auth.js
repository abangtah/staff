/* ============================================
   STAFF APPRAISAL & EVALUATION SYSTEM
   auth.js - Authentication Logic
   ============================================ */

const Auth = {
    init() {
        this.setupLogin();
        this.setupSignup();
        this.setupForgotPassword();
    },

    setupLogin() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                this.showAlert('Please enter both email and password', 'danger');
                return;
            }

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await res.json();
                if (!res.ok) {
                    this.showAlert(data.error || 'Invalid email or password', 'danger');
                    return;
                }

                App.setCurrentUser(data.user, data.token);
                this.showAlert('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'PAGES/dashboard.html';
                }, 1000);
            } catch (err) {
                this.showAlert('Network error. Please try again later.', 'danger');
            }
        });

        const toggleBtn = document.getElementById('togglePassword');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const input = document.getElementById('loginPassword');
                input.type = input.type === 'password' ? 'text' : 'password';
                toggleBtn.querySelector('i').className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }
    },

    async setupSignup() {
        const form = document.getElementById('signupForm');
        if (!form) return;

        const deptSelect = document.getElementById('signupDepartment');
        if (deptSelect) {
            try {
                const res = await fetch('/api/departments');
                if (res.ok) {
                    const depts = await res.json();
                    depts.forEach(dept => {
                        const opt = document.createElement('option');
                        opt.value = dept;
                        opt.textContent = dept;
                        deptSelect.appendChild(opt);
                    });
                }
            } catch (err) {
                console.error('Failed to load departments');
            }
        }

        const roleSelect = document.getElementById('signupRole');
        const matricGroup = document.getElementById('matricNumberGroup');
        if (roleSelect && matricGroup) {
            roleSelect.addEventListener('change', (e) => {
                if (e.target.value === 'Student') {
                    matricGroup.classList.remove('hidden');
                } else {
                    matricGroup.classList.add('hidden');
                    document.getElementById('signupStaffId').value = '';
                }
            });
            matricGroup.classList.add('hidden');
        }

        const profileInput = document.getElementById('profileImage');
        const preview = document.getElementById('profilePreview');
        if (profileInput && preview) {
            profileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        preview.src = evt.target.result;
                        preview.style.display = 'block';
                        preview.parentElement.querySelector('.profile-upload-icon').style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            let staffId = document.getElementById('signupStaffId').value.trim();
            const department = document.getElementById('signupDepartment').value;
            const role = document.getElementById('signupRole').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            const profileImageInput = document.getElementById('profileImage');

            if (!fullName || !email || !department || !role || !password) {
                this.showAlert('Please fill in all required fields', 'danger');
                return;
            }

            if (role === 'Student' && !staffId) {
                this.showAlert('Please enter your Matric Number', 'danger');
                return;
            }

            if (role === 'Lecturer') {
                staffId = 'LEC-' + Date.now().toString().slice(-6);
            }

            if (password !== confirmPassword) {
                this.showAlert('Passwords do not match', 'danger');
                return;
            }

            if (password.length < 6) {
                this.showAlert('Password must be at least 6 characters', 'danger');
                return;
            }

            if (role === 'HOD') {
                this.showAlert('HOD cannot self-register. Please register as a Lecturer. The VC will appoint HODs.', 'danger');
                return;
            }

            const newUser = {
                id: App.generateSystemId(),
                email,
                password,
                fullName,
                staffId,
                department,
                role,
                profileImage: null
            };

            const handleSave = async () => {
                try {
                    const res = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newUser)
                    });
                    const data = await res.json();
                    
                    if (!res.ok) {
                        this.showAlert(data.error || 'Signup failed', 'danger');
                        return;
                    }

                    this.showAlert('Account created successfully! Please login.', 'success');
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 1500);
                } catch (err) {
                    this.showAlert('Network error. Please try again.', 'danger');
                }
            };

            if (profileImageInput && profileImageInput.files && profileImageInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    newUser.profileImage = evt.target.result;
                    handleSave();
                };
                reader.readAsDataURL(profileImageInput.files[0]);
            } else {
                handleSave();
            }
        });

        const toggleBtn = document.getElementById('toggleSignupPassword');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const input = document.getElementById('signupPassword');
                input.type = input.type === 'password' ? 'text' : 'password';
                toggleBtn.querySelector('i').className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }
    },

    setupForgotPassword() {
        const step1 = document.getElementById('step1');
        if (!step1) return;

        emailjs.init("QX2cxwTur0MzYwAqL");

        document.getElementById('sendOtpBtn').addEventListener('click', () => this.sendOTP());
        document.getElementById('verifyOtpBtn').addEventListener('click', () => this.verifyOTP());
        document.getElementById('resetPasswordBtn').addEventListener('click', () => this.resetPassword());

        const resendLink = document.getElementById('resendOtpLink');
        if (resendLink) resendLink.addEventListener('click', (e) => { e.preventDefault(); this.sendOTP(); });

        const toggleNewBtn = document.getElementById('toggleNewPassword');
        if (toggleNewBtn) {
            toggleNewBtn.addEventListener('click', () => {
                const input = document.getElementById('newPassword');
                input.type = input.type === 'password' ? 'text' : 'password';
                toggleNewBtn.querySelector('i').className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
            });
        }
    },

    generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); },

    async sendOTP() {
        const email = document.getElementById('forgotEmail').value.trim();
        if (!email) { this.showAlert('Please enter your email address', 'danger'); return; }

        try {
            const res = await fetch('/api/users');
            const users = await res.json();
            const user = users.find(u => u.email === email);

            if (!user) { this.showAlert('Email address not found in our system', 'danger'); return; }

            const otp = this.generateOTP();
            const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            localStorage.setItem('passwordResetOTP', JSON.stringify({ email, otp, expiry }));

            const btn = document.getElementById('sendOtpBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sending...';
            btn.disabled = true;

            emailjs.send("service_367pibl", "template_9dvpyuh", {
                to_email: user.email,
                user_name: user.fullName,
                otp: otp
            }).then(() => {
                this.showAlert('OTP sent to your email! Check your inbox.', 'success');
                btn.innerHTML = originalText;
                btn.disabled = false;
                document.getElementById('step1').classList.add('hidden');
                document.getElementById('step2').classList.remove('hidden');
                document.getElementById('otpEmailDisplay').textContent = email;
            }).catch((error) => {
                console.error('Email failed:', error);
                this.showAlert('Failed to send OTP. Please try again.', 'danger');
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        } catch (err) {
            this.showAlert('Network error', 'danger');
        }
    },

    verifyOTP() {
        const enteredOTP = document.getElementById('otpInput').value.trim();
        if (!enteredOTP || enteredOTP.length !== 6) { this.showAlert('Please enter the 6-digit OTP', 'danger'); return; }

        const otpData = JSON.parse(localStorage.getItem('passwordResetOTP'));
        if (!otpData) { this.showAlert('OTP expired or invalid.', 'danger'); return; }
        if (new Date() > new Date(otpData.expiry)) {
            localStorage.removeItem('passwordResetOTP');
            this.showAlert('OTP has expired.', 'danger'); return;
        }
        if (enteredOTP !== otpData.otp) { this.showAlert('Invalid OTP.', 'danger'); return; }

        this.showAlert('OTP verified successfully!', 'success');
        document.getElementById('step2').classList.add('hidden');
        document.getElementById('step3').classList.remove('hidden');
    },

    async resetPassword() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        const otpData = JSON.parse(localStorage.getItem('passwordResetOTP'));

        if (!otpData) { this.showAlert('Session expired. Please start again.', 'danger'); return; }
        if (!newPassword || !confirmPassword) { this.showAlert('Please fill in both password fields', 'danger'); return; }
        if (newPassword.length < 6) { this.showAlert('Password must be at least 6 characters', 'danger'); return; }
        if (newPassword !== confirmPassword) { this.showAlert('Passwords do not match', 'danger'); return; }

        try {
            this.showAlert('Password reset updating logic requires backend implementation.', 'danger');
        } catch (err) {
            this.showAlert('Network error', 'danger');
        }
    },

    showAlert(message, type) {
        let alertBox = document.getElementById('authAlert');
        if (!alertBox) {
            alertBox = document.createElement('div');
            alertBox.id = 'authAlert';
            const form = document.querySelector('.auth-form:not(.hidden)') || document.querySelector('form');
            if (form) form.parentNode.insertBefore(alertBox, form);
        }

        alertBox.className = `alert alert-${type}`;
        alertBox.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i> ${message}`;
        alertBox.style.display = 'flex';

        setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
    }
};

document.addEventListener('DOMContentLoaded', () => { Auth.init(); });
