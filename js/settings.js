/* ============================================================
   FLEXORA — Settings
   settings.js
   ============================================================ */
localStorage.setItem("flexora_token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiYWhtZWRtZGh0NzRAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvbmFtZWlkZW50aWZpZXIiOiIyNGRiOWI5Ny0wODZkLTQ2OTAtYTNhZS0xYTQzYmE3NTFiZTciLCJqdGkiOiIzMjI0MDQ2Ni1lNjViLTRiMDktOTAwMy04ZGI5NWUyM2Y4YjUiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJhZG1pbiIsImV4cCI6MTc3OTEyNjg2NiwiaXNzIjoiaHR0cHM6Ly9maXR2ZXJzZWFwcC5ydW5hc3AubmV0LyIsImF1ZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3My8ifQ.fofr2rFOvK3HoSV6Sljn25kl2ijcWx6Z6np3CnEkPe8");
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiYWhtZWRtZGh0NzRAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvbmFtZWlkZW50aWZpZXIiOiIyNGRiOWI5Ny0wODZkLTQ2OTAtYTNhZS0xYTQzYmE3NTFiZTciLCJqdGkiOiIzMjI0MDQ2Ni1lNjViLTRiMDktOTAwMy04ZGI5NWUyM2Y4YjUiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJhZG1pbiIsImV4cCI6MTc3OTEyNjg2NiwiaXNzIjoiaHR0cHM6Ly9maXR2ZXJzZWFwcC5ydW5hc3AubmV0LyIsImF1ZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3My8ifQ.fofr2rFOvK3HoSV6Sljn25kl2ijcWx6Z6np3CnEkPe8
const API_BASE = 'https://fitverseapp.runasp.net/api';

function authHeader() {
  const token = localStorage.getItem('flexora_token');
  console.log('Auth token:', token);
  return { 'Authorization': `Bearer ${token}` };
}

function jsonHeader() {
  const token = localStorage.getItem('flexora_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/* ── state ── */
let profileData = null;
let selectedFile = null;
let pendingCityId = null; // city to restore after cities load

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadProfile();
  initTheme();
  loadNotifCount();
  loadUserInfo();
  document.getElementById('imageFileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) previewProfileImage(e.target.files[0]);
  });

  document.getElementById('stateSelect').addEventListener('change', (e) => {
    const stateId = e.target.value;
    const citySelect = document.getElementById('citySelect');
    citySelect.innerHTML = '<option value="">— Select City —</option>';
    citySelect.disabled = true;
    if (stateId) loadCitiesByState(stateId, null);
  });
});

/* ── Tabs ── */
function initTabs() {
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

/* ============================================================
   LOAD PROFILE
   ============================================================ */
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/AdminSettings/GetProfile`, { headers: authHeader() });
    const data = await res.json();
    profileData = data;
    console.log('Profile data:', data);
    renderProfileCard(data);
    populateProfileForm(data);
    updateTopbar(data);

    // Now load states — loadStates() reads profileData to auto-select state + city
    await loadStates();

  } catch (err) {
    console.error('Load profile error:', err);
    showToast('Failed to load profile.', 'error');
  }
}

/* ── render left profile card ── */
function renderProfileCard(d) {
  const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim();
  const location = [d.cityName, d.stateName].filter(Boolean).join(', ') || '—';

  document.getElementById('pcName').textContent = fullName || '—';
  document.getElementById('pcRole').textContent = d.role || 'Admin';
  document.getElementById('pcEmail').textContent = d.email || '—';
  document.getElementById('pcLocation').textContent = d.address;
  document.getElementById('pcCreated').textContent = formatDate(d.createdDate);

  const avatarEl = document.getElementById('pcAvatar');
  const fallbackEl = document.getElementById('pcAvatarFallback');
  const initials = initials2(fullName);

  fallbackEl.textContent = initials;

  if (d.image) {
    avatarEl.src = 'https://fitverseapp.runasp.net' + d.image;
    avatarEl.style.display = '';
    fallbackEl.style.display = 'none';
  } else {
    avatarEl.style.display = 'none';
    fallbackEl.style.display = 'flex';
  }

  document.getElementById('profileCardSkeleton').style.display = 'none';
  document.getElementById('profileCardContent').style.display = 'block';
}

/* ── populate form ── */
function populateProfileForm(d) {
  document.getElementById('firstName').value = d.firstName || '';
  document.getElementById('lastName').value = d.lastName || '';
  document.getElementById('emailField').value = d.email || '';
  document.getElementById('phoneNumber').value = d.phoneNumber || '';
  document.getElementById('address').value = d.address || '';
  document.getElementById('zipCode').value = d.zipCode || '';

  // avatar preview
  const previewEl = document.getElementById('previewAvatar');
  const fallbackEl = document.getElementById('previewAvatarFallback');
  const initials = initials2(`${d.firstName || ''} ${d.lastName || ''}`);

  fallbackEl.textContent = initials;

  if (d.image) {
    previewEl.src = d.image;
    previewEl.style.display = '';
    fallbackEl.style.display = 'none';
  } else {
    previewEl.style.display = 'none';
    fallbackEl.style.display = 'flex';
  }

  document.getElementById('formSkeleton').style.display = 'none';
  document.getElementById('profileForm').style.display = 'block';
}

/* ── update topbar avatar & name ── */
function updateTopbar(d) {
  const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim();
  document.getElementById('topbarName').textContent = fullName || 'Admin';

  const wrap = document.getElementById('topbarAvatarWrap');
  if (d.image) {
    wrap.innerHTML = `<img src="https://fitverseapp.runasp.net${esc(d.image)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
  }
}

/* ============================================================
   LOAD STATES
   ============================================================ */
async function loadStates() {
  try {
    const res = await fetch(`https://fitverseapp.runasp.net/States`, { headers: authHeader() });
    const json = await res.json();
    const states = json.data ?? [];

    const sel = document.getElementById('stateSelect');
    sel.innerHTML = '<option value="">— Select State —</option>';
    states.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });

    // After states are loaded, restore the profile's stateId if available
    if (profileData && profileData.stateId) {
      sel.value = profileData.stateId;
      await loadCitiesByState(profileData.stateId, profileData.cityId);
    }
  } catch (err) {
    console.error('Load states error:', err);
  }
}

/* ============================================================
   LOAD CITIES BY STATE
   ============================================================ */
async function loadCitiesByState(stateId, selectedCityId = null) {
  const citySelect = document.getElementById('citySelect');
  citySelect.disabled = true;
  citySelect.innerHTML = '<option value="">Loading cities…</option>';

  try {
    const res = await fetch(`https://fitverseapp.runasp.net/CitiesBasedOnStateId?stateId=${stateId}`, { headers: authHeader() });
    const json = await res.json();
    const cities = json.data ?? [];

    citySelect.innerHTML = '<option value="">— Select City —</option>';
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      citySelect.appendChild(opt);
    });

    citySelect.disabled = false;

    // restore city
    const restore = selectedCityId ?? pendingCityId;
    if (restore) {
      citySelect.value = restore;
      pendingCityId = null;
    }
  } catch (err) {
    console.error('Load cities error:', err);
    citySelect.innerHTML = '<option value="">Failed to load cities</option>';
    citySelect.disabled = true;
  }
}

/* ============================================================
   PREVIEW PROFILE IMAGE
   ============================================================ */
function previewProfileImage(file) {
  selectedFile = file;

  const reader = new FileReader();
  const previewEl = document.getElementById('previewAvatar');
  const fallbackEl = document.getElementById('previewAvatarFallback');
  const pcAvatarEl = document.getElementById('pcAvatar');
  const pcFallback = document.getElementById('pcAvatarFallback');

  reader.onload = (e) => {
    const src = e.target.result;

    previewEl.src = src;
    previewEl.style.display = '';
    fallbackEl.style.display = 'none';

    pcAvatarEl.src = src;
    pcAvatarEl.style.display = '';
    pcFallback.style.display = 'none';
  };

  reader.readAsDataURL(file);
}

/* ============================================================
   UPDATE PROFILE
   ============================================================ */
async function updateProfile() {
  // validate
  let valid = true;
  const fields = ['firstName', 'lastName'];
  fields.forEach(id => {
    const val = document.getElementById(id).value.trim();
    const errEl = document.getElementById('err-' + id);
    if (!val) { errEl.classList.add('show'); valid = false; }
    else errEl.classList.remove('show');
  });
  if (!valid) return;

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

  const cityId = document.getElementById('citySelect').value;

  const payload = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    phoneNumber: document.getElementById('phoneNumber').value.trim(),
    address: document.getElementById('address').value.trim(),
    zipCode: document.getElementById('zipCode').value.trim(),
    cityId: cityId ? parseInt(cityId) : null
  };

  const formData = new FormData();
  formData.append('data', JSON.stringify(payload));
  if (selectedFile) formData.append('image', selectedFile);

  try {
    const res = await fetch(`${API_BASE}/AdminSettings/UpdateProfile`, {
      method: 'PUT',
      headers: authHeader(),   // NO Content-Type — browser sets multipart boundary
      body: formData
    });

    if (!res.ok) throw new Error('Update failed');

    showToast('Profile updated successfully.', 'success');
    selectedFile = null;

    // refresh profile card
    await loadProfile();

  } catch (err) {
    console.error('Update profile error:', err);
    showToast('Failed to update profile. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Save Changes';
  }
}

/* ============================================================
   CHANGE PASSWORD
   ============================================================ */
async function changePassword() {
  const currentPw = document.getElementById('currentPassword').value;
  const newPw = document.getElementById('newPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;
  let valid = true;

  // reset errors
  ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
    document.getElementById('err-' + id).classList.remove('show');
  });

  if (!currentPw) { document.getElementById('err-currentPassword').classList.add('show'); valid = false; }
  if (!newPw) { document.getElementById('err-newPassword').classList.add('show'); valid = false; }
  if (newPw !== confirmPw) {
    document.getElementById('err-confirmPassword').textContent = 'Passwords do not match.';
    document.getElementById('err-confirmPassword').classList.add('show');
    valid = false;
  }

  if (!valid) return;

  const btn = document.getElementById('changePwBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Updating…';

  try {
    const res = await fetch(`${API_BASE}/AdminSettings/ChangePassword`, {
      method: 'PUT',
      headers: jsonHeader(),
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Change failed');
    }

    showToast('Password changed successfully.', 'success');

    // clear fields
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    clearStrength();

  } catch (err) {
    console.error('Change password error:', err);
    const msg = err.message === 'Change failed' ? 'Incorrect current password or server error.' : err.message;
    showToast(msg, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-lock"></i> Change Password';
  }
}

/* ============================================================
   TOGGLE PASSWORD VISIBILITY
   ============================================================ */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'bi bi-eye';
  }
}

/* ============================================================
   PASSWORD STRENGTH
   ============================================================ */
function checkStrength(val) {
  const segs = [1, 2, 3, 4].map(i => document.getElementById('seg' + i));
  const label = document.getElementById('strengthLabel');

  segs.forEach(s => { s.className = 'strength-seg'; });

  if (!val) { label.textContent = ''; return; }

  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { cls: 'weak', text: 'Weak', color: '#ef4444' },
    { cls: 'weak', text: 'Fair', color: '#f97316' },
    { cls: 'medium', text: 'Good', color: '#f59e0b' },
    { cls: 'strong', text: 'Strong', color: '#22c55e' }
  ];

  const lvl = levels[Math.min(score, 3)];
  for (let i = 0; i <= score - 1; i++) segs[i].classList.add(lvl.cls);
  label.textContent = lvl.text;
  label.style.color = lvl.color;
}

function clearStrength() {
  [1, 2, 3, 4].forEach(i => { document.getElementById('seg' + i).className = 'strength-seg'; });
  document.getElementById('strengthLabel').textContent = '';
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials2(name) {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'success') {
  const iconMap = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `
    <i class="bi ${iconMap[type]} toast-icon ${type}"></i>
    <span class="toast-msg">${esc(msg)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 260);
  }, 3500);
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
  console.log('[Flexora] User info:', d);
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