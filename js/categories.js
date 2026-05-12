/* ═══════════════════════════════════════════════════
   FLEXORA — Categories JS
   APIs:
     GET    /api/Categories/GetCategories
     POST   /api/Categories/AddCategory
     PUT    /api/Categories/UpdateCategory/{id}
     DELETE /api/Categories/DeleteCategory/{id}
═══════════════════════════════════════════════════ */
'use strict';

const API_BASE = 'https://fitverseapp.runasp.net/api';
function authHeader() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('flexora_token')}` };
}

/* ── State ── */
let allCategories = [];
let filtered = [];
let actionBusy = false;
let isEditMode = false;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    initSidebar(); initTheme(); initFilters();
    loadCategories();
    loadNotifCount();
    loadUserInfo();
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
    document.getElementById('filterGender')?.addEventListener('change', applyFilters);
    document.getElementById('clearFilters')?.addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterGender').value = '';
        applyFilters();
    });
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadCategories(true));
}

/* ══════════════════════════════════════
   API #1 — LOAD CATEGORIES
══════════════════════════════════════ */
async function loadCategories(showToast_ = false) {
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE}/Categories/GetCategories`, { headers: authHeader() });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        if (!res.ok) throw new Error(res.status);
        allCategories = await res.json();
        renderStats();
        applyFilters();
        if (showToast_) showToast('success', 'Categories refreshed');
    } catch (err) {
        console.error('[Flexora] loadCategories:', err);
        showTableError();
    } finally {
        setLoading(false);
    }
}

/* ── Stats ── */
function renderStats() {
    const total = allCategories.length;
    const men = allCategories.filter(c => c.gender === 'Male').length;
    const women = allCategories.filter(c => c.gender === 'Female').length;
    const unisex = allCategories.filter(c => c.gender === 'Unisex').length;
    animateCount('sTotal', total);
    animateCount('sMen', men);
    animateCount('sWomen', women);
    animateCount('sUnisex', unisex);
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

/* ── Filter (client-side — data already fetched) ── */
function applyFilters() {
    const search = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
    const gender = document.getElementById('filterGender')?.value || '';
    filtered = allCategories.filter(c => {
        const matchSearch = !search || c.name.toLowerCase().includes(search);
        const matchGender = !gender || c.gender === gender;
        return matchSearch && matchGender;
    });
    renderTable();
}

/* ══════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════ */
function renderTable() {
    const tbody = document.getElementById('catsTableBody');
    const empty = document.getElementById('emptyState');
    document.getElementById('catCount').textContent = `${filtered.length} categor${filtered.length !== 1 ? 'ies' : 'y'}`;

    if (!filtered.length) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');

    const genderIcon = { Men: 'bi-gender-male', Women: 'bi-gender-female', Unisex: 'bi-gender-ambiguous' };
    const genderColor = { Men: 'indigo-soft', Women: 'rose-soft', Unisex: 'gold-soft' };

    tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>
        <div class="cat-name-cell">
          <div class="cat-icon-wrap ${genderColor[c.gender] || 'purple-soft'}">
            <i class="bi ${genderIcon[c.gender] || 'bi-grid-3x3-gap'}"></i>
          </div>
          <span style="font-weight:600;font-size:.88rem">${escHtml(c.name)}</span>
        </div>
      </td>
      <td>${genderBadge(c.gender)}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:.87rem">
          <i class="bi bi-bag-heart" style="color:var(--purple-400);font-size:.8rem"></i>
          ${c.productsCount ?? 0}
        </span>
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:.87rem">
          <i class="bi bi-diagram-3" style="color:var(--teal-400);font-size:.8rem"></i>
          ${c.subCategoriesCount ?? 0}
        </span>
      </td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn-ghost btn-sm btn-icon" title="Edit" onclick="openEditModal(${c.id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button style="background:transparent;color:var(--rose-500);border:1px solid var(--rose-400);border-radius:8px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:.88rem"
                  title="Delete" onclick="confirmDelete(${c.id},'${escHtml(c.name)}')">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function genderBadge(g) {
    if (g === 'Men') return `<span class="badge-men"><i class="bi bi-gender-male"></i>Men</span>`;
    if (g === 'Women') return `<span class="badge-women"><i class="bi bi-gender-female"></i>Women</span>`;
    if (g === 'Unisex') return `<span class="badge-unisex"><i class="bi bi-gender-ambiguous"></i>Unisex</span>`;
    return `<span class="badge-unisex">${escHtml(g || '—')}</span>`;
}

/* ══════════════════════════════════════
   ADD MODAL
══════════════════════════════════════ */
function openAddModal() {
    isEditMode = false;
    document.getElementById('catId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catGender').value = '';
    document.getElementById('catModalTitle').textContent = 'Add Category';
    document.getElementById('saveCatBtn').innerHTML = '<i class="bi bi-plus-lg me-1"></i>Add';
    new bootstrap.Modal(document.getElementById('catModal')).show();
}

/* ══════════════════════════════════════
   EDIT MODAL
══════════════════════════════════════ */
function openEditModal(id) {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    isEditMode = true;
    document.getElementById('catId').value = id;
    document.getElementById('catName').value = cat.name;
    document.getElementById('catGender').value = cat.gender;
    document.getElementById('catModalTitle').textContent = 'Edit Category';
    document.getElementById('saveCatBtn').innerHTML = '<i class="bi bi-check2 me-1"></i>Save Changes';
    new bootstrap.Modal(document.getElementById('catModal')).show();
}

/* ══════════════════════════════════════
   SAVE (ADD or UPDATE)
══════════════════════════════════════ */
async function saveCategory() {
    if (actionBusy) return;
    const name = document.getElementById('catName').value.trim();
    const gender = document.getElementById('catGender').value;
    if (!name) { showToast('error', 'Category name is required'); return; }
    if (!gender) { showToast('error', 'Please select a gender'); return; }

    actionBusy = true;
    const btn = document.getElementById('saveCatBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…';

    const id = document.getElementById('catId').value;
    const url = isEditMode ? `${API_BASE}/Categories/UpdateCategory/${id}` : `${API_BASE}/Categories/AddCategory`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify({ name, gender }) });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('catModal'))?.hide();
            showToast('success', data.message || (isEditMode ? 'Category updated' : 'Category added'));
            loadCategories();
        } else {
            showToast('error', data.message || `Failed (${res.status})`);
        }
    } catch (err) {
        console.error('[Flexora] saveCategory:', err);
        showToast('error', 'Network error');
    } finally {
        actionBusy = false;
        btn.disabled = false;
        btn.innerHTML = isEditMode ? '<i class="bi bi-check2 me-1"></i>Save Changes' : '<i class="bi bi-plus-lg me-1"></i>Add';
    }
}

/* ══════════════════════════════════════
   DELETE
══════════════════════════════════════ */
function confirmDelete(id, name) {
    document.getElementById('deleteCatName').textContent = name;
    const btn = document.getElementById('confirmDeleteCatBtn');
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-trash me-1"></i>Delete';
    btn.onclick = () => deleteCategory(id);
    new bootstrap.Modal(document.getElementById('deleteCatModal')).show();
}

async function deleteCategory(id) {
    if (actionBusy) return;
    actionBusy = true;
    bootstrap.Modal.getInstance(document.getElementById('deleteCatModal'))?.hide();
    try {
        const res = await fetch(`${API_BASE}/Categories/DeleteCategory/${id}`, { method: 'DELETE', headers: authHeader() });
        if (res.status === 401) { window.location.href = 'login.html'; return; }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast('success', data.message || 'Category deleted');
            loadCategories();
        } else {
            /* Backend returns meaningful error messages — show them elegantly */
            showToast('error', data.message || `Delete failed (${res.status})`);
        }
    } catch (err) {
        console.error('[Flexora] deleteCategory:', err);
        showToast('error', 'Network error');
    } finally { actionBusy = false; }
}

/* ── Loading / Error ── */
function setLoading(on) {
    const tbody = document.getElementById('catsTableBody');
    if (!on) return;
    tbody.innerHTML = Array.from({ length: 6 }, () =>
        `<tr>${Array.from({ length: 5 }, () => `<td><div class="skeleton" style="height:14px;border-radius:5px"></div></td>`).join('')}</tr>`
    ).join('');
    document.getElementById('emptyState').classList.add('d-none');
}

function showTableError() {
    document.getElementById('catsTableBody').innerHTML = `
    <tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      Failed to load categories
      <br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="loadCategories()">
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