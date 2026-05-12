/* ═══════════════════════════════════════════════════
   FLEXORA — Edit Product JS  (product-edit.js)
   FULLY SELF-CONTAINED — no dependency on product-form.js
   APIs:
     GET  /api/Products/EditProduct/{id}
     GET  /api/Products/categories
     GET  /api/Products/subcategories?categoryId=X
     PUT  /api/Products/UpdateProduct/{id}  (multipart)
═══════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = 'https://fitverseapp.runasp.net/api';
const IMAGE_BASE = 'https://fitverseapp.runasp.net';

function getToken() { return localStorage.getItem('flexora_token') || ''; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let productId = null;
let productData = null;
let currentVariants = [];
let deletedVariantIds = [];
let isSaving = false;

/*
  variantNewFiles[variantId] = {
    mainImage: File | null,
    additionalImages: File[],
    vectorImage: File | null
  }
*/
const variantNewFiles = {};

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();
  initTheme();
  loadUserInfo();
  productId = localStorage.getItem('flexora_edit_product_id')
    || new URLSearchParams(location.search).get('id');

  if (!productId) {
    showToast('error', 'No product ID — redirecting…');
    setTimeout(() => window.location.href = 'products.html', 1500);
    return;
  }

  setPageLoading(true);
  try {
    await loadCategories();
    await loadProductDetails();
  } finally {
    setPageLoading(false);
  }
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
   API: CATEGORIES
══════════════════════════════════════ */
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/Products/categories`, { headers: authHeader() });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    const sel = document.getElementById('editCategory');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select category…</option>' +
      data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  } catch (err) {
    console.error('[Flexora] loadCategories:', err);
    showToast('error', 'Could not load categories');
  }
}

/* ══════════════════════════════════════
   API: SUBCATEGORIES
══════════════════════════════════════ */
async function loadSubcategories(categoryId, selectedSubId = null) {
  const sel = document.getElementById('editSubCategory');
  if (!sel) return;

  if (!categoryId) {
    sel.innerHTML = '<option value="">Select sub-category…</option>';
    return;
  }

  sel.innerHTML = '<option>Loading…</option>';
  sel.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/Products/subcategories?categoryId=${categoryId}`, { headers: authHeader() });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    sel.innerHTML = '<option value="">Select sub-category…</option>' +
      data.map(s =>
        `<option value="${s.id}" ${Number(s.id) === Number(selectedSubId) ? 'selected' : ''}>${s.name}</option>`
      ).join('');

  } catch (err) {
    console.error('[Flexora] loadSubcategories:', err);
    sel.innerHTML = '<option value="">Failed to load</option>';
    showToast('error', 'Could not load sub-categories');
  } finally {
    sel.disabled = false;
  }
}

/* Called by onchange on category select */
async function updateSubcategoriesEdit() {
  const catId = document.getElementById('editCategory')?.value;
  await loadSubcategories(catId, null);
}

/* ══════════════════════════════════════
   API: GET PRODUCT DETAILS
══════════════════════════════════════ */
async function loadProductDetails() {
  try {
    const res = await fetch(`${API_BASE}/Products/EditProduct/${productId}`, {
      headers: authHeader()
    });

    if (res.status === 401) { showToast('error', 'Unauthorized'); return; }
    if (res.status === 404) {
      showToast('error', 'Product not found');
      setTimeout(() => location.href = 'products.html', 1500);
      return;
    }
    if (!res.ok) throw new Error(res.status);

    productData = await res.json();
    await populateForm(productData);

  } catch (err) {
    console.error('[Flexora] loadProductDetails:', err);
    showToast('error', 'Failed to load product details');
  }
}

/* ══════════════════════════════════════
   POPULATE FORM
══════════════════════════════════════ */
async function populateForm(p) {
  /* Header */
  const safeTitle = escHtml(p.name || '');
  document.getElementById('editPageTitle').textContent = p.name || 'Edit Product';
  document.getElementById('editBreadcrumb').textContent = p.name || 'Edit';
  document.getElementById('editProductId').textContent = `#FLX-${String(p.id).padStart(4, '0')}`;

  /* Basic fields */
  document.getElementById('editProductName').value = p.name || '';
  document.getElementById('editProductDesc').value = p.description || '';

  /* Category — select current value */
  const catSel = document.getElementById('editCategory');
  if (catSel) {
    catSel.value = p.categoryId;
    /* Trigger subcategory load with current subCategoryId pre-selected */
    await loadSubcategories(p.categoryId, p.subCategoryId);
  }

  /* Quick Stats */
  const variants = p.variants || [];
  const sizeCharts = p.sizeCharts || [];
  const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const prices = variants.map(v => Number(v.price) || 0).filter(x => x > 0);
  const basePrice = prices.length ? Math.min(...prices) : 0;

  const qsV = document.getElementById('qsVariants');
  const qsS = document.getElementById('qsStock');
  const qsP = document.getElementById('qsPrice');
  const vtc = document.getElementById('varTabCount');

  if (qsV) qsV.textContent = variants.length;
  if (qsS) qsS.textContent = totalStock.toLocaleString();
  if (qsP) qsP.textContent = `EGP ${basePrice.toLocaleString()}`;
  if (vtc) vtc.textContent = variants.length;

  /* Variants state */
  currentVariants = variants.map(v => ({ ...v }));
  deletedVariantIds = [];
  currentVariants.forEach(v => {
    variantNewFiles[v.id] = { mainImage: null, additionalImages: [], vectorImage: null };
  });
  renderEditVariantTable();

  /* Size chart */
  renderSizeChart(sizeCharts);
}

/* ══════════════════════════════════════
   TAB SWITCHER
══════════════════════════════════════ */
function showEditTab(name) {
  document.querySelectorAll('.edit-tab').forEach(el => el.classList.add('d-none'));
  document.getElementById(`editTab-${name}`)?.classList.remove('d-none');

  document.querySelectorAll('.sec-tab').forEach(el => el.classList.remove('active'));
  const map = { info: 0, variants: 1, sizechart: 2 };
  const tabs = document.querySelectorAll('.sec-tab');
  if (map[name] !== undefined) tabs[map[name]]?.classList.add('active');
}

/* ══════════════════════════════════════
   VARIANT TABLE
══════════════════════════════════════ */
function renderEditVariantTable() {
  const tbody = document.getElementById('editVariantTableBody');
  if (!tbody) return;

  if (!currentVariants.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:48px;color:var(--text-muted)">
          <i class="bi bi-layers" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:.4"></i>
          No variants remaining
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = currentVariants.map((v, i) => {
    const files = variantNewFiles[v.id] || { mainImage: null, additionalImages: [], vectorImage: null };

    /* Main image: new file preview OR existing URL */
    const mainSrc = files.mainImage
      ? URL.createObjectURL(files.mainImage)
      : (v.mainImageUrl ? `${IMAGE_BASE}/${v.mainImageUrl}` : '');

    /* Additional images: new files OR existing URLs */
    const additionalSrcs = files.additionalImages.length
      ? files.additionalImages.map(f => URL.createObjectURL(f))
      : (v.additionalImages || []).map(url => `${IMAGE_BASE}/${url}`);

    const mainThumb = mainSrc
      ? `<img src="${mainSrc}" class="img-thumb"
              onerror="this.style.display='none';this.nextSibling.style.display='flex'"
              alt="main image" style="width:38px;height:38px;border-radius:8px;object-fit:cover;border:1px solid var(--border)"/>
         <span style="display:none"><i class="bi bi-camera"></i></span>`
      : `<i class="bi bi-camera"></i>`;

    const extraThumbs = additionalSrcs.map(src => `
      <img src="${src}" class="extra-img-thumb"
           onerror="this.style.display='none'"
           style="width:30px;height:30px;border-radius:6px;object-fit:cover;border:1px solid var(--border)"/>`
    ).join('');

    return `
    <tr id="erow-${v.id}">
      <td style="color:var(--text-muted);font-size:.8rem">${i + 1}</td>

      <td>
        <div class="var-combo">
          <span class="var-color-swatch"
                style="background:${colorHex(v.color)};width:18px;height:18px;border-radius:4px;border:1.5px solid rgba(0,0,0,.12);display:inline-block;flex-shrink:0"></span>
          <span style="font-weight:500">${escHtml(v.color)}</span>
          <span class="var-size-badge">${escHtml(v.size)}</span>
        </div>
        <div style="font-size:.7rem;color:var(--text-muted);margin-top:3px">ID #${v.id} · read-only</div>
      </td>

      <td>
        <input type="number" class="var-input price" min="0" step="0.01"
               value="${v.price || ''}" placeholder="0.00"
               onchange="updateEditVariantField(${v.id},'price',this.value)"
               style="max-width:110px"/>
      </td>

      <td>
        <input type="number" class="var-input stock" min="0"
               value="${v.stock ?? 0}" placeholder="0"
               onchange="updateEditVariantField(${v.id},'stock',this.value)"
               style="max-width:90px"/>
      </td>

      <td>
        <label class="img-upload-btn" title="Replace main image" style="cursor:pointer">
          ${mainThumb}
          <input type="file" accept="image/*" style="display:none"
                 onchange="handleEditMainImage(event,${v.id})"/>
        </label>
      </td>

      <td>
        <div class="extra-imgs" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
          ${extraThumbs}
          <label class="extra-img-add" title="Add images" style="cursor:pointer;width:30px;height:30px;border:1.5px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.8rem;color:var(--text-muted)">
            <i class="bi bi-plus"></i>
            <input type="file" accept="image/*" multiple style="display:none"
                   onchange="handleEditExtraImages(event,${v.id})"/>
          </label>
        </div>
      </td>

      <td>
        <input type="text" class="var-input model" placeholder="https://…"
               value="${escHtml(v.model3DUrl || '')}"
               onchange="updateEditVariantField(${v.id},'model3DUrl',this.value)"
               style="min-width:160px"/>
      </td>

      <td>
        <button type="button" class="btn-danger btn-sm btn-icon"
                title="Delete variant"
                onclick="deleteEditVariant(${v.id})">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Inline field update ── */
function updateEditVariantField(variantId, field, value) {
  const v = currentVariants.find(v => v.id === variantId);
  if (v) v[field] = value;
}

/* ── Delete (client-side, queued) ── */
function deleteEditVariant(variantId) {
  if (!confirm('Remove this variant? The deletion happens only after saving.')) return;

  deletedVariantIds.push(variantId);
  currentVariants = currentVariants.filter(v => v.id !== variantId);
  delete variantNewFiles[variantId];

  document.getElementById('varTabCount').textContent = currentVariants.length;
  renderEditVariantTable();
  showToast('success', `Variant #${variantId} queued for deletion`);
}

/* ── File handlers ── */
function handleEditMainImage(event, variantId) {
  const file = event.target.files[0];
  if (!file) return;
  if (!variantNewFiles[variantId]) variantNewFiles[variantId] = { mainImage: null, additionalImages: [], vectorImage: null };
  variantNewFiles[variantId].mainImage = file;
  renderEditVariantTable();
}

function handleEditExtraImages(event, variantId) {
  const files = Array.from(event.target.files);
  if (!variantNewFiles[variantId]) variantNewFiles[variantId] = { mainImage: null, additionalImages: [], vectorImage: null };
  variantNewFiles[variantId].additionalImages.push(...files);
  renderEditVariantTable();
}

/* ── Bulk edit ── */
function applyToAll() {
  document.getElementById('applyAllStrip')?.classList.toggle('d-none');
}

function doApplyToAll() {
  const price = document.getElementById('applyPrice')?.value;
  const stock = document.getElementById('applyStock')?.value;
  currentVariants.forEach(v => {
    if (price) v.price = parseFloat(price);
    if (stock) v.stock = parseInt(stock);
  });
  renderEditVariantTable();
  document.getElementById('applyAllStrip')?.classList.add('d-none');
  showToast('success', 'Applied to all variants');
}

/* ══════════════════════════════════════
   SIZE CHART
══════════════════════════════════════ */
function renderSizeChart(sizeCharts) {
  const tbody = document.getElementById('editSizeChartBody');
  if (!tbody) return;

  const fields = ['height', 'weight', 'chest', 'waist', 'hip', 'neck', 'shoulderWidth', 'armLength', 'legLength'];

  if (!sizeCharts.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">No size chart data</td></tr>`;
    return;
  }

  tbody.innerHTML = sizeCharts.map(row => `
    <tr>
      <td class="sc-size-label" style="font-weight:700;color:var(--purple-500)">${escHtml(row.size)}</td>
      ${fields.map(f => `
        <td>
          <input type="number" class="sc-input" step="0.1" min="0"
                 value="${row[f] ?? ''}" placeholder="—"
                 data-size="${escHtml(row.size)}" data-field="${f}"
                 style="width:75px;text-align:center;padding:6px 8px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text-primary);font-size:.82rem;outline:none"/>
        </td>`).join('')}
    </tr>`).join('');
}

function collectSizeChart() {
  const fields = ['height', 'weight', 'chest', 'waist', 'hip', 'neck', 'shoulderWidth', 'armLength', 'legLength'];
  return Array.from(document.querySelectorAll('#editSizeChartBody tr')).map(row => {
    const size = row.querySelector('.sc-size-label')?.textContent?.trim();
    if (!size) return null;
    const inputs = row.querySelectorAll('input');
    const entry = { size };
    fields.forEach((f, i) => { entry[f] = parseFloat(inputs[i]?.value) || 0; });
    return entry;
  }).filter(Boolean);
}

async function saveSizeChart() {
  /* Collects current chart data and saves via full product update */
  const sizeCharts = collectSizeChart();
  if (!sizeCharts.length) { showToast('error', 'No size chart data to save'); return; }

  /* Quick save — sends only sizeCharts update via full PUT */
  const name = document.getElementById('editProductName')?.value.trim();
  const catId = document.getElementById('editCategory')?.value;
  if (!name || !catId) {
    showToast('error', 'Fill product info first before saving chart');
    return;
  }

  const payload = {
    name,
    description: document.getElementById('editProductDesc')?.value.trim() || '',
    categoryId: parseInt(catId),
    subCategoryId: parseInt(document.getElementById('editSubCategory')?.value) || null,
    deletedVariantIds: [],
    variants: currentVariants.map(v => ({
      id: v.id,
      price: parseFloat(v.price) || 0,
      stock: parseInt(v.stock) || 0,
      model3DUrl: v.model3DUrl || '',
    })),
    sizeCharts,
  };

  const formData = new FormData();
  formData.append('data', JSON.stringify(payload));

  const btn = document.querySelector('[onclick="saveSizeChart()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…'; }

  try {
    const res = await fetch(`${API_BASE}/Products/UpdateProduct/${productId}`, {
      method: 'PUT',
      headers: authHeader(),
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[Flexora] saveSizeChart:', res.status, err);
      showToast('error', `Save failed (${res.status})`);
      return;
    }
    showToast('success', 'Size chart saved successfully!');
  } catch (err) {
    console.error('[Flexora] saveSizeChart network error:', err);
    showToast('error', 'Network error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-floppy me-1"></i> Save Chart'; }
  }
}

/* ══════════════════════════════════════
   SAVE — PUT multipart/form-data
══════════════════════════════════════ */
async function updateProduct() {
  if (isSaving) return;

  /* Validate */
  const name = document.getElementById('editProductName')?.value.trim();
  const catId = document.getElementById('editCategory')?.value;

  if (!name) { showToast('error', 'Product name is required'); showEditTab('info'); return; }
  if (!catId) { showToast('error', 'Please select a category'); showEditTab('info'); return; }

  const unpriced = currentVariants.find(v => !v.price || parseFloat(v.price) <= 0);
  if (unpriced) {
    showToast('error', `Set a price for ${unpriced.color} / ${unpriced.size}`);
    showEditTab('variants');
    return;
  }

  /* Build payload */
  const payload = {
    name,
    description: document.getElementById('editProductDesc')?.value.trim() || '',
    categoryId: parseInt(catId),
    subCategoryId: parseInt(document.getElementById('editSubCategory')?.value) || null,
    deletedVariantIds,
    variants: currentVariants.map(v => ({
      id: v.id,
      price: parseFloat(v.price),
      stock: parseInt(v.stock) || 0,
      model3DUrl: v.model3DUrl || '',
    })),
    sizeCharts: collectSizeChart(),
  };

  /* FormData */
  const formData = new FormData();
  formData.append('data', JSON.stringify(payload));

  currentVariants.forEach(v => {
    const files = variantNewFiles[v.id];
    if (!files) return;
    if (files.mainImage)
      formData.append(`variantMainImage_${v.id}`, files.mainImage, files.mainImage.name);
    files.additionalImages.forEach(f =>
      formData.append(`variantAdditionalImages_${v.id}`, f, f.name));
    if (files.vectorImage)
      formData.append(`variantVector_${v.id}`, files.vectorImage, files.vectorImage.name);
  });

  /* Send */
  isSaving = true;
  setSaveLoading(true);

  try {
    const res = await fetch(`${API_BASE}/Products/UpdateProduct/${productId}`, {
      method: 'PUT',
      headers: authHeader(),   // NO Content-Type — browser sets multipart boundary
      body: formData,
    });

    if (res.status === 401) { showToast('error', 'Unauthorized — check your token'); return; }
    if (res.status === 404) { showToast('error', 'Product not found'); return; }

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[Flexora] UpdateProduct:', res.status, err);
      showToast('error', `Save failed (${res.status})`);
      return;
    }

    /* Success — reset dirty state */
    deletedVariantIds = [];
    Object.keys(variantNewFiles).forEach(k => {
      variantNewFiles[k] = { mainImage: null, additionalImages: [], vectorImage: null };
    });

    const statusEl = document.getElementById('saveBarStatus');
    const indEl = document.getElementById('saveIndicator');
    if (statusEl) statusEl.textContent = 'Saved ✓';
    if (indEl) indEl.style.color = 'var(--green-500)';

    showToast('success', 'Product updated successfully!');

  } catch (err) {
    console.error('[Flexora] Network error:', err);
    showToast('error', 'Network error — check your connection');
  } finally {
    isSaving = false;
    setSaveLoading(false);
  }
}

function setSaveLoading(loading) {
  document.querySelectorAll('[onclick="updateProduct()"]').forEach(btn => {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner-border spinner-border-sm me-2"></span>Saving…'
      : '<i class="bi bi-check2 me-1"></i> Save Changes';
  });
}

/* ══════════════════════════════════════
   MISC
══════════════════════════════════════ */
function archiveProduct() {
  if (!confirm('Archive this product? It will be hidden from the store.')) return;
  showToast('success', 'Archive: implement endpoint when ready');
}

function viewProduct() {
  showToast('success', 'Preview not available in admin mode');
}

/* ══════════════════════════════════════
   PAGE LOADING OVERLAY
══════════════════════════════════════ */
function setPageLoading(loading) {
  let overlay = document.getElementById('pageLoadingOverlay');
  if (loading) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pageLoadingOverlay';
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9999',
        'background:rgba(26,16,48,.6)', 'backdrop-filter:blur(4px)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'flex-direction:column', 'gap:16px'
      ].join(';');
      overlay.innerHTML = `
        <div class="spinner-border" style="width:3rem;height:3rem;color:#b06ef8"></div>
        <div style="color:rgba(255,255,255,.85);font-size:.9rem;font-family:'DM Sans',sans-serif">
          Loading product…
        </div>`;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  } else {
    if (overlay) { overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s'; setTimeout(() => overlay.remove(), 300); }
  }
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
const COLOR_HEX_MAP = {
  black: '#1a1a1a', white: '#f5f5f5', navy: '#1e3a5f', camel: '#c19a6b',
  olive: '#6b7c45', burgundy: '#800020', blush: '#f5b8b4', grey: '#708090',
  gray: '#708090', forest: '#2d5016', sand: '#d4a96a', cobalt: '#0047ab',
  ivory: '#fffff0', red: '#dc2626', blue: '#2563eb', green: '#16a34a',
  pink: '#ec4899', yellow: '#eab308', orange: '#f97316', purple: '#7c3aed',
  brown: '#92400e', beige: '#d4b896', khaki: '#c3b091', cream: '#fffdd0',
};
function colorHex(name) {
  return COLOR_HEX_MAP[(name || '').toLowerCase()] || '#9ca3af';
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
  t.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'x-circle-fill'}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}

/* ══════════════════════════════════════
   SIZE CHART — EXTRA FUNCTIONS
══════════════════════════════════════ */

const STD_SIZE_CHART = {
  'XS': { height: 157, weight: 47, chest: 80, waist: 62, hip: 86, neck: 34, shoulderWidth: 36, armLength: 58, legLength: 73 },
  'S': { height: 162, weight: 53, chest: 85, waist: 67, hip: 91, neck: 35, shoulderWidth: 38, armLength: 59, legLength: 75 },
  'M': { height: 167, weight: 61, chest: 90, waist: 72, hip: 96, neck: 36, shoulderWidth: 40, armLength: 60, legLength: 77 },
  'L': { height: 172, weight: 69, chest: 95, waist: 77, hip: 101, neck: 37, shoulderWidth: 42, armLength: 61, legLength: 79 },
  'XL': { height: 177, weight: 79, chest: 102, weight: 84, hip: 107, neck: 38, shoulderWidth: 44, armLength: 62, legLength: 81 },
  '2XL': { height: 180, weight: 90, chest: 109, waist: 92, hip: 115, neck: 40, shoulderWidth: 46, armLength: 63, legLength: 82 },
  '3XL': { height: 183, weight: 102, chest: 118, waist: 100, hip: 124, neck: 42, shoulderWidth: 48, armLength: 64, legLength: 83 },
  '4XL': { height: 185, weight: 116, chest: 127, waist: 110, hip: 133, neck: 44, shoulderWidth: 50, armLength: 65, legLength: 84 },
};

/* Auto-fill standard measurements into existing size rows */
function autoFillSizeChart() {
  const rows = document.querySelectorAll('#editSizeChartBody tr');
  if (!rows.length) {
    showToast('error', 'No sizes to fill — load product first');
    return;
  }

  const fields = ['height', 'weight', 'chest', 'waist', 'hip', 'neck', 'shoulderWidth', 'armLength', 'legLength'];
  let filled = 0;

  rows.forEach(row => {
    const size = row.querySelector('.sc-size-label')?.textContent?.trim();
    if (!size) return;
    const std = STD_SIZE_CHART[size];
    if (!std) return;
    const inputs = row.querySelectorAll('input');
    fields.forEach((f, i) => {
      if (inputs[i] && std[f] != null) inputs[i].value = std[f];
    });
    filled++;
  });

  if (filled > 0) showToast('success', `Auto-filled ${filled} size${filled > 1 ? 's' : ''}`);
  else showToast('error', 'No matching standard sizes found');
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