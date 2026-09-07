/* ============================================
   DEPARTMENTS PAGE LOGIC (VC ONLY)
   ============================================ */

const Departments = {
    currentDept: null,
    appointMode: false, // true = appoint new HOD, false = handover existing

    init() {
        if (!App.checkAuth()) return;

        if (!App.isVC()) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.renderDepartments();
        this.setupModals();
    },

    renderDepartments() {
        const depts = App.getDepartments();
        const users = App.getUsers();
        const container = document.getElementById('departmentsGrid');

        if (depts.length === 0) {
            container.innerHTML = '';
            document.getElementById('deptEmpty').classList.remove('hidden');
            return;
        }

        document.getElementById('deptEmpty').classList.add('hidden');

        container.innerHTML = depts.map(dept => {
            const staff = users.filter(u => u.department === dept && u.role === 'Lecturer' && u.isActive !== false);
            const hod = users.find(u => u.department === dept && u.role === 'HOD' && u.isActive !== false);

            const actionBtn = hod 
                ? `<button class="btn btn-sm btn-outline-primary" onclick="Departments.openHandoverModal('${dept}')" title="Handover HOD"><i class="bi bi-arrow-left-right"></i></button>`
                : `<button class="btn btn-sm btn-success" onclick="Departments.openAppointModal('${dept}')" title="Appoint HOD"><i class="bi bi-person-plus"></i> Appoint HOD</button>`;

            return `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="dept-card">
                        <div class="dept-header">
                            <span class="dept-name">${dept}</span>
                            ${actionBtn}
                        </div>
                        <p class="text-gray mb-2" style="font-size: 14px;">
                            <i class="bi bi-person-badge"></i> HOD: ${hod ? hod.fullName : '<span style="color:var(--danger)">Not Assigned</span>'}
                        </p>
                        <div class="dept-stats">
                            <div class="dept-stat">
                                <h4>${staff.length}</h4>
                                <p>Lecturers</p>
                            </div>
                            <div class="dept-stat">
                                <h4>${hod ? '1' : '0'}</h4>
                                <p>HOD</p>
                            </div>
                            <div class="dept-stat">
                                <h4>${staff.length + (hod ? 1 : 0)}</h4>
                                <p>Total</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    setupModals() {
        // Add Department
        document.getElementById('addDeptBtn').addEventListener('click', () => {
            document.getElementById('deptModalTitle').textContent = 'Add Department';
            document.getElementById('deptName').value = '';
            this.currentDept = null;
            document.getElementById('deptModal').classList.add('active');
        });

        document.getElementById('closeDeptModal').addEventListener('click', () => {
            document.getElementById('deptModal').classList.remove('active');
        });

        document.getElementById('cancelDept').addEventListener('click', () => {
            document.getElementById('deptModal').classList.remove('active');
        });

        document.getElementById('saveDept').addEventListener('click', () => {
            this.saveDepartment();
        });

        // Appoint/Handover Modal
        document.getElementById('closeHandoverModal').addEventListener('click', () => {
            document.getElementById('handoverModal').classList.remove('active');
        });

        document.getElementById('cancelHandover').addEventListener('click', () => {
            document.getElementById('handoverModal').classList.remove('active');
        });

        document.getElementById('confirmHandover').addEventListener('click', () => {
            this.confirmAction();
        });
    },

    saveDepartment() {
        const name = document.getElementById('deptName').value.trim();
        if (!name) {
            App.showToast('Please enter a department name', 'error');
            return;
        }

        const depts = App.getDepartments();
        if (depts.includes(name)) {
            App.showToast('Department already exists', 'error');
            return;
        }

        depts.push(name);
        localStorage.setItem('departments', JSON.stringify(depts));

        document.getElementById('deptModal').classList.remove('active');
        App.showToast('Department added successfully!');
        this.renderDepartments();
    },

    deleteDepartment(dept) {
        if (!confirm('Delete this department? Staff will need to be reassigned.')) return;

        const depts = App.getDepartments().filter(d => d !== dept);
        localStorage.setItem('departments', JSON.stringify(depts));

        App.showToast('Department deleted');
        this.renderDepartments();
    },

    // Open Appoint Modal (when department has NO HOD)
    openAppointModal(dept) {
        this.currentDept = dept;
        this.appointMode = true;
        document.getElementById('handoverModalTitle').textContent = 'Appoint HOD';
        document.getElementById('handoverDeptName').textContent = dept;
        document.getElementById('handoverCodeArea').classList.add('hidden');
        document.getElementById('confirmHandover').innerHTML = '<i class="bi bi-person-plus"></i> Appoint HOD';

        const users = App.getUsers();
        const lecturers = users.filter(u => u.department === dept && u.role === 'Lecturer' && u.isActive !== false);

        const select = document.getElementById('newHODSelect');
        select.innerHTML = '<option value="">Select Lecturer</option>';

        if (lecturers.length === 0) {
            select.innerHTML = '<option value="">No lecturers in this department</option>';
            select.disabled = true;
        } else {
            select.disabled = false;
            lecturers.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = l.fullName + ' (' + l.staffId + ')';
                select.appendChild(opt);
            });
        }

        document.getElementById('handoverModal').classList.add('active');
    },

    // Open Handover Modal (when department HAS an HOD)
    openHandoverModal(dept) {
        this.currentDept = dept;
        this.appointMode = false;
        document.getElementById('handoverModalTitle').textContent = 'HOD Handover';
        document.getElementById('handoverDeptName').textContent = dept;
        document.getElementById('handoverCodeArea').classList.add('hidden');
        document.getElementById('confirmHandover').innerHTML = '<i class="bi bi-arrow-left-right"></i> Confirm Handover';

        const users = App.getUsers();
        const lecturers = users.filter(u => u.department === dept && u.role === 'Lecturer' && u.isActive !== false);

        const select = document.getElementById('newHODSelect');
        select.innerHTML = '<option value="">Select Lecturer</option>';
        select.disabled = false;

        lecturers.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.fullName + ' (' + l.staffId + ')';
            select.appendChild(opt);
        });

        document.getElementById('handoverModal').classList.add('active');
    },

    confirmAction() {
        const newHODId = document.getElementById('newHODSelect').value;
        if (!newHODId) {
            App.showToast('Please select a lecturer', 'error');
            return;
        }

        if (this.appointMode) {
            // Appoint new HOD (no existing HOD to demote)
            this.appointHOD(newHODId);
        } else {
            // Handover (demote existing HOD, promote new)
            this.handoverHOD(newHODId);
        }
    },

    appointHOD(newHODId) {
        const users = App.getUsers();
        const newHOD = users.find(u => u.id === newHODId);

        if (!newHOD) {
            App.showToast('Selected lecturer not found', 'error');
            return;
        }

        newHOD.role = 'HOD';
        newHOD.handoverCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        newHOD.loginAttempts = 0;

        localStorage.setItem('users', JSON.stringify(users));

        document.getElementById('handoverCode').textContent = newHOD.handoverCode;
        document.getElementById('handoverCodeArea').classList.remove('hidden');

        App.showToast('HOD appointed successfully! Share the code with ' + newHOD.fullName);
        this.renderDepartments();
    },

    handoverHOD(newHODId) {
        const users = App.getUsers();

        // Demote current HOD to Lecturer
        const currentHOD = users.find(u => u.department === this.currentDept && u.role === 'HOD' && u.isActive !== false);
        if (currentHOD) {
            currentHOD.role = 'Lecturer';
            currentHOD.isActive = true;
        }

        // Promote new HOD
        const newHOD = users.find(u => u.id === newHODId);
        if (newHOD) {
            newHOD.role = 'HOD';
            newHOD.handoverCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            newHOD.loginAttempts = 0;
        }

        localStorage.setItem('users', JSON.stringify(users));

        document.getElementById('handoverCode').textContent = newHOD.handoverCode;
        document.getElementById('handoverCodeArea').classList.remove('hidden');

        App.showToast('HOD handover completed!');
        this.renderDepartments();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Departments.init();
});
