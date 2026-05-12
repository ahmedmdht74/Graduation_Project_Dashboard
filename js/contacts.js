/* ═══════════════════════════════════════════════════
   FLEXORA — Messages / Contacts JS  (contacts.js)
   APIs:
     GET    /api/Contacts/GetMessages?page&pageSize&search&status
     GET    /api/Contacts/GetMessage/{id}
     GET    /api/Contacts/GetMessagesStats
     PUT    /api/Contacts/MarkAsSeen/{id}
     PUT    /api/Contacts/MarkAsResolved/{id}
     DELETE /api/Contacts/DeleteMessage/{id}
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
let actionBusy = false;
let currentMsgId = null;   // id open in modal

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  initFilters();
  loadMessageStats();
  loadMessages();
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
    searchTimer = setTimeout(() => { currentPage = 1; loadMessages(); }, 420);
  });

  document.getElementById('filterStatus')?.addEventListener('change', () => {
    currentPage = 1; loadMessages();
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStatus').value = '';
    currentPage = 1;
    loadMessages();
  });

  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadMessageStats();
    loadMessages(true);
  });
}

/* ══════════════════════════════════════
   API #1 — LOAD MESSAGES
══════════════════════════════════════ */
async function loadMessages(showToastMsg = false) {
  setTableLoading(true);

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const status = document.getElementById('filterStatus')?.value || '';

  const params = new URLSearchParams({
    page: currentPage,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(status && { status }),
  });

  try {
    const res = await fetch(`${API_BASE}/Contacts/GetMessages?${params}`, {
      headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    /* Shape: { items: [], totalCount } */

    totalCount = data.totalCount || 0;
    totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    renderMessagesTable(data.items || []);
    renderPagination();

    document.getElementById('msgCount').textContent =
      `${totalCount.toLocaleString()} message${totalCount !== 1 ? 's' : ''}`;

    if (showToastMsg) showToast('success', 'Messages refreshed');

  } catch (err) {
    console.error('[Flexora] loadMessages:', err);
    showTableError('Failed to load messages. Check your connection.');
  } finally {
    setTableLoading(false);
  }
}

/* ══════════════════════════════════════
   API #3 — STATS
══════════════════════════════════════ */
async function loadMessageStats() {
  try {
    const res = await fetch(`${API_BASE}/Contacts/GetMessagesStats`, {
      headers: authHeader()
    });
    if (!res.ok) return;
    const data = await res.json();
    /* Shape: { totalMessages, newMessages, seenMessages, resolvedMessages } */

    animateCount('sTotalMsgs', data.totalMessages || 0);
    animateCount('sNewMsgs', data.newMessages || 0);
    animateCount('sSeenMsgs', data.seenMessages || 0);
    animateCount('sResolvedMsgs', data.resolvedMessages || 0);

    /* Update sidebar + navbar new-message badges */
    const newCount = data.newMessages || 0;
    const sidebarBadge = document.getElementById('sidebarNewBadge');
    const navBadge = document.getElementById('navNewBadge');
    if (sidebarBadge) { sidebarBadge.textContent = newCount; sidebarBadge.style.display = newCount > 0 ? '' : 'none'; }
    if (navBadge) { navBadge.textContent = newCount > 99 ? '99+' : newCount; navBadge.style.display = newCount > 0 ? '' : 'none'; }

  } catch (err) {
    console.error('[Flexora] loadMessageStats:', err);
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
   RENDER TABLE
══════════════════════════════════════ */
function renderMessagesTable(items) {
  const tbody = document.getElementById('messagesTableBody');
  const empty = document.getElementById('emptyState');
  const pgWrap = document.getElementById('paginationWrap');

  if (!items.length) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    pgWrap.style.display = 'none';
    return;
  }

  empty.classList.add('d-none');
  pgWrap.style.display = 'flex';

  tbody.innerHTML = items.map(m => {
    const imgSrc = m.userImage ? `${IMAGE_BASE}/${m.userImage}` : '';
    const initials = getInitials(m.userName || '');
    const isNew = (m.status || '').toLowerCase() === 'new';

    const avatarHtml = imgSrc
      ? `<img src="${imgSrc}" class="msg-avatar" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
              alt="${escHtml(m.userName)}"/>
         <span class="msg-avatar-ph" style="display:none">${initials}</span>`
      : `<span class="msg-avatar-ph">${initials}</span>`;

    return `
    <tr class="${isNew ? 'row-new' : ''}">
      <td>
        <div class="user-cell">
          ${avatarHtml}
          <div>
            <div class="uname">${escHtml(m.userName || '—')}</div>
            ${isNew ? `<div style="font-size:.68rem;color:var(--purple-500);font-weight:600;letter-spacing:.04em">● NEW</div>` : ''}
          </div>
        </div>
      </td>
      <td>
        <div class="subject-cell ${isNew ? 'is-new' : ''}" title="${escHtml(m.subject || '')}">
          ${isNew ? '<i class="bi bi-envelope-fill me-1" style="font-size:.75rem;color:var(--purple-400)"></i>' : ''}
          ${escHtml(m.subject || '—')}
        </div>
      </td>
      <td>
        <div class="preview-cell" title="${escHtml(m.messagePreview || '')}">
          ${m.messagePreview ? escHtml(m.messagePreview) : '<span style="color:var(--text-muted)">—</span>'}
        </div>
      </td>
      <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap">${fmtDate(m.createdDate)}</td>
      <td>${statusBadge(m.status)}</td>
      <td>
        <div class="dropdown">
          <button class="btn-ghost btn-sm btn-icon dropdown-toggle"
                  data-bs-toggle="dropdown" style="border:none"
                  title="Actions">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" style="min-width:180px;border-radius:12px;padding:6px">
            <li>
              <button class="action-item" onclick="openMessageModal(${m.id})">
                <i class="bi bi-eye"></i> View Message
              </button>
            </li>
            ${m.status !== 'Seen' && m.status !== 'Resolved' ? `
            <li>
              <button class="action-item" onclick="markAsSeen(${m.id})">
                <i class="bi bi-eye-fill"></i> Mark as Seen
              </button>
            </li>` : ''}
            ${m.status !== 'Resolved' ? `
            <li>
              <button class="action-item" onclick="markAsResolved(${m.id})">
                <i class="bi bi-check-circle-fill"></i> Mark as Resolved
              </button>
            </li>` : ''}
            <li><hr class="dropdown-divider" style="margin:4px 8px"/></li>
            <li>
              <button class="action-item danger"
                      onclick="confirmDeleteMessage(${m.id}, '${escHtml(m.userName || '')}')">
                <i class="bi bi-trash3"></i> Delete
              </button>
            </li>
          </ul>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   API #2 — OPEN MESSAGE MODAL
══════════════════════════════════════ */
async function openMessageModal(id) {
  currentMsgId = id;
  const body = document.getElementById('viewMsgBody');
  const footer = document.getElementById('viewMsgFooter');

  body.innerHTML = `<div class="skeleton" style="height:220px;border-radius:12px"></div>`;
  footer.innerHTML = '';

  new bootstrap.Modal(document.getElementById('viewMsgModal')).show();

  /* Auto mark as seen when opened */
  try {
    const res = await fetch(`${API_BASE}/Contacts/GetMessage/${id}`, {
      headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const m = await res.json();
    /* Shape: { id, userId, userName, userImage, subject, message, createdDate, status } */

    const imgSrc = m.userImage ? `${IMAGE_BASE}/${m.userImage}` : '';
    const initials = getInitials(m.userName || '');

    body.innerHTML = `
      <!-- User header -->
      <div class="msg-detail-header">
        ${imgSrc
        ? `<img src="${imgSrc}" class="avatar-lg" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                  alt="${escHtml(m.userName)}"/>
             <div class="avatar-lg-ph" style="display:none">${initials}</div>`
        : `<div class="avatar-lg-ph">${initials}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.95rem;color:var(--text-primary)">${escHtml(m.userName || '—')}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">User ID: ${escHtml(m.userId || '—')}</div>
        </div>
        <div style="flex-shrink:0">${statusBadge(m.status)}</div>
      </div>

      <!-- Subject -->
      <div class="msg-subject-bar">
        <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:3px">Subject</div>
        <div style="font-weight:700;font-size:.95rem;color:var(--text-primary)">${escHtml(m.subject || '—')}</div>
      </div>

      <!-- Message body -->
      <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px">Message</div>
      <div class="msg-body-box">${escHtml(m.message || 'No message content.')}</div>

      <!-- Meta -->
      <div class="msg-meta">
        <span class="msg-meta-item"><i class="bi bi-calendar3"></i>${fmtDateLong(m.createdDate)}</span>
        <span class="msg-meta-item"><i class="bi bi-hash"></i>ID ${m.id}</span>
      </div>`;

    /* Footer action buttons */
    const btns = [];
    if (m.status !== 'Seen' && m.status !== 'Resolved') {
      btns.push(`<button class="btn-ghost btn-sm" onclick="markAsSeen(${m.id}, true)">
        <i class="bi bi-eye me-1"></i>Mark as Seen
      </button>`);
    }
    if (m.status !== 'Resolved') {
      btns.push(`<button class="btn-purple btn-sm" onclick="markAsResolved(${m.id}, true)">
        <i class="bi bi-check-circle me-1"></i>Mark as Resolved
      </button>`);
    }
    btns.push(`<button class="btn-ghost btn-sm" data-bs-dismiss="modal">Close</button>`);
    footer.innerHTML = `<div class="d-flex gap-2 ms-auto flex-wrap">${btns.join('')}</div>`;

    /* If message was New, auto-mark as seen silently */
    if (m.status === 'New') {
      silentMarkSeen(m.id);
    }

  } catch (err) {
    console.error('[Flexora] openMessageModal:', err);
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      Failed to load message
    </div>`;
  }
}

/* ══════════════════════════════════════
   API #4 — MARK AS SEEN
══════════════════════════════════════ */
async function markAsSeen(id, fromModal = false) {
  if (actionBusy) return;
  actionBusy = true;
  try {
    const res = await fetch(`${API_BASE}/Contacts/MarkAsSeen/${id}`, {
      method: 'PUT', headers: authHeader()
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('success', data.message || 'Marked as seen');
      loadMessageStats();
      loadMessages();
      if (fromModal) bootstrap.Modal.getInstance(document.getElementById('viewMsgModal'))?.hide();
    } else {
      showToast('error', data.message || 'Failed to update');
    }
  } catch (err) {
    console.error('[Flexora] markAsSeen:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
  }
}

/* Silent mark seen (no toast, no reload — called on modal open) */
async function silentMarkSeen(id) {
  try {
    await fetch(`${API_BASE}/Contacts/MarkAsSeen/${id}`, {
      method: 'PUT', headers: authHeader()
    });
    /* Refresh stats silently */
    loadMessageStats();
    /* Update the row in the table without full reload */
    updateRowStatus(id, 'Seen');
  } catch (err) { /* silent */ }
}

/* ══════════════════════════════════════
   API #5 — MARK AS RESOLVED
══════════════════════════════════════ */
async function markAsResolved(id, fromModal = false) {
  if (actionBusy) return;
  actionBusy = true;
  try {
    const res = await fetch(`${API_BASE}/Contacts/MarkAsResolved/${id}`, {
      method: 'PUT', headers: authHeader()
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('success', data.message || 'Marked as resolved');
      loadMessageStats();
      loadMessages();
      if (fromModal) bootstrap.Modal.getInstance(document.getElementById('viewMsgModal'))?.hide();
    } else {
      showToast('error', data.message || 'Failed to update');
    }
  } catch (err) {
    console.error('[Flexora] markAsResolved:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
  }
}

/* ══════════════════════════════════════
   API #6 — DELETE MESSAGE
══════════════════════════════════════ */
function confirmDeleteMessage(id, userName) {
  document.getElementById('deleteMsgUser').textContent = userName;
  const btn = document.getElementById('confirmDeleteMsgBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-trash me-1"></i> Delete';
  btn.onclick = () => deleteMessage(id);
  new bootstrap.Modal(document.getElementById('deleteMsgModal')).show();
}

async function deleteMessage(id) {
  if (actionBusy) return;
  actionBusy = true;

  bootstrap.Modal.getInstance(document.getElementById('deleteMsgModal'))?.hide();

  const btn = document.getElementById('confirmDeleteMsgBtn');

  try {
    const res = await fetch(`${API_BASE}/Contacts/DeleteMessage/${id}`, {
      method: 'DELETE',
      headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      removeMessageRow(id);
      showToast('success', data.message || 'Message deleted');
      loadMessageStats();
    } else {
      showToast('error', data.message || `Delete failed (${res.status})`);
    }

  } catch (err) {
    console.error('[Flexora] deleteMessage:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
  }
}

/* ── Remove row with animation ── */
function removeMessageRow(id) {
  /* Find the row via any button referencing this id */
  const btn = document.querySelector(`[onclick="openMessageModal(${id})"]`);
  const row = btn?.closest('tr');
  if (row) {
    row.style.transition = 'opacity .3s, transform .3s';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';
    setTimeout(() => {
      row.remove();
      totalCount = Math.max(0, totalCount - 1);
      document.getElementById('msgCount').textContent =
        `${totalCount.toLocaleString()} message${totalCount !== 1 ? 's' : ''}`;
      if (!document.querySelectorAll('#messagesTableBody tr').length) {
        if (currentPage > 1) currentPage--;
        loadMessages();
      } else {
        renderPagination();
      }
    }, 320);
  } else {
    loadMessages();
  }
}

/* ── Update row status badge in DOM without reload ── */
function updateRowStatus(id, newStatus) {
  const btn = document.querySelector(`[onclick="openMessageModal(${id})"]`);
  const row = btn?.closest('tr');
  if (!row) return;

  /* Update status badge cell (5th td) */
  const statusCell = row.querySelectorAll('td')[4];
  if (statusCell) statusCell.innerHTML = statusBadge(newStatus);

  /* Remove new highlight */
  if (newStatus !== 'New') {
    row.classList.remove('row-new');
    const newLabel = row.querySelector('[style*="NEW"]');
    if (newLabel) newLabel.remove();
    const envelope = row.querySelector('.bi-envelope-fill');
    if (envelope) envelope.remove();
    const subject = row.querySelector('.subject-cell');
    if (subject) subject.classList.remove('is-new');
  }
}

/* ══════════════════════════════════════
   PAGINATION
══════════════════════════════════════ */
function renderPagination() {
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalCount);

  document.getElementById('pageInfo').textContent =
    totalCount ? `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${totalCount.toLocaleString()}` : 'No results';

  const container = document.getElementById('paginationBtns');
  container.innerHTML = '';

  if (totalPages <= 1) {
    document.getElementById('paginationWrap').style.display = 'none';
    return;
  }
  document.getElementById('paginationWrap').style.display = 'flex';

  container.appendChild(mkBtn('<i class="bi bi-chevron-left"></i>', currentPage === 1,
    () => { currentPage--; loadMessages(); }));

  buildPageRange(currentPage, totalPages).forEach(item => {
    if (item === '…') { container.appendChild(mkBtn('…', true)); return; }
    const b = mkBtn(item, false, () => { currentPage = item; loadMessages(); });
    if (item === currentPage) b.classList.add('active');
    container.appendChild(b);
  });

  container.appendChild(mkBtn('<i class="bi bi-chevron-right"></i>', currentPage === totalPages,
    () => { currentPage++; loadMessages(); }));
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
  const tbody = document.getElementById('messagesTableBody');
  if (!loading) return;
  tbody.innerHTML = Array.from({ length: PAGE_SIZE }, () => `
    <tr>${Array.from({ length: 6 }, () =>
    `<td><div class="skeleton" style="height:14px;border-radius:5px"></div></td>`
  ).join('')}</tr>`).join('');
  document.getElementById('emptyState').classList.add('d-none');
}

function showTableError(msg) {
  document.getElementById('messagesTableBody').innerHTML = `
    <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      ${msg}
      <br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="loadMessages()">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </td></tr>`;
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'new') return `<span class="badge-msg-new">New</span>`;
  if (s === 'seen') return `<span class="badge-msg-seen">Seen</span>`;
  if (s === 'resolved') return `<span class="badge-msg-resolved">Resolved</span>`;
  return `<span class="badge-msg-seen">${escHtml(status || '—')}</span>`;
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
  return new Date(dt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
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
  setTimeout(() => {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3500);
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