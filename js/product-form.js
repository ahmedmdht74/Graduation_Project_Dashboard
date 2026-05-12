/* ═══════════════════════════════════════════════════
   FLEXORA — Add Product JS  (product-form.js)
   Real API: POST /api/Products/AddProduct (multipart)
   GET /api/Products/categories
   GET /api/Products/subcategories?categoryId=X
═══════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = 'https://fitverseapp.runasp.net/api';

function getToken() { return localStorage.getItem('flexora_token') || ''; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

/* ══════════════════════════════════════
   PRESET DATA
══════════════════════════════════════ */
const PRESET_COLORS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#f5f5f5' },
  { name: 'Navy', hex: '#1e3a5f' },
  { name: 'Camel', hex: '#c19a6b' },
  { name: 'Olive', hex: '#6b7c45' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Blush', hex: '#f5b8b4' },
  { name: 'Slate Grey', hex: '#708090' },
  { name: 'Forest', hex: '#2d5016' },
  { name: 'Sand', hex: '#d4a96a' },
  { name: 'Cobalt', hex: '#0047ab' },
  { name: 'Ivory', hex: '#fffff0' },
];

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

const STD_SIZE_CHART = {
  'XS': { height: '155-160', weight: '45-50', chest: '78-82', waist: '60-64', hip: '84-88', neck: '34', shoulderWidth: '36', armLength: '58', legLength: '73' },
  'S': { height: '160-165', weight: '50-57', chest: '83-87', waist: '65-69', hip: '89-93', neck: '35', shoulderWidth: '38', armLength: '59', legLength: '75' },
  'M': { height: '165-170', weight: '57-65', chest: '88-92', waist: '70-74', hip: '94-98', neck: '36', shoulderWidth: '40', armLength: '60', legLength: '77' },
  'L': { height: '170-175', weight: '65-74', chest: '93-98', waist: '75-80', hip: '99-104', neck: '37', shoulderWidth: '42', armLength: '61', legLength: '79' },
  'XL': { height: '175-180', weight: '74-84', chest: '99-105', waist: '81-87', hip: '105-111', neck: '38', shoulderWidth: '44', armLength: '62', legLength: '81' },
  '2XL': { height: '178-183', weight: '84-95', chest: '106-113', waist: '88-95', hip: '112-119', neck: '40', shoulderWidth: '46', armLength: '63', legLength: '82' },
  '3XL': { height: '180-185', weight: '95-108', chest: '114-122', waist: '96-104', hip: '120-128', neck: '42', shoulderWidth: '48', armLength: '64', legLength: '83' },
  '4XL': { height: '183-188', weight: '108-125', 'chest': '123-132', 'waist': '105-115', 'hip': '129-138', 'neck': '44', shoulderWidth: '50', armLength: '65', legLength: '84' },
};

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let selectedColors = [];   // [{ name, hex }]
let selectedSizes = [];   // ['S','M', …]
let generatedVariants = [];   // full variant objects
let tempIdCounter = 1;
let currentStep = 1;
let isSubmitting = false;

/* Files stored separately — not in variant objects (keeps data clean for FormData) */
const variantFiles = {};
/* variantFiles[tempId] = { mainImage: File|null, additionalImages: File[], vectorImage: File|null } */

/* ══════════════════════════════════════
   DOM READY
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  loadCategories();
  initColorPicker();
  initSizePicker();
  loadUserInfo();
});

/* ══════════════════════════════════════
   SIDEBAR & THEME (reused)
══════════════════════════════════════ */
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  toggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
  overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
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
   STEP 1: CATEGORIES (real API)
══════════════════════════════════════ */
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/Products/categories`, { headers: authHeader() });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json(); /* [{ id, name }] */

    const sel = document.getElementById('productCategory');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select category…</option>' +
      data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  } catch (err) {
    console.error('[Flexora] loadCategories:', err);
    showToast('error', 'Could not load categories');
  }
}

/* Called by onchange="updateSubcategories()" on the category select */
async function updateSubcategories() {
  const catId = document.getElementById('productCategory')?.value;
  const sel = document.getElementById('productSubCategory');
  if (!sel) return;

  if (!catId) {
    sel.innerHTML = '<option value="">Select sub-category…</option>';
    return;
  }

  sel.innerHTML = '<option value="">Loading…</option>';
  sel.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/Products/subcategories?categoryId=${catId}`, { headers: authHeader() });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json(); /* [{ id, name }] */

    sel.innerHTML = '<option value="">Select sub-category…</option>' +
      data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  } catch (err) {
    console.error('[Flexora] loadSubcategories:', err);
    sel.innerHTML = '<option value="">Failed to load</option>';
    showToast('error', 'Could not load sub-categories');
  } finally {
    sel.disabled = false;
  }
}

/* Stub for edit page compatibility */
function updateSubcategoriesEdit() { updateSubcategories(); }

/* ══════════════════════════════════════
   STEP WIZARD
══════════════════════════════════════ */
function goToStep(n) {
  if (n > currentStep) {
    if (!validateCurrentStep()) return;
  }
  if (n === 3 && !generatedVariants.length) {
    showToast('error', 'Generate variants first');
    return;
  }

  currentStep = n;

  document.querySelectorAll('.step-content').forEach(el => el.classList.add('d-none'));
  document.getElementById(`step${n}`)?.classList.remove('d-none');

  document.querySelectorAll('.step-item').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    const num = el.querySelector('.step-num');
    if (s === n) { el.classList.add('active'); num.textContent = s; }
    else if (s < n) { el.classList.add('completed'); num.innerHTML = '<i class="bi bi-check2" style="font-size:.8rem"></i>'; }
    else { num.textContent = s; }
  });

  if (n === 4) buildSizeChart('sizeChartBody', selectedSizes);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep() {
  if (currentStep === 1) return validateStep1();
  if (currentStep === 2) {
    if (!selectedColors.length) { showToast('error', 'Select at least one color'); return false; }
    if (!selectedSizes.length) { showToast('error', 'Select at least one size'); return false; }
  }
  return true;
}

function validateStep1() {
  const name = document.getElementById('productName')?.value.trim();
  const catId = document.getElementById('productCategory')?.value;
  if (!name) { showToast('error', 'Product name is required'); return false; }
  if (!catId) { showToast('error', 'Please select a category'); return false; }
  return true;
}

/* ══════════════════════════════════════
   STEP 2: COLOR PICKER
══════════════════════════════════════ */
function initColorPicker() {
  const container = document.getElementById('colorPicker');
  if (!container) return;

  container.innerHTML = PRESET_COLORS.map(c => `
    <div class="color-tag" data-name="${c.name}" data-hex="${c.hex}"
         onclick="toggleColor(this,'colorPicker')">
      <span class="color-dot" style="background:${c.hex}"></span>
      ${c.name}
      <i class="bi bi-check2 check-icon"></i>
    </div>`).join('') + `
    <button class="add-color-btn" type="button" onclick="event.stopPropagation()">
      <i class="bi bi-plus"></i> Custom
    </button>`;
}

function toggleColor(el, containerId) {
  const arr = containerId === 'colorPicker' ? selectedColors : (window._editColors || []);
  const name = el.dataset.name;
  const idx = arr.findIndex(c => c.name === name);

  if (idx > -1) { arr.splice(idx, 1); el.classList.remove('selected'); }
  else { arr.push({ name, hex: el.dataset.hex }); el.classList.add('selected'); }

  const countEl = document.getElementById(containerId === 'colorPicker' ? 'colorCount' : 'editColorCount');
  if (countEl) countEl.textContent = `${arr.length} selected`;

  updateVariantPreview(containerId);
}

function addCustomColor() {
  const name = document.getElementById('customColorName')?.value.trim();
  const hex = document.getElementById('customColorHex')?.value || '#888888';
  if (!name) { showToast('error', 'Enter a color name'); return; }
  if (selectedColors.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast('error', 'Color already added'); return;
  }

  selectedColors.push({ name, hex });

  const container = document.getElementById('colorPicker');
  const addBtn = container.querySelector('.add-color-btn');
  const tag = document.createElement('div');
  tag.className = 'color-tag selected';
  tag.dataset.name = name;
  tag.dataset.hex = hex;
  tag.onclick = () => toggleColor(tag, 'colorPicker');
  tag.innerHTML = `<span class="color-dot" style="background:${hex}"></span>${name}<i class="bi bi-check2 check-icon"></i>`;
  container.insertBefore(tag, addBtn);

  document.getElementById('customColorName').value = '';
  document.getElementById('colorCount').textContent = `${selectedColors.length} selected`;
  updateVariantPreview('colorPicker');
  showToast('success', `Color "${name}" added`);
}

/* ══════════════════════════════════════
   STEP 2: SIZE PICKER
══════════════════════════════════════ */
function initSizePicker() {
  const container = document.getElementById('sizePicker');
  if (!container) return;
  container.innerHTML = PRESET_SIZES.map(s => `
    <div class="size-tag" data-size="${s}" onclick="toggleSize(this,'sizePicker')">${s}</div>`
  ).join('');
}

function toggleSize(el, containerId) {
  const arr = containerId === 'sizePicker' ? selectedSizes : (window._editSizes || []);
  const size = el.dataset.size;
  const idx = arr.indexOf(size);

  if (idx > -1) { arr.splice(idx, 1); el.classList.remove('selected'); }
  else { arr.push(size); el.classList.add('selected'); }

  const countEl = document.getElementById(containerId === 'sizePicker' ? 'sizeCount' : 'editSizeCount');
  if (countEl) countEl.textContent = `${arr.length} selected`;

  updateVariantPreview(containerId);
}

function addCustomSize() {
  const val = document.getElementById('customSize')?.value.trim().toUpperCase();
  if (!val) return;
  if (selectedSizes.includes(val)) { showToast('error', 'Size already added'); return; }

  selectedSizes.push(val);
  const container = document.getElementById('sizePicker');
  const tag = document.createElement('div');
  tag.className = 'size-tag selected';
  tag.dataset.size = val;
  tag.textContent = val;
  tag.onclick = () => toggleSize(tag, 'sizePicker');
  container.appendChild(tag);

  document.getElementById('customSize').value = '';
  document.getElementById('sizeCount').textContent = `${selectedSizes.length} selected`;
  updateVariantPreview('sizePicker');
}

/* ── Variant Preview Chips ── */
function updateVariantPreview(sourceId) {
  const isEdit = sourceId?.includes('edit');
  const colors = isEdit ? (window._editColors || []) : selectedColors;
  const sizes = isEdit ? (window._editSizes || []) : selectedSizes;
  const chipsEl = document.getElementById(isEdit ? 'editVariantChips' : 'variantChips');
  const countEl = document.getElementById(isEdit ? 'editVariantPreviewCount' : 'variantPreviewCount');
  const btnCount = document.getElementById(isEdit ? 'editGenerateBtnCount' : 'generateBtnCount');

  const combos = [];
  colors.forEach(c => sizes.forEach(s => combos.push({ color: c, size: s })));

  if (countEl) countEl.textContent = combos.length;
  if (btnCount) btnCount.textContent = combos.length;

  if (!chipsEl) return;
  if (!combos.length) {
    chipsEl.innerHTML = `<span style="font-size:.82rem;color:var(--text-muted)">Select colors and sizes to preview…</span>`;
    return;
  }
  chipsEl.innerHTML = combos.map(({ color, size }) => `
    <div class="variant-chip">
      <span class="chip-color" style="background:${color.hex}"></span>
      ${color.name} / <span class="chip-size">${size}</span>
    </div>`).join('');
}

/* ══════════════════════════════════════
   STEP 2 → 3: GENERATE VARIANTS
══════════════════════════════════════ */
function generateVariants() {
  if (!selectedColors.length) { showToast('error', 'Select at least one color'); return; }
  if (!selectedSizes.length) { showToast('error', 'Select at least one size'); return; }

  generatedVariants = [];
  variantFiles; // reset handled per-key below

  selectedColors.forEach(color => {
    selectedSizes.forEach(size => {
      const tempId = tempIdCounter++;
      generatedVariants.push({ tempId, size, color, price: '', stock: '', modelUrl: '' });
      variantFiles[tempId] = { mainImage: null, additionalImages: [], vectorImage: null };
    });
  });

  document.getElementById('variantTableCount').textContent = `${generatedVariants.length} variants`;
  renderVariantTable('variantTableBody', generatedVariants);
  goToStep(3);
  showToast('success', `${generatedVariants.length} variants generated!`);
}

/* ══════════════════════════════════════
   STEP 3: VARIANT TABLE
══════════════════════════════════════ */
function renderVariantTable(tbodyId, variants) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = variants.map((v, i) => {
    const files = variantFiles[v.tempId] || { mainImage: null, additionalImages: [], vectorImage: null };
    const mainThumb = files.mainImage
      ? `<img src="${URL.createObjectURL(files.mainImage)}" class="img-thumb"/>`
      : `<i class="bi bi-camera"></i>`;
    const vecThumb = files.vectorImage
      ? `<img src="${URL.createObjectURL(files.vectorImage)}" class="img-thumb"/>`
      : `<i class="bi bi-vector-pen"></i>`;
    const extraThumbs = files.additionalImages.map(f =>
      `<img src="${URL.createObjectURL(f)}" class="extra-img-thumb"/>`
    ).join('');

    return `
    <tr id="vrow-${v.tempId}">
      <td style="color:var(--text-muted);font-size:.8rem">${i + 1}</td>
      <td>
        <div class="var-combo">
          <span class="var-color-swatch" style="background:${v.color.hex}"></span>
          <span>${v.color.name}</span>
          <span class="var-size-badge">${v.size}</span>
        </div>
      </td>
      <td>
        <input type="number" class="var-input price" placeholder="0.00" min="0" step="0.01"
               value="${v.price}"
               onchange="updateVariantField(${v.tempId},'price',this.value)"/>
      </td>
      <td>
        <input type="number" class="var-input stock" placeholder="0" min="0"
               value="${v.stock}"
               onchange="updateVariantField(${v.tempId},'stock',this.value)"/>
      </td>
      <td>
        <label class="img-upload-btn" title="Upload main image">
          ${mainThumb}
          <input type="file" accept="image/*" style="display:none"
                 onchange="handleMainImage(event,${v.tempId},'${tbodyId}')"/>
        </label>
      </td>
      <td>
        <div class="extra-imgs">
          ${extraThumbs}
          <label class="extra-img-add" title="Add images">
            <i class="bi bi-plus"></i>
            <input type="file" accept="image/*" multiple style="display:none"
                   onchange="handleExtraImages(event,${v.tempId},'${tbodyId}')"/>
          </label>
        </div>
      </td>
      <td>
        <input type="text" class="var-input model" placeholder="https://…"
               value="${v.modelUrl || ''}"
               onchange="updateVariantField(${v.tempId},'modelUrl',this.value)"/>
      </td>
      <td>
        <label class="img-upload-btn" title="Vector image">
          ${vecThumb}
          <input type="file" accept="image/*,.svg" style="display:none"
                 onchange="handleVectorImage(event,${v.tempId},'${tbodyId}')"/>
        </label>
      </td>
      <td>
        <button type="button" class="btn-danger btn-sm btn-icon" title="Remove"
                onclick="removeVariant(${v.tempId},'${tbodyId}')">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Variant field helpers ── */
function updateVariantField(tempId, field, value) {
  const v = generatedVariants.find(v => v.tempId === tempId);
  if (v) v[field] = value;
}

function removeVariant(tempId, tbodyId) {
  const idx = generatedVariants.findIndex(v => v.tempId === tempId);
  if (idx > -1) { generatedVariants.splice(idx, 1); delete variantFiles[tempId]; }
  renderVariantTable(tbodyId, generatedVariants);
  showToast('success', 'Variant removed');
}

/* ── File handlers — store actual File objects ── */
function handleMainImage(event, tempId, tbodyId) {
  const file = event.target.files[0];
  if (!file) return;
  variantFiles[tempId].mainImage = file;
  renderVariantTable(tbodyId, generatedVariants);
}

function handleVectorImage(event, tempId, tbodyId) {
  const file = event.target.files[0];
  if (!file) return;
  variantFiles[tempId].vectorImage = file;
  renderVariantTable(tbodyId, generatedVariants);
}

function handleExtraImages(event, tempId, tbodyId) {
  const files = Array.from(event.target.files);
  variantFiles[tempId].additionalImages.push(...files);
  renderVariantTable(tbodyId, generatedVariants);
}

/* ── Apply to All ── */
function applyToAll() {
  document.getElementById('applyAllStrip')?.classList.toggle('d-none');
}

function doApplyToAll() {
  const price = document.getElementById('applyPrice')?.value;
  const stock = document.getElementById('applyStock')?.value;
  generatedVariants.forEach(v => {
    if (price) v.price = price;
    if (stock) v.stock = stock;
  });
  const tbodyId = document.getElementById('variantTableBody') ? 'variantTableBody' : 'editVariantTableBody';
  renderVariantTable(tbodyId, generatedVariants);
  document.getElementById('applyAllStrip')?.classList.add('d-none');
  showToast('success', 'Applied to all variants');
}

/* ══════════════════════════════════════
   STEP 4: SIZE CHART
══════════════════════════════════════ */
function buildSizeChart(tbodyId, sizes) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const fields = ['height', 'weight', 'chest', 'waist', 'hip', 'neck', 'shoulderWidth', 'armLength', 'legLength'];

  tbody.innerHTML = sizes.map(size => {
    const std = STD_SIZE_CHART[size] || {};
    return `<tr>
      <td class="sc-size-label">${size}</td>
      ${fields.map(f => `
        <td><input type="text" class="sc-input" placeholder="—"
                   value="${std[f] || ''}"
                   data-size="${size}" data-field="${f}"/></td>
      `).join('')}
    </tr>`;
  }).join('');
}

function autoFillSizeChart() {
  const tbodyId = document.getElementById('sizeChartBody') ? 'sizeChartBody' : 'editSizeChartBody';
  buildSizeChart(tbodyId, selectedSizes);
  showToast('success', 'Standard measurements applied');
}

function collectSizeChart(tbodyId) {
  const fields = ['height', 'weight', 'chest', 'waist', 'hip', 'neck', 'shoulderWidth', 'armLength', 'legLength'];
  const data = [];
  document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
    const size = row.querySelector('.sc-size-label')?.textContent?.trim();
    if (!size) return;
    const inputs = row.querySelectorAll('input.sc-input');
    const entry = { size };
    fields.forEach((f, i) => { entry[f] = inputs[i]?.value || ''; });
    data.push(entry);
  });
  return data;
}





function rangeToAverage(value) {

  if (value === null || value === undefined || value === '')
    return 0;

  // لو رقم بالفعل
  if (!isNaN(value) && !String(value).includes('-'))
    return parseInt(value);

  // لو range زي 160-165
  if (String(value).includes('-')) {

    const parts = String(value)
      .split('-')
      .map(x => parseInt(x.trim()));

    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return Math.round((parts[0] + parts[1]) / 2);
    }
  }

  return parseInt(value) || 0;
}

function normalizeSizeCharts(sizeCharts) {

  return sizeCharts.map(sc => ({
    size: sc.size,

    height: rangeToAverage(sc.height),
    weight: rangeToAverage(sc.weight),

    chest: rangeToAverage(sc.chest),
    waist: rangeToAverage(sc.waist),
    hip: rangeToAverage(sc.hip),

    neck: rangeToAverage(sc.neck),
    shoulderWidth: rangeToAverage(sc.shoulderWidth),

    armLength: rangeToAverage(sc.armLength),
    legLength: rangeToAverage(sc.legLength)
  }));
}







/* ══════════════════════════════════════
   FINAL SUBMIT  →  POST multipart/form-data
══════════════════════════════════════ */
async function submitProduct() {
  if (isSubmitting) return;

  /* ── Validate ── */
  if (!validateStep1()) { goToStep(1); return; }
  if (!generatedVariants.length) { showToast('error', 'Generate at least one variant'); goToStep(2); return; }

  const unpriced = generatedVariants.find(v => !v.price || parseFloat(v.price) <= 0);
  if (unpriced) {
    showToast('error', `Set a price for all variants (${unpriced.color.name} / ${unpriced.size} is missing one)`);
    goToStep(3);
    return;
  }

  /* ── Build payload object ── */
  const variantsPayload = generatedVariants.map(v => ({
    tempId: v.tempId,
    size: v.size,
    color: v.color.name,
    price: parseFloat(v.price),
    stock: parseInt(v.stock) || 0,
    model3DUrl: v.modelUrl || '',
  }));

  // const sizeCharts = collectSizeChart('sizeChartBody');
  const rawSizeCharts = collectSizeChart('sizeChartBody');

  const sizeCharts = normalizeSizeCharts(rawSizeCharts);

  const productObj = {
    name: document.getElementById('productName').value.trim(),
    description: document.getElementById('productDesc').value.trim(),
    categoryId: parseInt(document.getElementById('productCategory').value),
    subCategoryId: parseInt(document.getElementById('productSubCategory').value) || null,
    variants: variantsPayload,
    sizeCharts: sizeCharts,
  };

  /* ── Build FormData ── */
  const formData = new FormData();
  formData.append('data', JSON.stringify(productObj));

  /* Append files per variant using tempId as key index */
  generatedVariants.forEach(v => {
    const files = variantFiles[v.tempId];
    if (!files) return;

    if (files.mainImage) {
      formData.append(`variantMainImage_${v.tempId}`, files.mainImage, files.mainImage.name);
    }
    files.additionalImages.forEach((f, i) => {
      formData.append(`variantAdditionalImages_${v.tempId}`, f, f.name);
    });
    if (files.vectorImage) {
      formData.append(`variantImageVector_${v.tempId}`, files.vectorImage, files.vectorImage.name);
    }
  });

  /* ── Submit ── */
  isSubmitting = true;
  setSubmitLoading(true);

  try {
    const res = await fetch(`${API_BASE}/Products/AddProduct`, {
      method: 'POST',
      headers: authHeader(),   // ← NO Content-Type; browser sets multipart boundary automatically
      body: formData,
    });

    if (res.status === 401) { showToast('error', 'Unauthorized — check your token'); return; }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Flexora] AddProduct error:', res.status, errText);
      showToast('error', `Failed to publish (${res.status}). Check console.`);
      return;
    }

    const result = await res.json().catch(() => ({}));
    console.log('[Flexora] Product created:', result);

    showToast('success', 'Product published successfully!');
    document.getElementById('saveBarStatus').textContent = 'Published ✓';

    setTimeout(() => window.location.href = 'products.html', 1600);

  } catch (err) {
    console.error('[Flexora] Network error:', err);
    showToast('error', 'Network error — check your connection');
  } finally {
    isSubmitting = false;
    setSubmitLoading(false);
  }
}

function setSubmitLoading(loading) {
  const btns = ['publishBtn', 'finalPublishBtn', 'saveDraftBtn', 'saveDraftBtn2'];
  btns.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (id.includes('Publish') || id === 'publishBtn' || id === 'finalPublishBtn') {
      btn.disabled = loading;
      btn.innerHTML = loading
        ? '<span class="spinner-border spinner-border-sm me-2"></span>Publishing…'
        : '<i class="bi bi-cloud-upload me-1"></i> Publish';
    }
  });
}

function saveDraft() {
  const status = document.getElementById('saveBarStatus');
  if (status) status.textContent = 'Draft saved locally';
  showToast('success', 'Draft saved');
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(type, msg) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast-item ${type}`;
  t.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'x-circle-fill'}"></i><span>${msg}</span>`;
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