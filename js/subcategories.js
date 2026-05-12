/* ═══════════════════════════════════════════════════
   FLEXORA — SubCategories JS
   APIs:
     GET    /api/SubCategories/GetSubCategories
     POST   /api/SubCategories/AddSubCategory
     PUT    /api/SubCategories/UpdateSubCategory/{id}
     DELETE /api/SubCategories/DeleteSubCategory/{id}
     GET    /api/Categories/GetCategories  (for select)
═══════════════════════════════════════════════════ */
'use strict';

const API_BASE = 'https://fitverseapp.runasp.net/api';
function authHeader() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('flexora_token')}` };
}

/* ── State ── */
let allSubs = [];
let allCategories = [];
let filtered = [];
let actionBusy = false;
let isEditMode = false;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    initSidebar(); initTheme(); initFilters();
    Promise.all([loadCategories(), loadSubCategories(), loadNotifCount(), loadUserInfo()]);
});

function initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    toggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
    overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 992) { sidebar.classList.remove('open'); overlay.classList.remove('show'); } });
}

function initTheme() {
    const btn = document.getElementById('themeToggle');
    const html = document.documentElement;
    const saved = localStorage.getItem('flexora_theme') || 'light';
    html.setAttribute('data-theme', saved);
    if (btn) btn.innerHTML = saved === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
    btn?.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next); localStorage.setItem('flexora_theme', next);
        if (btn) btn.innerHTML = next === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
    });
}

function initFilters() {
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('filterCat')?.addEventListener('change', applyFilters);
    document.getElementById('clearFilters')?.addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterCat').value = '';
        applyFilters();
    });
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        Promise.all([loadCategories(), loadSubCategories(true)]);
    });
}

/* ══════════════════════════════════════
   LOAD CATEGORIES (for selects & filter)
══════════════════════════════════════ */
async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE}/Categories/GetCategories`, { headers: authHeader() });
        if (!res.ok) return;
        allCategories = await res.json();

        /* Populate filter dropdown */
        const filterSel = document.getElementById('filterCat');
        if (filterSel) {
            filterSel.innerHTML = '<option value="">All Categories</option>' +
                allCategories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
        }
        /* Populate modal select */
        populateCatSelect();
    } catch (err) { console.error('[Flexora] loadCategories:', err); }
}

function populateCatSelect(selectedId = null) {
    const sel = document.getElementById('subCatId');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select category…</option>' +
        allCategories.map(c =>
            `<option value="${c.id}" ${Number(c.id) === Number(selectedId) ? 'selected' : ''}>${escHtml(c.name)}</option>`
        ).join('');
}

/* ══════════════════════════════════════
   LOAD SUBCATEGORIES
══════════════════════════════════════ */
async function loadSubCategories(showToast_ = false) {
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/SubCategories/GetSubCategories`, { headers: authHeader() });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        if (!res.ok) throw new Error(res.status);
        allSubs = await res.json();
        renderStats();
        applyFilters();
        if (showToast_) showToast('success', 'SubCategories refreshed');
    } catch (err) {
        console.error('[Flexora] loadSubCategories:', err);
        showTableError();
    } finally { setLoading(false); }
}

/* ── Stats ── */
function renderStats() {
    const total = allSubs.length;
    const totProds = allSubs.reduce((s, sc) => s + (sc.productsCount || 0), 0);
    const avg = total ? (totProds / total).toFixed(1) : '0';

    /* Most used category (by subcategory count) */
    const catCount = {};
    allSubs.forEach(sc => { catCount[sc.categoryName] = (catCount[sc.categoryName] || 0) + 1; });
    const mostUsed = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    animateCount('sTotal', total);
    animateCount('sTotalProducts', totProds);
    const avgEl = document.getElementById('sAvgProducts');
    if (avgEl) { avgEl.classList.remove('skeleton'); avgEl.textContent = avg; }
    const muEl = document.getElementById('sMostUsed');
    if (muEl) { muEl.classList.remove('skeleton'); muEl.textContent = mostUsed; }
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('skeleton');
    let cur = 0; const dur = 500, step = 16, inc = target / (dur / step);
    const t = setInterval(() => {
        cur += inc;
        if (cur >= target) { el.textContent = target.toLocaleString(); clearInterval(t); }
        else el.textContent = Math.round(cur).toLocaleString();
    }, step);
}

/* ── Filter (client-side) ── */
function applyFilters() {
    const search = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
    const catId = document.getElementById('filterCat')?.value || '';
    filtered = allSubs.filter(sc => {
        const matchSearch = !search || sc.name.toLowerCase().includes(search) || (sc.categoryName || '').toLowerCase().includes(search);
        const matchCat = !catId || String(sc.categoryId) === catId;
        return matchSearch && matchCat;
    });
    renderTable();
}

/* ══════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════ */
function renderTable() {
    const tbody = document.getElementById('subsTableBody');
    const empty = document.getElementById('emptyState');
    document.getElementById('subCount').textContent =
        `${filtered.length} subcategor${filtered.length !== 1 ? 'ies' : 'y'}`;

    if (!filtered.length) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');

    tbody.innerHTML = filtered.map(sc => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="subcat-icon-wrap"><i class="bi bi-tag-fill"></i></div>
          <span style="font-weight:600;font-size:.88rem">${escHtml(sc.name)}</span>
        </div>
      </td>
      <td>
        <span class="cat-parent-pill">
          <i class="bi bi-grid-3x3-gap" style="font-size:.75rem"></i>
          ${escHtml(sc.categoryName || '—')}
        </span>
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:.87rem">
          <i class="bi bi-bag-heart" style="color:var(--purple-400);font-size:.8rem"></i>
          ${sc.productsCount ?? 0}
        </span>
      </td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn-ghost btn-sm btn-icon" title="Edit" onclick="openEditSubModal(${sc.id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button style="background:transparent;color:var(--rose-500);border:1px solid var(--rose-400);border-radius:8px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:.88rem"
                  title="Delete" onclick="confirmDeleteSub(${sc.id},'${escHtml(sc.name)}')">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

/* ══════════════════════════════════════
   ADD MODAL
══════════════════════════════════════ */
function openAddSubModal() {
    isEditMode = false;
    document.getElementById('subId').value = '';
    document.getElementById('subName').value = '';
    populateCatSelect();
    document.getElementById('subModalTitle').textContent = 'Add SubCategory';
    document.getElementById('saveSubBtn').innerHTML = '<i class="bi bi-plus-lg me-1"></i>Add';
    new bootstrap.Modal(document.getElementById('subModal')).show();
}

/* ══════════════════════════════════════
   EDIT MODAL
══════════════════════════════════════ */
function openEditSubModal(id) {
    const sc = allSubs.find(s => s.id === id);
    if (!sc) return;
    isEditMode = true;
    document.getElementById('subId').value = id;
    document.getElementById('subName').value = sc.name;
    populateCatSelect(sc.categoryId);
    document.getElementById('subModalTitle').textContent = 'Edit SubCategory';
    document.getElementById('saveSubBtn').innerHTML = '<i class="bi bi-check2 me-1"></i>Save Changes';
    new bootstrap.Modal(document.getElementById('subModal')).show();
}

/* ══════════════════════════════════════
   SAVE (ADD or UPDATE)
══════════════════════════════════════ */
async function saveSubCategory() {
    if (actionBusy) return;
    const name = document.getElementById('subName').value.trim();
    const catId = document.getElementById('subCatId').value;
    if (!name) { showToast('error', 'SubCategory name is required'); return; }
    if (!catId) { showToast('error', 'Please select a parent category'); return; }

    actionBusy = true;
    const btn = document.getElementById('saveSubBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…';

    const id = document.getElementById('subId').value;
    const url = isEditMode ? `${API_BASE}/SubCategories/UpdateSubCategory/${id}` : `${API_BASE}/SubCategories/AddSubCategory`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify({ name, categoryId: parseInt(catId) }) });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('subModal'))?.hide();
            showToast('success', data.message || (isEditMode ? 'SubCategory updated' : 'SubCategory added'));
            loadSubCategories();
        } else {
            showToast('error', data.message || `Failed (${res.status})`);
        }
    } catch (err) {
        console.error('[Flexora] saveSubCategory:', err);
        showToast('error', 'Network error');
    } finally {
        actionBusy = false; btn.disabled = false;
        btn.innerHTML = isEditMode ? '<i class="bi bi-check2 me-1"></i>Save Changes' : '<i class="bi bi-plus-lg me-1"></i>Add';
    }
}

/* ══════════════════════════════════════
   DELETE
══════════════════════════════════════ */
function confirmDeleteSub(id, name) {
    document.getElementById('deleteSubName').textContent = name;
    const btn = document.getElementById('confirmDeleteSubBtn');
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-trash me-1"></i>Delete';
    btn.onclick = () => deleteSubCategory(id);
    new bootstrap.Modal(document.getElementById('deleteSubModal')).show();
}

async function deleteSubCategory(id) {
    if (actionBusy) return;
    actionBusy = true;
    bootstrap.Modal.getInstance(document.getElementById('deleteSubModal'))?.hide();
    try {
        const res = await fetch(`${API_BASE}/SubCategories/DeleteSubCategory/${id}`, { method: 'DELETE', headers: authHeader() });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast('success', data.message || 'SubCategory deleted');
            loadSubCategories();
        } else {
            showToast('error', data.message || `Delete failed (${res.status})`);
        }
    } catch (err) {
        console.error('[Flexora] deleteSubCategory:', err);
        showToast('error', 'Network error');
    } finally { actionBusy = false; }
}

/* ── Loading / Error ── */
function setLoading(on) {
    const tbody = document.getElementById('subsTableBody');
    if (!on) return;
    tbody.innerHTML = Array.from({ length: 6 }, () =>
        `<tr>${Array.from({ length: 4 }, () => `<td><div class="skeleton" style="height:14px;border-radius:5px"></div></td>`).join('')}</tr>`
    ).join('');
    document.getElementById('emptyState').classList.add('d-none');
}

function showTableError() {
    document.getElementById('subsTableBody').innerHTML = `
    <tr><td colspan="4" style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      Failed to load subcategories
      <br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="loadSubCategories()">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry</button>
    </td></tr>`;
}

function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(type, msg) {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast-item ${type}`;
    t.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'x-circle-fill'}"></i><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}





/* ──────────────────────────────────────────────────
   FETCH WRAPPER FOR FULL-URL ENDPOINTS
────────────────────────────────────────────────── */
async function apiFetchExternal(url) {
    try {
        const res = await fetch(url, { headers: authHeader() });
        if (res.status === 401) { console.warn('[Flexora] 401 on', url); return null; }
        if (!res.ok) { console.error(`[Flexora] HTTP ${res.status} on`, url); return null; }
        const json = await res.json();
        if (!json.success) { console.warn('[Flexora] success=false on', url); return null; }
        return json.data;
    } catch (err) {
        console.error('[Flexora] Network error on', url, err);
        return null;
    }
}

/* ──────────────────────────────────────────────────
   NOTIFICATIONS COUNT  —  /notifications-count
────────────────────────────────────────────────── */
async function loadNotifCount() {
    const d = await apiFetchExternal('https://fitverseapp.runasp.net/api/Dashboard/notifications-count');
    console.log('[Flexora] Notifications count:', d);
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    const count = d?.count ?? 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count === 0 ? 'none' : '';
}


async function loadUserInfo() {
    const d = await apiFetchExternal('https://fitverseapp.runasp.net/UserInfo');

    const firstName = d?.firstName || 'Admin';
    const lastName = d?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const email = d?.email || '';
    const avatar = d?.imageUrl ? `https://fitverseapp.runasp.net/${d.imageUrl}`
        : `https://img.magnific.com/free-vector/blue-circle-with-white-user_78370-4707.jpg?semt=ais_hybrid&w=740&q=80`;

    // Page greeting
    const greetEl = document.getElementById('pageGreeting');
    if (greetEl) greetEl.textContent = `${getGreeting()}, ${firstName} \u2726`;

    // Sidebar
    const sbAvatar = document.getElementById('sidebarUserAvatar');
    const sbName = document.getElementById('sidebarUserName');
    const sbEmail = document.getElementById('sidebarUserEmail');
    if (sbAvatar) sbAvatar.src = avatar;
    if (sbName) sbName.textContent = fullName;
    if (sbEmail) sbEmail.textContent = email;

    // Navbar
    const nbAvatar = document.getElementById('navbarUserAvatar');
    const nbName = document.getElementById('navbarUserName');
    if (nbAvatar) nbAvatar.src = avatar;
    if (nbName) nbName.textContent = fullName;

    // Dropdown header
    const ddName = document.getElementById('dropdownUserName');
    const ddEmail = document.getElementById('dropdownUserEmail');
    if (ddName) ddName.textContent = fullName;
    if (ddEmail) ddEmail.textContent = email;
}