/* ═══════════════════════════════════════════════════
   FLEXORA — Users Management JS  (users.js)
   APIs:
     GET  /api/Users/GetUsers
     GET  /api/Users/GetUsersStats
     GET  /api/Users/GetUserDetails/{id}
     PUT  /api/Users/UpdateUser/{id}
     PUT  /api/Users/ChangeRole/{id}
     PUT  /api/Users/ToggleUserStatus/{id}
     GET  /api/Users/GetRoles
     GET  /api/Users/GetStates
     GET  /api/Users/GetCitiesByState/{stateId}
═══════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = 'https://fitverseapp.runasp.net/api';
const IMAGE_BASE = 'https://fitverseapp.runasp.net';

function authHeader() {
  const token = localStorage.getItem('flexora_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let currentPage = 1;
const PAGE_SIZE = 10;
let totalCount = 0;
let totalPages = 1;
let searchTimer = null;
let cachedRoles = [];
let cachedStates = [];
let actionBusy = false;

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  initFilters();
  loadUsersStats();
  loadRoles();
  loadStates();
  loadUsers();
  loadNotifCount();
  loadUserInfo();
});

/* ══════════════════════════════════════
   SIDEBAR & THEME
══════════════════════════════════════ */
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  toggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
  overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 992) { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
  });
}

function initTheme() {
  const btn = document.getElementById('themeToggle');
  const html = document.documentElement;
  const saved = localStorage.getItem('flexora_theme') || 'light';
  html.setAttribute('data-theme', saved);
  if (btn) btn.innerHTML = saved === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
  btn?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('flexora_theme', next);
    if (btn) btn.innerHTML = next === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
  });
}

/* ══════════════════════════════════════
   FILTERS
══════════════════════════════════════ */
function initFilters() {
  document.getElementById('searchInput')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; loadUsers(); }, 420);
  });
  ['filterRole', 'filterActive'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { currentPage = 1; loadUsers(); });
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterRole').value = '';
    document.getElementById('filterActive').value = '';
    currentPage = 1;
    loadUsers();
  });
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadUsersStats();
    loadUsers(true);
  });
}

/* ══════════════════════════════════════
   API #1 — LOAD USERS
══════════════════════════════════════ */
async function loadUsers(showToastMsg = false) {
  setTableLoading(true);

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const role = document.getElementById('filterRole')?.value || '';
  const isActive = document.getElementById('filterActive')?.value || '';

  const params = new URLSearchParams({
    page: currentPage,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(role && { role }),
    ...(isActive !== '' && { isActive }),
  });

  try {
    const res = await fetch(`${API_BASE}/Users/GetUsers?${params}`, { headers: authHeader() });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    /* Shape: { items: [], totalCount } */

    totalCount = data.totalCount || 0;
    totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    renderTable(data.items || []);
    renderPagination();

    document.getElementById('userCount').textContent =
      `${totalCount.toLocaleString()} user${totalCount !== 1 ? 's' : ''}`;

    if (showToastMsg) showToast('success', 'Users refreshed');

  } catch (err) {
    console.error('[Flexora] loadUsers:', err);
    showTableError('Failed to load users. Check your connection.');
  } finally {
    setTableLoading(false);
  }
}

/* ══════════════════════════════════════
   API #2 — STATS
══════════════════════════════════════ */
async function loadUsersStats() {
  try {
    const res = await fetch(`${API_BASE}/Users/GetUsersStats`, { headers: authHeader() });
    if (!res.ok) return;
    const data = await res.json();

    animateCount('sTotalUsers', data.totalUsers || 0);
    animateCount('sActiveUsers', data.activeUsers || 0);
    animateCount('sNewUsersThisMonth', data.newUsersThisMonth || 0);
    animateCount('sAdmins', data.adminsCount || 0);

  } catch (err) {
    console.error('[Flexora] loadUsersStats:', err);
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton');
  let cur = 0;
  const dur = 600, step = 16;
  const inc = target / (dur / step);
  const t = setInterval(() => {
    cur += inc;
    if (cur >= target) { el.textContent = target.toLocaleString(); clearInterval(t); }
    else el.textContent = Math.round(cur).toLocaleString();
  }, step);
}

/* ══════════════════════════════════════
   API #7 — ROLES
══════════════════════════════════════ */
async function loadRoles() {
  try {
    const res = await fetch(`${API_BASE}/Users/GetRoles`, { headers: authHeader() });
    if (!res.ok) return;
    cachedRoles = await res.json(); /* ["admin","user"] */

    /* Populate filter dropdown */
    const filterSel = document.getElementById('filterRole');
    if (filterSel) {
      filterSel.innerHTML = '<option value="">All Roles</option>' +
        cachedRoles.map(r => `<option value="${escHtml(r)}">${capitalize(r)}</option>`).join('');
    }

    /* Populate change-role modal select */
    const roleSel = document.getElementById('roleSelect');
    if (roleSel) {
      roleSel.innerHTML = cachedRoles.map(r =>
        `<option value="${escHtml(r)}">${capitalize(r)}</option>`
      ).join('');
    }

  } catch (err) {
    console.error('[Flexora] loadRoles:', err);
  }
}

/* ══════════════════════════════════════
   API #8 — STATES
══════════════════════════════════════ */
async function loadStates() {
  try {
    const res = await fetch(`${API_BASE}/Users/GetStates`, { headers: authHeader() });
    if (!res.ok) return;
    cachedStates = await res.json(); /* [{id,name}] */

    const stateSel = document.getElementById('editState');
    if (stateSel) {
      stateSel.innerHTML = '<option value="">Select state…</option>' +
        cachedStates.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    }

  } catch (err) {
    console.error('[Flexora] loadStates:', err);
  }
}

/* ══════════════════════════════════════
   API #9 — CITIES BY STATE
══════════════════════════════════════ */
async function loadCitiesByState(stateId, selectedCityId = null) {
  const sel = document.getElementById('editCity');
  if (!sel) return;

  if (!stateId) {
    sel.innerHTML = '<option value="">Select city…</option>';
    return;
  }

  sel.innerHTML = '<option>Loading…</option>';
  sel.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/Users/GetCitiesByState?stateId=${stateId}`, { headers: authHeader() });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json(); /* [{id,name}] */

    sel.innerHTML = '<option value="">Select city…</option>' +
      data.map(c =>
        `<option value="${c.id}" ${Number(c.id) === Number(selectedCityId) ? 'selected' : ''}>${escHtml(c.name)}</option>`
      ).join('');

  } catch (err) {
    console.error('[Flexora] loadCitiesByState:', err);
    sel.innerHTML = '<option value="">Failed to load</option>';
  } finally {
    sel.disabled = false;
  }
}

/* ══════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════ */
function renderTable(users) {
  const tbody = document.getElementById('usersTableBody');
  const empty = document.getElementById('emptyState');
  const pgWrap = document.getElementById('paginationWrap');

  if (!users.length) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    pgWrap.style.display = 'none';
    return;
  }

  empty.classList.add('d-none');
  pgWrap.style.display = 'flex';

  tbody.innerHTML = users.map(u => {
    const imgSrc = u.image ? `${IMAGE_BASE}/${u.image}` : '';
    const initials = getInitials(u.fullName);
    const avatarHtml = imgSrc
      ? `<img src="${imgSrc}" class="user-avatar" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
              alt="${escHtml(u.fullName)}"/>
         <span class="user-avatar-placeholder" style="display:none">${initials}</span>`
      : `<span class="user-avatar-placeholder">${initials}</span>`;

    return `
    <tr>
      <td>
        <div class="user-cell">
          ${avatarHtml}
          <div class="user-cell-info">
            <div class="name">${escHtml(u.fullName || '—')}</div>
          </div>
        </div>
      </td>
      <td style="font-size:.82rem;color:var(--text-secondary)">${escHtml(u.email || '—')}</td>
      <td style="font-size:.82rem;color:var(--text-secondary)">${escHtml(u.phoneNumber || '—')}</td>
      <td>${roleBadge(u.role)}</td>
      <td style="font-size:.82rem;color:var(--text-secondary)">${escHtml(u.city || '—')}</td>
      <td>${u.isActive
        ? '<span class="badge-active">Active</span>'
        : '<span class="badge-inactive">Inactive</span>'}</td>
      <td style="font-size:.78rem;color:var(--text-muted)">${fmtDate(u.createdDate)}</td>
      <td>
        <div class="dropdown">
          <button class="btn-ghost btn-sm btn-icon dropdown-toggle" data-bs-toggle="dropdown" style="border:none">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" style="min-width:170px;border-radius:12px;padding:6px">
            <li><button class="action-item" onclick="openUserDetails('${escHtml(u.id)}')">
              <i class="bi bi-eye"></i> View Details
            </button></li>
            <li><button class="action-item" onclick="openEditModal('${escHtml(u.id)}')">
              <i class="bi bi-pencil"></i> Edit User
            </button></li>
            <li><button class="action-item" onclick="openChangeRoleModal('${escHtml(u.id)}','${escHtml(u.fullName)}','${escHtml(u.role || '')}')">
              <i class="bi bi-shield"></i> Change Role
            </button></li>
            <li><hr class="dropdown-divider" style="margin:4px 8px"/></li>
            <li><button class="action-item ${u.isActive ? 'danger' : ''}"
                        onclick="toggleUserStatus('${escHtml(u.id)}','${escHtml(u.fullName)}',${u.isActive})">
              <i class="bi bi-${u.isActive ? 'person-x' : 'person-check'}"></i>
              ${u.isActive ? 'Deactivate' : 'Activate'}
            </button></li>
          </ul>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   API #3 — USER DETAILS MODAL
══════════════════════════════════════ */
async function openUserDetails(id) {
  const body = document.getElementById('userDetailsBody');
  body.innerHTML = `<div class="skeleton" style="height:320px;border-radius:12px"></div>`;
  new bootstrap.Modal(document.getElementById('userDetailsModal')).show();

  try {
    const res = await fetch(`${API_BASE}/Users/GetUserDetails/${id}`, { headers: authHeader() });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(res.status);
    const u = await res.json();

    const imgSrc = u.image ? `${IMAGE_BASE}/${u.image}` : '';
    const initials = getInitials(`${u.firstName} ${u.lastName}`);
    const profiles = u.bodyProfile || [];

    // تصحيح منطق الصورة لتجنب ظهور الكود كـ نص
    let avatarHtml = '';
    if (imgSrc) {
      avatarHtml = `<img src="${imgSrc}" class="user-avatar-lg" loading="lazy" 
                    onerror="this.src='assets/img/placeholder.png'" alt="Avatar"/>`;
    } else {
      avatarHtml = `<div class="user-avatar-placeholder-lg">${initials}</div>`;
    }

    body.innerHTML = `
      <div class="avatar-section text-center mb-4">
        ${avatarHtml}
        <div class="name-big mt-2">${escHtml(u.firstName || '')} ${escHtml(u.lastName || '')}</div>
        <div class="mt-2">
           ${u.isActive ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}
           ${u.role ? `<span class="badge bg-primary ms-1">${u.role}</span>` : ''}
        </div>
      </div>

      <div class="row g-4">
        <div class="col-md-5 border-end">
          <h6 class="section-title-sm">CONTACT DETAILS</h6>
          <div class="detail-kv"><span class="key">Email</span><span class="val text-truncate">${escHtml(u.email || '—')}</span></div>
          <div class="detail-kv"><span class="key">Phone</span><span class="val">${escHtml(u.phoneNumber || '—')}</span></div>
          <div class="detail-kv"><span class="key">Address</span><span class="val">${escHtml(u.address || '—')}</span></div>
          <div class="detail-kv"><span class="key">City</span><span class="val">${escHtml(u.city || '—')}</span></div>
          <div class="detail-kv"><span class="key">State</span><span class="val">${escHtml(u.state || '—')}</span></div>
          <div class="detail-kv"><span class="key">Zip Code</span><span class="val">${escHtml(u.zipCode || '—')}</span></div>
          <div class="detail-kv"><span class="key">Joined</span><span class="val">${fmtDateLong(u.createdDate)}</span></div>
        </div>

        <div class="col-md-7">
          <h6 class="section-title-sm">BODY PROFILES (${profiles.length})</h6>
          <div class="profiles-container" style="max-height: 450px; overflow-y: auto; padding-right: 8px;">
            ${profiles.length > 0 ? profiles.map((bp, index) => `
              <div class="profile-card-v2 mb-3">
                <div class="profile-card-header">
                  <span>Profile #${index + 1} - ${bp.gender}</span>
                  <span class="badge-shape">${bp.bodyShape || 'Standard'}</span>
                </div>
                
                <div class="detail-kv px-3 pt-2"><span class="key">Skin Tone</span><span class="val">${escHtml(bp.skinTone || '—')}</span></div>
                
                <div class="bp-grid-mini">
                  <div class="bp-box"><strong>${bp.height || '—'}</strong><small>Height</small></div>
                  <div class="bp-box"><strong>${bp.weight || '—'}</strong><small>Weight</small></div>
                  <div class="bp-box"><strong>${bp.chest || '—'}</strong><small>Chest</small></div>
                  <div class="bp-box"><strong>${bp.waist || '—'}</strong><small>Waist</small></div>
                  <div class="bp-box"><strong>${bp.hip || '—'}</strong><small>Hip</small></div>
                  <div class="bp-box"><strong>${bp.neck || '—'}</strong><small>Neck</small></div>
                </div>

                ${bp.avatarUrl ? `
                  <div class="text-center pb-2">
                    <img src="${IMAGE_BASE}/${bp.avatarUrl}" class="ai-avatar-thumb" />
                    <div style="font-size: 0.65rem; color: var(--text-muted)">AI Avatar</div>
                  </div>
                ` : ''}
              </div>
            `).join('') : '<div class="text-muted text-center py-4">No profiles found</div>'}
          </div>
        </div>
      </div>`;

  } catch (err) {
    console.error('[Flexora] openUserDetails:', err);
    body.innerHTML = `<div class="error-state">Failed to load user details</div>`;
  }
}

/* ══════════════════════════════════════
   API #3 — OPEN EDIT MODAL
══════════════════════════════════════ */
async function openEditModal(id) {
  /* Reset form */
  ['editFirstName', 'editLastName', 'editPhone', 'editZip', 'editAddress'].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });
  document.getElementById('editIsActive').checked = false;
  document.getElementById('editEmailConfirmed').checked = false;

  const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
  modal.show();

  try {
    const res = await fetch(`${API_BASE}/Users/GetUserDetails/${id}`, { headers: authHeader() });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(res.status);
    const u = await res.json();

    document.getElementById('editUserId').value = u.id;
    document.getElementById('editFirstName').value = u.firstName || '';
    document.getElementById('editLastName').value = u.lastName || '';
    document.getElementById('editPhone').value = u.phoneNumber || '';
    document.getElementById('editZip').value = u.zipCode || '';
    document.getElementById('editAddress').value = u.address || '';
    document.getElementById('editIsActive').checked = !!u.isActive;
    document.getElementById('editEmailConfirmed').checked = !!u.emailConfirmed;

    /* State — select current, then load cities with current cityId */
    const stateSel = document.getElementById('editState');
    if (stateSel && u.stateId) {
      stateSel.value = u.stateId;
      await loadCitiesByState(u.stateId, u.cityId);
    }

  } catch (err) {
    console.error('[Flexora] openEditModal:', err);
    showToast('error', 'Failed to load user data');
    bootstrap.Modal.getInstance(document.getElementById('editUserModal'))?.hide();
  }
}

/* ══════════════════════════════════════
   API #4 — UPDATE USER
══════════════════════════════════════ */
async function updateUser() {
  if (actionBusy) return;
  actionBusy = true;

  const btn = document.getElementById('saveUserBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…'; }

  const id = document.getElementById('editUserId').value;
  console.log(id);
  const payload = {
    firstName: document.getElementById('editFirstName').value.trim(),
    lastName: document.getElementById('editLastName').value.trim(),
    phoneNumber: document.getElementById('editPhone').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    zipCode: document.getElementById('editZip').value.trim(),
    cityId: parseInt(document.getElementById('editCity').value) || null,
    isActive: document.getElementById('editIsActive').checked,
    emailConfirmed: document.getElementById('editEmailConfirmed').checked,
  };

  try {
    const res = await fetch(`${API_BASE}/Users/UpdateUser/${id}`, {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify(payload),
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));
    const ok = res.ok || data.message;

    if (ok) {
      bootstrap.Modal.getInstance(document.getElementById('editUserModal'))?.hide();
      showToast('success', data.message || 'User updated successfully');
      loadUsers();
      loadUsersStats();
    } else {
      showToast('error', data.message || `Save failed (${res.status})`);
    }

  } catch (err) {
    console.error('[Flexora] updateUser:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check2 me-1"></i>Save Changes'; }
  }
}

/* ══════════════════════════════════════
   OPEN CHANGE ROLE MODAL
══════════════════════════════════════ */
function openChangeRoleModal(id, name, currentRole) {
  document.getElementById('roleUserId').value = id;
  document.getElementById('roleUserName').textContent = name;

  const sel = document.getElementById('roleSelect');
  if (sel && currentRole) sel.value = currentRole;

  new bootstrap.Modal(document.getElementById('changeRoleModal')).show();
}

/* ══════════════════════════════════════
   API #5 — CHANGE ROLE
══════════════════════════════════════ */
async function changeRole() {
  if (actionBusy) return;
  actionBusy = true;

  const id = document.getElementById('roleUserId').value;
  const role = document.getElementById('roleSelect').value;

  if (!role) { showToast('error', 'Please select a role'); actionBusy = false; return; }

  try {
    const res = await fetch(`${API_BASE}/Users/ChangeRole/${id}`, {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({ role }),
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      bootstrap.Modal.getInstance(document.getElementById('changeRoleModal'))?.hide();
      showToast('success', data.message || 'Role updated successfully');
      loadUsers();
    } else {
      showToast('error', data.message || `Failed (${res.status})`);
    }

  } catch (err) {
    console.error('[Flexora] changeRole:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
  }
}

/* ══════════════════════════════════════
   API #6 — TOGGLE STATUS
══════════════════════════════════════ */
async function toggleUserStatus(id, name, isCurrentlyActive) {
  if (isCurrentlyActive) {
    if (!confirm(`Deactivate "${name}"? They will lose access to the platform.`)) return;
  }
  if (actionBusy) return;
  actionBusy = true;

  try {
    const res = await fetch(`${API_BASE}/Users/ToggleUserStatus/${id}`, {
      method: 'PUT',
      headers: authHeader(),
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      const action = isCurrentlyActive ? 'deactivated' : 'activated';
      showToast('success', data.message || `"${name}" ${action}`);
      loadUsers();
      loadUsersStats();
    } else {
      showToast('error', data.message || 'Failed to update status');
    }

  } catch (err) {
    console.error('[Flexora] toggleUserStatus:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
  }
}

/* ══════════════════════════════════════
   PAGINATION
══════════════════════════════════════ */
function renderPagination() {
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalCount);
  document.getElementById('pageInfo').textContent =
    totalCount ? `Showing ${start}–${end} of ${totalCount.toLocaleString()}` : 'No results';

  const container = document.getElementById('paginationBtns');
  container.innerHTML = '';

  if (totalPages <= 1) { document.getElementById('paginationWrap').style.display = 'none'; return; }
  document.getElementById('paginationWrap').style.display = 'flex';

  container.appendChild(mkBtn('<i class="bi bi-chevron-left"></i>', currentPage === 1, () => { currentPage--; loadUsers(); }));

  buildPageRange(currentPage, totalPages).forEach(item => {
    if (item === '…') { container.appendChild(mkBtn('…', true)); return; }
    const b = mkBtn(item, false, () => { currentPage = item; loadUsers(); });
    if (item === currentPage) b.classList.add('active');
    container.appendChild(b);
  });

  container.appendChild(mkBtn('<i class="bi bi-chevron-right"></i>', currentPage === totalPages, () => { currentPage++; loadUsers(); }));
}

function buildPageRange(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const p = [1];
  if (cur > 3) p.push('…');
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) p.push(i);
  if (cur < total - 2) p.push('…');
  p.push(total);
  return p;
}

function mkBtn(html, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'pg-btn';
  btn.innerHTML = html;
  btn.disabled = disabled;
  if (onClick && !disabled) btn.addEventListener('click', onClick);
  return btn;
}

/* ══════════════════════════════════════
   LOADING / ERROR STATES
══════════════════════════════════════ */
function setTableLoading(loading) {
  const tbody = document.getElementById('usersTableBody');
  if (!loading) return;
  tbody.innerHTML = Array.from({ length: PAGE_SIZE }, () => `
    <tr>${Array.from({ length: 8 }, () =>
    `<td><div class="skeleton" style="height:14px;border-radius:5px"></div></td>`
  ).join('')}</tr>`).join('');
  document.getElementById('emptyState').classList.add('d-none');
}

function showTableError(msg) {
  document.getElementById('usersTableBody').innerHTML = `
    <tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      ${msg}
      <br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="loadUsers()">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </td></tr>`;
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function roleBadge(role) {
  if (!role) return '<span style="color:var(--text-muted);font-size:.78rem">—</span>';
  const isAdmin = role.toLowerCase() === 'admin';
  return isAdmin
    ? `<span class="badge-role-admin"><i class="bi bi-shield-fill me-1"></i>${capitalize(role)}</span>`
    : `<span class="badge-role-user">${capitalize(role)}</span>`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateLong(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(type, msg) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast-item ${type}`;
  const icons = { success: 'check-circle-fill', error: 'x-circle-fill', info: 'info-circle-fill' };
  t.innerHTML = `<i class="bi bi-${icons[type] || 'info-circle-fill'}"></i><span>${msg}</span>`;
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