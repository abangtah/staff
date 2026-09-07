/* ============================================
   HOD STAFF APPLICATIONS - PREVIEW FILE CONTENT
   ============================================ */
const StaffApplications = {
    currentApp:null, allApps:[],
    init(){
        if(!App.checkAuth()) return;
        if(!App.isHOD()){window.location.href='dashboard.html';return;}
        this.allApps=this.getFilteredApplications(); this.renderApplications(this.allApps); this.setupFilters(); this.setupSearch(); this.setupModal(); this.setupCertPreviewModal();
    },
    getApplications(){return JSON.parse(localStorage.getItem('applications'))||[];},
    getFilteredApplications(){const u=App.getCurrentUser(); return this.getApplications().filter(a=>a.department===u.department);},
    renderApplications(apps){
        const users=App.getUsers(), tbody=document.getElementById('appsTableBody'), empty=document.getElementById('appsEmpty');
        if(!apps.length){tbody.innerHTML='';empty.classList.remove('hidden');return;} empty.classList.add('hidden');
        tbody.innerHTML=apps.map(app=>{const applicant=users.find(u=>u.id===app.staffId); const pending=app.status==='Pending'; return `<tr>
            <td><strong>${applicant?.fullName||'Unknown'}</strong></td><td>${app.department}</td><td>${app.sessionName||'Legacy'}</td><td>${app.type}</td><td><span class="badge badge-${app.status.toLowerCase()}">${app.status}</span></td>
            <td><div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-outline-primary view-app-btn" data-id="${app.id}"><i class="bi bi-eye"></i> Preview</button>${pending?`<button class="btn btn-sm btn-success approve-btn" data-id="${app.id}"><i class="bi bi-check-lg"></i> Approve</button><button class="btn btn-sm btn-danger reject-btn" data-id="${app.id}"><i class="bi bi-x-lg"></i> Reject</button>`:''}</div></td></tr>`;}).join('');
        tbody.querySelectorAll('.view-app-btn').forEach(b=>b.onclick=()=>this.viewApplication(b.dataset.id));
        tbody.querySelectorAll('.approve-btn').forEach(b=>b.onclick=()=>this.updateStatus(b.dataset.id,'Approved'));
        tbody.querySelectorAll('.reject-btn').forEach(b=>b.onclick=()=>this.updateStatus(b.dataset.id,'Rejected'));
    },
    setupSearch(){document.getElementById('appsSearch')?.addEventListener('input',()=>this.applyFilters());},
    setupFilters(){['statusFilter','typeFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.applyFilters()));},
    applyFilters(){const q=(document.getElementById('appsSearch')?.value||'').toLowerCase().trim(), status=document.getElementById('statusFilter')?.value||'', type=document.getElementById('typeFilter')?.value||'', users=App.getUsers(); const f=this.allApps.filter(a=>{const u=users.find(x=>x.id===a.staffId);return(!status||a.status===status)&&(!type||a.type===type)&&(!q||(u?.fullName||'').toLowerCase().includes(q)||a.department.toLowerCase().includes(q)||(a.sessionName||'').toLowerCase().includes(q));});this.renderApplications(f);},
    viewApplication(id){const app=this.getApplications().find(a=>a.id===id);if(!app)return;this.currentApp=app;const applicant=App.getUsers().find(u=>u.id===app.staffId);const certs=app.certificates||[];document.getElementById('appDetailsBody').innerHTML=`
        <div class="application-preview-grid"><div><strong>Applicant</strong><span>${applicant?.fullName||'Unknown'}</span></div><div><strong>Department</strong><span>${app.department}</span></div><div><strong>Session</strong><span>${app.sessionName||'Legacy'}</span></div><div><strong>Type</strong><span>${app.type}</span></div><div><strong>Date</strong><span>${App.formatDate(app.date)}</span></div><div><strong>Status</strong><span class="badge badge-${app.status.toLowerCase()}">${app.status}</span></div></div>
        <div class="mb-3"><strong>Details / Justification</strong><div class="app-details-box mt-2">${app.details||'No details provided.'}</div></div>
        <div><strong>Uploaded Documents (${certs.length})</strong>${certs.length?`<div class="cert-preview-list">${certs.map((c,i)=>`<button type="button" class="cert-preview-item" onclick="StaffApplications.previewCertificate(${i})"><i class="bi ${App.fileIcon(c.name)}"></i><span class="cert-preview-name">${c.name}</span><span class="cert-preview-badge"><i class="bi bi-eye"></i> View</span></button>`).join('')}</div>`:'<p class="text-gray mt-2">No documents uploaded.</p>'}</div>`;
        const footer=document.getElementById('appActionsFooter'); footer.innerHTML=app.status==='Pending'?`<button class="btn btn-danger" id="rejectAppBtn">Reject</button><button class="btn btn-success" id="approveAppBtn">Approve</button>`:`<button class="btn btn-outline-primary" onclick="document.getElementById('viewAppModal').classList.remove('active')">Close</button>`;
        document.getElementById('approveAppBtn')?.addEventListener('click',()=>this.updateStatus(app.id,'Approved')); document.getElementById('rejectAppBtn')?.addEventListener('click',()=>this.updateStatus(app.id,'Rejected')); document.getElementById('viewAppModal').classList.add('active');
    },
    async previewCertificate(i){
        const cert=this.currentApp?.certificates?.[i]; if(!cert)return; document.getElementById('certPreviewTitle').textContent=cert.name;
        const body=document.getElementById('certPreviewBody'), n=cert.name.toLowerCase();
        if(!cert.dataUrl){body.innerHTML='<div class="cert-preview-placeholder"><i class="bi bi-file-earmark-x"></i><h4>Preview unavailable</h4><p>This file was uploaded before document-content storage was enabled. Re-upload it to preview the actual certificate.</p></div>';document.getElementById('certPreviewModal').classList.add('active');return;}
        if(n.match(/\.(png|jpe?g|gif|webp)$/)){body.innerHTML=`<div class="document-viewer"><img src="${cert.dataUrl}" alt="${cert.name}" class="preview-image"></div>`;}
        else if(n.endsWith('.pdf')){body.innerHTML=`<div class="document-viewer"><iframe src="${cert.dataUrl}" title="${cert.name}" class="preview-frame"></iframe></div>`;}
        else if(n.endsWith('.docx')){
            body.innerHTML='<div class="document-viewer document-text-preview"><div class="spinner-border text-primary"></div><p>Opening certificate...</p></div>';
            try{const base64=cert.dataUrl.split(',')[1];const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const result=await mammoth.convertToHtml({arrayBuffer:bytes.buffer});body.innerHTML=`<div class="document-viewer document-text-preview">${result.value}</div>`;}catch(e){body.innerHTML='<div class="cert-preview-placeholder"><i class="bi bi-exclamation-circle"></i><h4>Could not render Word document</h4><p>The document may be corrupted or use unsupported formatting.</p></div>';}
        } else {body.innerHTML=`<div class="cert-preview-placeholder"><i class="bi bi-file-earmark-word"></i><h4>Word Document</h4><p>Modern .docx files can be previewed directly. Older .doc files require conversion to .docx.</p></div>`;}
        document.getElementById('certPreviewModal').classList.add('active');
    },
    setupCertPreviewModal(){document.getElementById('closeCertPreview')?.addEventListener('click',()=>document.getElementById('certPreviewModal').classList.remove('active'));document.getElementById('closeCertPreviewBtn')?.addEventListener('click',()=>document.getElementById('certPreviewModal').classList.remove('active'));},
    setupModal(){document.getElementById('closeViewModal')?.addEventListener('click',()=>document.getElementById('viewAppModal').classList.remove('active'));},
    async updateStatus(id,status){
        try {
            const res = await fetch(`${App.API_URL}/applications/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${App.token}` },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                const apps=this.getApplications(),i=apps.findIndex(a=>a.id===id);
                if(i>=0){
                    App.addNotification(apps[i].staffId,`Your ${apps[i].sessionName||''} application has been ${status.toLowerCase()}.`,status==='Approved'?'success':'danger','apply-for-eval.html');
                }
                document.getElementById('viewAppModal').classList.remove('active');
                document.getElementById('certPreviewModal').classList.remove('active');
                App.showToast(`Application ${status.toLowerCase()}!`);
                await App.fetchState();
                this.allApps=this.getFilteredApplications();
                this.renderApplications(this.allApps);
            }
        } catch(e) {}
    }
};
document.addEventListener('DOMContentLoaded',()=>StaffApplications.init());
