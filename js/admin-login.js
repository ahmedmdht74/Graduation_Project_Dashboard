/* ============================================================
   FLEXORA — Admin Login
   admin-login.js
   ============================================================ */

const LOGIN_API = 'https://fitverseapp.runasp.net/LoginUser';

/* ============================================================
   AUTO-REDIRECT if already logged in
   ============================================================ */
(function checkExistingSession() {
    const token = localStorage.getItem('flexora_token');
    const role = localStorage.getItem('role');
    if (token && role === 'admin') {
        window.location.replace('index.html');
    }
})();

/* ============================================================
   DOM READY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    /* ── Enter key support ── */
    document.getElementById('emailInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('passwordInput').focus();
    });

    document.getElementById('passwordInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    /* ── Password toggle ── */
    document.getElementById('pwToggle').addEventListener('click', () => {
        const input = document.getElementById('passwordInput');
        const icon = document.getElementById('pwToggleIcon');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'bi bi-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'bi bi-eye';
        }
    });

    /* ── Login button ── */
    document.getElementById('loginBtn').addEventListener('click', handleLogin);

    /* ── Clear errors on input ── */
    document.getElementById('emailInput').addEventListener('input', () => clearFieldError('emailGroup', 'emailError'));
    document.getElementById('passwordInput').addEventListener('input', () => clearFieldError('passwordGroup', 'passwordError'));
});

/* ============================================================
   VALIDATION
   ============================================================ */
function validate() {
    let valid = true;
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    // email
    if (!email) {
        setFieldError('emailGroup', 'emailError', 'Email address is required.');
        valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError('emailGroup', 'emailError', 'Please enter a valid email address.');
        valid = false;
    } else {
        clearFieldError('emailGroup', 'emailError');
    }

    // password
    if (!password) {
        setFieldError('passwordGroup', 'passwordError', 'Password is required.');
        valid = false;
    } else if (password.length < 4) {
        setFieldError('passwordGroup', 'passwordError', 'Password must be at least 4 characters.');
        valid = false;
    } else {
        clearFieldError('passwordGroup', 'passwordError');
    }

    return valid;
}

function setFieldError(groupId, errorId, msg) {
    document.getElementById(groupId).classList.add('has-error');
    document.getElementById(errorId).textContent = msg;
}

function clearFieldError(groupId, errorId) {
    document.getElementById(groupId).classList.remove('has-error');
    document.getElementById(errorId).textContent = '';
}

/* ============================================================
   HANDLE LOGIN
   ============================================================ */
async function handleLogin() {
    hideGlobalError();

    if (!validate()) return;

    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    setLoading(true);

    try {
        const res = await fetch(LOGIN_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, rememberMe })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData.message || 'Invalid email or password.';
            showGlobalError(msg);
            showToast(msg, 'error');
            setLoading(false);
            return;
        }

        const data = await res.json();

        /* ── role check ── */
        const roles = (data.roles || []).map(r => String(r).toLowerCase());
        const isAdmin = roles.includes('admin');

        if (!isAdmin) {
            showGlobalError('Access denied. Admins only.');
            showToast('Access denied. Admins only.', 'error');
            setLoading(false);
            return;
        }

        /* ── save token ── */
        localStorage.setItem('flexora_token', data.token);
        localStorage.setItem('role', 'admin');

        if (data.expiration) {
            localStorage.setItem('token_expiration', data.expiration);
        }

        showToast('Login successful! Redirecting…', 'success');

        setTimeout(() => {
            window.location.replace('index.html');
        }, 800);

    } catch (err) {
        console.error('Login error:', err);
        showGlobalError('Network error. Please check your connection.');
        showToast('Network error. Please try again.', 'error');
        setLoading(false);
    }
}

/* ============================================================
   UI HELPERS
   ============================================================ */
function setLoading(state) {
    const btn = document.getElementById('loginBtn');
    const text = document.getElementById('loginBtnText');
    const loader = document.getElementById('loginBtnLoader');

    btn.disabled = state;
    text.style.display = state ? 'none' : 'inline-flex';
    loader.style.display = state ? 'inline-flex' : 'none';
}

function showGlobalError(msg) {
    const el = document.getElementById('globalError');
    el.innerHTML = `<i class="bi bi-exclamation-circle-fill" style="font-size:14px;flex-shrink:0"></i> ${esc(msg)}`;
    el.style.display = 'flex';
}

function hideGlobalError() {
    document.getElementById('globalError').style.display = 'none';
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'success') {
    const iconMap = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        info: 'bi-info-circle-fill'
    };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `
    <i class="bi ${iconMap[type] || iconMap.info} toast-icon ${type}"></i>
    <span class="toast-msg">${esc(msg)}</span>
  `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 260);
    }, 3500);
}

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}