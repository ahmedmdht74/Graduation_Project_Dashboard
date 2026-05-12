/* ═══════════════════════════════════════════════════
   FLEXORA — Dashboard JS v2.0
   Real API integration — ASP.NET Core / JWT
═══════════════════════════════════════════════════ */

'use strict';
// localStorage.setItem("flexora_token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiYWhtZWRtZGh0NzRAZ21haWwuY29tIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvbmFtZWlkZW50aWZpZXIiOiIyNGRiOWI5Ny0wODZkLTQ2OTAtYTNhZS0xYTQzYmE3NTFiZTciLCJqdGkiOiJkYTIyMjdiNS1kNjdlLTQ1YWYtYTNmNi1iMWMzNzE2MjJmMWUiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJhZG1pbiIsImV4cCI6MTc3OTExODgxOSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6NzIzMSIsImF1ZCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3My8ifQ.YXrZhckJ1qvcm11Wxpn_DfyT-upe96Hrvxn6VHtvHNI")
/* ──────────────────────────────────────────────────
   CONFIG
────────────────────────────────────────────────── */
const API = {
  BASE_URL: 'https://fitverseapp.runasp.net/api',
  IMAGE_BASE: 'https://fitverseapp.runasp.net/',  // prepend to relative image paths from server
  ENDPOINTS: {
    stats: '/Dashboard/stats',
    monthlySales: '/Dashboard/monthly-sales',
    userGrowth: '/Dashboard/user-growth',
    ordersAnalytics: '/Dashboard/orders-analytics',
    recentOrders: '/Dashboard/recent-orders',
    latestReviews: '/Dashboard/latest-reviews',
    latestUsers: '/Dashboard/latest-users',
  },
  // External endpoints (full URL — different base)
  EXTERNAL: {
    userInfo: 'https://fitverseapp.runasp.net/UserInfo',
    notifCount: 'https://fitverseapp.runasp.net/api/Dashboard/notifications-count',
  },
  headers() {
    const token = localStorage.getItem('flexora_token');
    console.log('Using token:', token);
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }
};

/* ──────────────────────────────────────────────────
   CORE FETCH WRAPPER
   Reads the standard envelope: { success, message, data }
   Returns data on success, null on any failure.
────────────────────────────────────────────────── */
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API.BASE_URL}${endpoint}`, {
      headers: API.headers()
    });

    if (res.status === 401) {
      console.warn('[Flexora] 401 Unauthorized — check JWT token in localStorage (key: flexora_token).');
      return null;
    }

    if (!res.ok) {
      console.error(`[Flexora] HTTP ${res.status} on ${endpoint}`);
      return null;
    }

    const json = await res.json();

    if (!json.success) {
      console.warn(`[Flexora] success=false on ${endpoint} — ${json.message}`);
      return null;
    }

    return json.data;

  } catch (err) {
    console.error(`[Flexora] Network error on ${endpoint}:`, err);
    return null;
  }
}

/* ──────────────────────────────────────────────────
   UTILITY HELPERS
────────────────────────────────────────────────── */
const fmt = {
  number(n) {
    if (n == null) return '—';
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : Number(n).toLocaleString();
  },
  currency(n) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },
  stars(n) {
    const c = Math.max(0, Math.min(5, n));
    return '★'.repeat(c) + '☆'.repeat(5 - c);
  },
  date(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  pct(n) {
    if (n == null) return { text: '—', trend: 'neutral' };
    const v = Number(n).toFixed(1);
    if (n > 0) return { text: `+${v}%`, trend: 'positive' };
    if (n < 0) return { text: `${v}%`, trend: 'negative' };
    return { text: '0%', trend: 'neutral' };
  }
};

/**
 * Build a usable image URL.
 * - null/undefined  → pravatar fallback
 * - starts with http → use as-is
 * - relative path   → prepend IMAGE_BASE
 */
const UNKNOWN_USER_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='20' fill='%23ede9ff'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%237c4dff' opacity='.5'/%3E%3Cellipse cx='20' cy='34' rx='11' ry='8' fill='%237c4dff' opacity='.3'/%3E%3C/svg%3E`;

function imageUrl(path) {
  if (!path) return UNKNOWN_USER_IMG;
  if (path.startsWith('http')) return path;
  return `${API.IMAGE_BASE}${path}`;
}

function removeSkeleton(el) { el?.classList.remove('skeleton'); }
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''; }

/* ──────────────────────────────────────────────────
   SIDEBAR TOGGLE
────────────────────────────────────────────────── */
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  const open = () => { sidebar.classList.add('open'); overlay.classList.add('show'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };

  toggle?.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);
  window.addEventListener('resize', () => { if (window.innerWidth >= 992) close(); });
}

/* ──────────────────────────────────────────────────
   DARK / LIGHT THEME
────────────────────────────────────────────────── */
function initTheme() {
  const btn = document.getElementById('themeToggle');
  const html = document.documentElement;

  const saved = localStorage.getItem('flexora_theme') || 'light';
  html.setAttribute('data-theme', saved);
  updateIcon(saved);

  btn?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('flexora_theme', next);
    updateIcon(next);
  });

  function updateIcon(t) {
    if (!btn) return;
    btn.innerHTML = t === 'dark'
      ? '<i class="bi bi-sun-fill"></i>'
      : '<i class="bi bi-moon-stars"></i>';
  }
}

/* ──────────────────────────────────────────────────
   SPARKLINES (decorative mini-charts on stat cards)
────────────────────────────────────────────────── */
function drawSparkline(containerId, color) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const pts = Array.from({ length: 12 }, () => Math.random() * 60 + 20);
  const min = Math.min(...pts), max = Math.max(...pts);
  const W = 220, H = 38;

  const coords = pts.map((v, i) =>
    `${(i / (pts.length - 1)) * W},${H - ((v - min) / (max - min + .001)) * H}`
  );
  const fillPts = `0,${H} ${coords.join(' ')} ${W},${H}`;

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%">
      <defs>
        <linearGradient id="sg-${containerId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${color}" stop-opacity=".28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${fillPts}" fill="url(#sg-${containerId})"/>
      <polyline points="${coords.join(' ')}" fill="none" stroke="${color}"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/* ──────────────────────────────────────────────────
   STAT CARDS
   API: /Dashboard/stats
   Shape: { totalUsers, totalOrders, revenue, productsCount,
            aiAnalysesCount, reviewsCount,
            usersGrowthPercentage, ordersGrowthPercentage, revenueGrowthPercentage }
────────────────────────────────────────────────── */
async function loadStats() {
  const d = await apiFetch(API.ENDPOINTS.stats);

  const cards = [
    {
      valId: 'val-users', deltaId: 'delta-users', sparkId: 'spark-users',
      color: '#7c4dff', value: d?.totalUsers, pct: d?.usersGrowthPercentage, currency: false
    },
    {
      valId: 'val-orders', deltaId: 'delta-orders', sparkId: 'spark-orders',
      color: '#e8376e', value: d?.totalOrders, pct: d?.ordersGrowthPercentage, currency: false
    },
    {
      valId: 'val-revenue', deltaId: 'delta-revenue', sparkId: 'spark-revenue',
      color: '#e6a817', value: d?.revenue, pct: d?.revenueGrowthPercentage, currency: true
    },
    {
      valId: 'val-products', deltaId: 'delta-products', sparkId: 'spark-products',
      color: '#2dd4bf', value: d?.productsCount, pct: null, currency: false
    },
    {
      valId: 'val-ai', deltaId: 'delta-ai', sparkId: 'spark-ai',
      color: '#818cf8', value: d?.aiAnalysesCount, pct: null, currency: false
    },
    {
      valId: 'val-reviews', deltaId: 'delta-reviews', sparkId: 'spark-reviews',
      color: '#fbbf24', value: d?.reviewsCount, pct: null, currency: false
    },
  ];

  cards.forEach(({ valId, deltaId, sparkId, color, value, pct, currency }) => {
    const valEl = document.getElementById(valId);
    const deltaEl = document.getElementById(deltaId);

    if (valEl) {
      valEl.textContent = currency ? fmt.currency(value) : fmt.number(value);
      removeSkeleton(valEl);
    }

    if (deltaEl) {
      if (pct != null) {
        const { text, trend } = fmt.pct(pct);
        deltaEl.textContent = text;
        deltaEl.className = `stat-delta ${trend}`;
      } else {
        deltaEl.textContent = '—';
        deltaEl.className = 'stat-delta neutral';
      }
      removeSkeleton(deltaEl);
    }

    drawSparkline(sparkId, color);
  });
}

/* ──────────────────────────────────────────────────
   CHART.JS BASE OPTIONS
────────────────────────────────────────────────── */
const CHART_FONT = 'DM Sans';

function baseOptions() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  const tickColor = dark ? '#7b72a0' : '#9ca3af';
  const bg = dark ? '#1e1537' : '#ffffff';
  const ttTitle = dark ? '#f0eaff' : '#1c1033';
  const ttBody = dark ? '#b0a8c8' : '#6b7280';
  const ttBorder = dark ? '#2e2550' : '#e8e3f5';

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: bg,
        titleColor: ttTitle, bodyColor: ttBody,
        borderColor: ttBorder, borderWidth: 1,
        padding: 12, cornerRadius: 10,
        titleFont: { family: CHART_FONT, weight: '600', size: 13 },
        bodyFont: { family: CHART_FONT, size: 12 },
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { family: CHART_FONT, size: 11 } }
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: {
          color: tickColor, font: { family: CHART_FONT, size: 11 },
          callback: v => '$' + (v >= 1000 ? (v / 1000) + 'k' : v)
        }
      }
    }
  };
}

/* ──────────────────────────────────────────────────
   SALES CHART
   API: /Dashboard/monthly-sales
   Shape: [{ month: "Mar", revenue: 55360.00 }, ...]
────────────────────────────────────────────────── */
let salesChart = null;
let salesChartData = null;

async function loadAndBuildSalesChart() {
  const data = await apiFetch(API.ENDPOINTS.monthlySales);
  const arr = Array.isArray(data) ? data : [];

  salesChartData = {
    labels: arr.map(i => i.month),
    revenue: arr.map(i => Number(i.revenue))
  };

  renderSalesChart();
}

function renderSalesChart() {
  const ctx = document.getElementById('salesChart');
  if (!ctx || !salesChartData) return;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(124,77,255,.28)');
  gradient.addColorStop(1, 'rgba(124,77,255,.0)');

  const opts = baseOptions();
  opts.scales.y.ticks.callback = v => '$' + (v >= 1000 ? (v / 1000) + 'k' : v);

  if (salesChart) salesChart.destroy();

  salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: salesChartData.labels,
      datasets: [{
        label: 'Revenue',
        data: salesChartData.revenue,
        backgroundColor: gradient,
        borderColor: '#7c4dff',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: opts
  });
}

function initSalesTabs() {
  document.querySelectorAll('#salesTabs .period-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#salesTabs .period-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderSalesChart();   // re-render cached data
    });
  });
}

/* ──────────────────────────────────────────────────
   USER GROWTH CHART
   API: /Dashboard/user-growth
   Shape: [{ month: "Feb", newUsers: 13 }, ...]
────────────────────────────────────────────────── */
async function loadAndBuildUserChart() {
  const data = await apiFetch(API.ENDPOINTS.userGrowth);
  const arr = Array.isArray(data) ? data : [];

  const ctx = document.getElementById('userChart');
  if (!ctx) return;

  const opts = baseOptions();
  opts.scales.y.ticks.callback = v => v >= 1000 ? (v / 1000) + 'k' : v;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: arr.map(i => i.month),
      datasets: [{
        label: 'New Users',
        data: arr.map(i => i.newUsers),
        borderColor: '#7c4dff',
        backgroundColor: 'rgba(124,77,255,.12)',
        fill: true,
        tension: .5,
        pointRadius: 4,
        pointBackgroundColor: '#7c4dff',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 2,
      }]
    },
    options: opts
  });
}

/* ──────────────────────────────────────────────────
   ORDERS ANALYTICS DONUT
   API: /Dashboard/orders-analytics
   Shape: { pending, confirmed, shipped, delivered, cancelled }
────────────────────────────────────────────────── */
async function loadAndBuildOrdersChart() {
  const data = await apiFetch(API.ENDPOINTS.ordersAnalytics);

  const STATUS_CFG = [
    { key: 'delivered', label: 'Delivered', color: '#22c55e' },
    { key: 'confirmed', label: 'Confirmed', color: '#7c4dff' },
    { key: 'shipped', label: 'Shipped', color: '#818cf8' },
    { key: 'pending', label: 'Pending', color: '#f8c84b' },
    { key: 'cancelled', label: 'Cancelled', color: '#e8376e' },
  ];

  const items = STATUS_CFG
    .map(cfg => ({ ...cfg, value: data ? (data[cfg.key] ?? 0) : 0 }))
    .filter(i => i.value > 0);

  const total = items.reduce((s, i) => s + i.value, 0);

  const totalEl = document.getElementById('donutTotal');
  if (totalEl) { totalEl.textContent = fmt.number(total); removeSkeleton(totalEl); }

  const legendEl = document.getElementById('donutLegend');
  if (legendEl) {
    legendEl.innerHTML = items.map(i => `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${i.color}"></span>
        ${i.label}: <strong>${fmt.number(i.value)}</strong>
      </div>`).join('');
  }

  const ctx = document.getElementById('ordersChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: items.map(i => i.label),
      datasets: [{
        data: items.map(i => i.value),
        backgroundColor: items.map(i => i.color),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#1c1033', bodyColor: '#6b7280',
          borderColor: '#e8e3f5', borderWidth: 1,
          padding: 12, cornerRadius: 10,
          titleFont: { family: CHART_FONT, weight: '600', size: 13 },
          bodyFont: { family: CHART_FONT, size: 12 },
          callbacks: { label: c => ` ${c.label}: ${fmt.number(c.parsed)} orders` }
        }
      }
    }
  });
}

/* ──────────────────────────────────────────────────
   RECENT ORDERS TABLE
   API: /Dashboard/recent-orders
   Shape: [{ orderId, customerName, productSummary,
             amount, status, createdDate }]
────────────────────────────────────────────────── */
const STATUS_CSS_MAP = {
  pending: 'pending',
  confirmed: 'processing',
  shipped: 'processing',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

async function loadRecentOrders() {
  const data = await apiFetch(API.ENDPOINTS.recentOrders);
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No recent orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((o, idx) => {
    const cssClass = STATUS_CSS_MAP[(o.status || '').toLowerCase()] || 'pending';
    return `
      <tr>
        <td><span class="order-id">#FLX-${o.orderId}</span></td>
        <td>
          <div class="customer-cell">
            <span class="customer-name">${o.customerName}</span>
          </div>
        </td>
        <td>${o.productSummary}</td>
        <td><span class="amount-cell">${fmt.currency(o.amount)}</span></td>
        <td><span class="status-badge status-${cssClass}">${capitalize(o.status)}</span></td>
      </tr>`;
  }).join('');
}

/* ──────────────────────────────────────────────────
   LATEST REVIEWS
   API: /Dashboard/latest-reviews
   Shape: [{ userName, userImage, productName,
             rating, comment, createdAt }]
────────────────────────────────────────────────── */
async function loadReviews() {
  const data = await apiFetch(API.ENDPOINTS.latestReviews);
  const list = document.getElementById('reviewsList');
  if (!list) return;

  if (!data || !data.length) {
    list.innerHTML = `<p class="text-muted text-center py-3">No reviews yet.</p>`;
    return;
  }

  list.innerHTML = data.map((r, idx) => `
    <div class="review-item">
      <img src="${imageUrl(r.userImage)}"
           alt="${r.userName}" class="review-avatar" loading="lazy"/>
      <div class="review-body">
        <div class="review-header">
          <div>
            <div class="review-author">${r.userName}</div>
            <div class="review-product">${r.productName}</div>
          </div>
          <div class="review-stars">${fmt.stars(r.rating)}</div>
        </div>
        <div class="review-text">${r.comment}</div>
      </div>
    </div>`).join('');
}

/* ──────────────────────────────────────────────────
   LATEST USERS
   API: /Dashboard/latest-users
   Shape: [{ fullName, email, image, createdDate }]
────────────────────────────────────────────────── */
async function loadUsers() {
  const data = await apiFetch(API.ENDPOINTS.latestUsers);
  const list = document.getElementById('usersList');
  if (!list) return;

  if (!data || !data.length) {
    list.innerHTML = `<p class="text-muted text-center py-3">No users found.</p>`;
    return;
  }

  list.innerHTML = data.map((u, idx) => `
    <div class="user-item">
      <img src="${imageUrl(u.image)}"
           alt="${u.fullName}" class="user-item-avatar" loading="lazy"/>
      <div>
        <div class="user-item-name">${u.fullName}</div>
        <div class="user-item-email">${u.email}</div>
      </div>
      <span class="user-item-badge user-badge-new">${fmt.date(u.createdDate)}</span>
    </div>`).join('');
}

/* ──────────────────────────────────────────────────
   BOOTSTRAP
────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  initSalesTabs();

  // Data fetches in parallel
  Promise.all([
    loadStats(),
    loadRecentOrders(),
    loadReviews(),
    loadUsers(),
    loadUserInfo(),
    loadNotifCount(),
  ]);

  // Charts after layout settles
  setTimeout(() => {
    loadAndBuildSalesChart();
    loadAndBuildUserChart();
    loadAndBuildOrdersChart();
  }, 120);
});

/* ──────────────────────────────────────────────────
   FETCH WRAPPER FOR FULL-URL ENDPOINTS
────────────────────────────────────────────────── */
async function apiFetchExternal(url) {
  try {
    const res = await fetch(url, { headers: API.headers() });
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
   USER INFO  —  /UserInfo
────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

async function loadUserInfo() {
  const d = await apiFetchExternal(API.EXTERNAL.userInfo);

  const firstName = d?.firstName || 'Admin';
  const lastName = d?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = d?.email || '';
  const avatar = d?.imageUrl ? `${API.IMAGE_BASE}${d.imageUrl}`
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

/* ──────────────────────────────────────────────────
   NOTIFICATIONS COUNT  —  /notifications-count
────────────────────────────────────────────────── */
async function loadNotifCount() {
  const d = await apiFetchExternal(API.EXTERNAL.notifCount);
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  const count = d?.count ?? 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count === 0 ? 'none' : '';
}

/* ──────────────────────────────────────────────────
   EXPORT TO PDF
   Uses html2canvas + jsPDF — no extra API needed.
   Captures the live .page-content with all real data.
────────────────────────────────────────────────── */
async function exportDashboardPDF() {
  const btn = document.getElementById('exportBtn');

  // ── Button loading state ──
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i> Generating…';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;

    // A4 landscape for better dashboard fit
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();   // 297mm
    const pdfH = pdf.internal.pageSize.getHeight();  // 210mm

    // ── Cover page ──
    pdf.setFillColor(26, 16, 48);   // sidebar dark purple
    pdf.rect(0, 0, pdfW, pdfH, 'F');

    // Accent bar
    pdf.setFillColor(124, 77, 255);
    pdf.rect(0, 0, 8, pdfH, 'F');

    // Title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Flexora', 24, 70);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(176, 168, 200);
    pdf.text('Premium Fashion Intelligence Dashboard', 24, 82);

    // Date
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    pdf.setFontSize(10);
    pdf.setTextColor(123, 114, 160);
    pdf.text(`Generated on ${dateStr}`, 24, 96);

    // Stats summary on cover
    const statItems = [
      { label: 'Total Users', id: 'val-users' },
      { label: 'Total Orders', id: 'val-orders' },
      { label: 'Revenue', id: 'val-revenue' },
      { label: 'Products', id: 'val-products' },
      { label: 'AI Analyses', id: 'val-ai' },
      { label: 'Reviews', id: 'val-reviews' },
    ];

    pdf.setFontSize(9);
    pdf.setTextColor(160, 126, 232);
    pdf.text('KEY METRICS', 24, 120);

    statItems.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 24 + col * 90;
      const y = 130 + row * 22;
      const val = document.getElementById(item.id)?.textContent || '—';

      // Card bg
      pdf.setFillColor(40, 28, 72);
      pdf.roundedRect(x, y - 8, 82, 16, 3, 3, 'F');

      pdf.setFontSize(8);
      pdf.setTextColor(123, 114, 160);
      pdf.text(item.label, x + 5, y - 1);

      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(200, 180, 255);
      pdf.text(val, x + 5, y + 6);
      pdf.setFont('helvetica', 'normal');
    });

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(80, 60, 120);
    pdf.text('© 2025 Flexora — Confidential', 24, pdfH - 10);

    // ── Page 2: Dashboard screenshot ──
    pdf.addPage();

    const content = document.querySelector('.page-content');

    // Temporarily expand for full capture
    const origOverflow = content.style.overflow;
    content.style.overflow = 'visible';

    const canvas = await html2canvas(content, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--bg').trim() || '#f8f7ff',
      logging: false,
      windowWidth: 1400,
    });

    content.style.overflow = origOverflow;

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const imgW = pdfW - 16;          // 8mm margin each side
    const imgH = (canvas.height / canvas.width) * imgW;
    const pageCount = Math.ceil(imgH / (pdfH - 20));

    for (let p = 0; p < pageCount; p++) {
      if (p > 0) pdf.addPage();

      // Header bar
      pdf.setFillColor(26, 16, 48);
      pdf.rect(0, 0, pdfW, 10, 'F');
      pdf.setFillColor(124, 77, 255);
      pdf.rect(0, 0, pdfW, 1.5, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(160, 140, 200);
      pdf.text('FLEXORA — Dashboard Report', 8, 7);
      pdf.text(`Page ${p + 2}`, pdfW - 8, 7, { align: 'right' });

      // Slice the image for this page
      const srcY = (p * (pdfH - 20)) / imgH * canvas.height;
      const srcH = Math.min(((pdfH - 20) / imgH) * canvas.height, canvas.height - srcY);
      const sliceH = (srcH / canvas.height) * imgH;

      // Draw sliced portion
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = srcH;
      sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 8, 12, imgW, sliceH);
    }

    // ── Save ──
    const fileName = `Flexora_Dashboard_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`;
    pdf.save(fileName);

  } catch (err) {
    console.error('[Flexora Export]', err);
    alert('Export failed. Check console for details.');
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

// Spin animation for loading state
const exportStyle = document.createElement('style');
exportStyle.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { display:inline-block; animation: spin .7s linear infinite; }
`;
document.head.appendChild(exportStyle);

// Wire up button
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportBtn')?.addEventListener('click', exportDashboardPDF);
});
