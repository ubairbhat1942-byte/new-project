// ─── Mobile Klinic — Admin Panel JavaScript ───────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const page = detectAdminPage();

  if (page === 'login') {
    initAdminLogin();
    return;
  }

  // Check admin auth for all other pages
  checkAdminAuth().then(isAuth => {
    if (!isAuth) {
      console.log("not authed"); window.location.replace("login.html");
      return;
    }

    initAdminSidebar();

    switch (page) {
      case 'dashboard':
        initDashboard();
        break;
      case 'products':
        initProducts();
        break;
      case 'repairs':
        initRepairs();
        break;
    }
  });
});

// ─── Detect Page ──────────────────────────────────────────────────

function detectAdminPage() {
  const path = window.location.pathname;
  if (path.endsWith('login.html') && path.includes('admin')) return 'login';
  if (path.endsWith('dashboard.html')) return 'dashboard';
  if (path.endsWith('products.html') && path.includes('admin')) return 'products';
  if (path.endsWith('repairs.html') && path.includes('admin')) return 'repairs';
  return 'unknown';
}

// ─── Admin Auth ───────────────────────────────────────────────────

async function checkAdminAuth() {
  try {
    const data = await API.getAdminMe();
    return data.loggedIn;
  } catch {
    return false;
  }
}

function initAdminLogin() {
  const form = document.querySelector('#admin-login-form, #login-form');
  const errorDiv = document.querySelector('#login-error, .alert--error');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorDiv) errorDiv.setAttribute('hidden', '');

    const username = form.querySelector('[name="username"], #admin-username').value.trim();
    const password = form.querySelector('[name="password"], #admin-password').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      await API.adminLogin(username, password);
      showToast('Welcome back, Towhead! 👋', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 500);
    } catch (err) {
      if (errorDiv) {
        errorDiv.textContent = err.message;
        errorDiv.removeAttribute('hidden');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────

function initAdminSidebar() {
  const toggle = document.querySelector('#sidebar-toggle, .sidebar__toggle');
  const sidebar = document.querySelector('.sidebar');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      sidebar.classList.toggle('open');
    });

    // Close sidebar on link click (mobile)
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
          sidebar.classList.remove('active', 'open');
        }
      });
    });
  }

  // Logout
  const logoutBtn = document.querySelector('#logout-btn, [data-action="admin-logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await API.adminLogout();
        console.log("not authed"); window.location.replace("login.html");
      } catch (err) {
        showToast('Logout failed', 'error');
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════

async function initDashboard() {
  await loadDashboardStats();
  await loadRecentRepairs();
}

async function loadDashboardStats() {
  try {
    const stats = await API.getStats();

    setStatValue('#stat-products, [data-stat="products"]', stats.totalProducts);
    setStatValue('#stat-active-repairs, [data-stat="active-repairs"]', stats.activeRepairs);
    setStatValue('#stat-completed, [data-stat="completed"]', stats.completedRepairs);
    setStatValue('#stat-customers, [data-stat="customers"]', stats.totalCustomers);
  } catch (err) {
    showToast('Failed to load stats: ' + err.message, 'error');
  }
}

function setStatValue(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;

  // Find the value element inside the stat card
  const valueEl = el.querySelector('.stat-card__value, .card__value, h2, .stat-value') || el;
  if (valueEl) {
    // Animate counter
    animateCounter(valueEl, 0, value, 800);
  }
}

function animateCounter(element, start, end, duration) {
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);

    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

async function loadRecentRepairs() {
  const table = document.querySelector('#recent-repairs');
  if (!table) return;

  try {
    const repairs = await API.getRecentRepairs();
    const tbody = table.querySelector('tbody') || table;

    if (repairs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center" style="padding: 2rem; color: var(--text-muted);">
            No repair orders yet
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = repairs.map(repair => `
      <tr>
        <td>
          <div>
            <strong>${repair.customer_name}</strong>
            <small style="display:block; color: var(--text-muted);">${repair.customer_phone}</small>
          </div>
        </td>
        <td>${repair.device_name}</td>
        <td><span class="badge badge--${getStatusColor(repair.status)}">${repair.status}</span></td>
        <td>${formatDate(repair.created_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load recent repairs', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PRODUCTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let productsState = {
  products: [],
  editingId: null,
};

async function initProducts() {
  bindProductFilters();
  bindProductModal();
  await loadAdminProducts();
}

function bindProductFilters() {
  const categorySelect = document.querySelector('#admin-filter-category, #filter-category');
  const brandSelect = document.querySelector('#admin-filter-brand, #filter-brand');
  const searchInput = document.querySelector('#admin-filter-search, #filter-search');

  if (categorySelect) {
    categorySelect.addEventListener('change', loadAdminProducts);
  }
  if (brandSelect) {
    brandSelect.addEventListener('change', loadAdminProducts);
  }
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(loadAdminProducts, 300);
    });
  }
}

async function loadAdminProducts() {
  const tbody = document.querySelector('#products-table tbody, #products-tbody');
  const emptyState = document.querySelector('#products-empty');

  if (!tbody) return;

  const params = {};
  const categorySelect = document.querySelector('#admin-filter-category, #filter-category');
  const brandSelect = document.querySelector('#admin-filter-brand, #filter-brand');
  const searchInput = document.querySelector('#admin-filter-search, #filter-search');

  if (categorySelect && categorySelect.value !== 'all') params.category = categorySelect.value;
  if (brandSelect && brandSelect.value !== 'all') params.brand = brandSelect.value;
  if (searchInput && searchInput.value) params.search = searchInput.value;

  try {
    const products = await API.getAdminProducts(params);
    productsState.products = products;

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding: 3rem; color: var(--text-muted);">
            <div class="empty-state">
              <span style="font-size: 3rem;">📦</span>
              <h3>No products yet</h3>
              <p>Add your first product to get started!</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(product => `
      <tr data-id="${product.id}">
        <td>
          <img src="${product.image || generatePlaceholderImage(product.category_name || 'Product')}"
               alt="${product.name}" style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;"
               onerror="this.src='${generatePlaceholderImage(product.category_name || 'Product')}'">
        </td>
        <td><strong>${product.name}</strong></td>
        <td>${product.brand_name || '—'}</td>
        <td>${product.category_name || '—'}</td>
        <td>${formatPrice(product.price)}</td>
        <td>
          <span class="badge ${product.stock > 0 ? 'badge--success' : 'badge--danger'}">
            ${product.stock}
          </span>
        </td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn--sm btn--outline" onclick="editProduct(${product.id})" title="Edit">
              ✏️
            </button>
            <button class="btn btn--sm btn--danger" onclick="confirmDeleteProduct(${product.id}, '${product.name.replace(/'/g, "\\'")}')" title="Delete">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

function bindProductModal() {
  // Add Product button
  const addBtn = document.querySelector('#add-product-btn, [data-action="add-product"]');
  if (addBtn) {
    addBtn.addEventListener('click', () => openProductModal());
  }

  // Modal close
  const modal = document.querySelector('#product-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.modal__close, [data-action="close-modal"]');
  const cancelBtn = modal.querySelector('#cancel-product, [data-action="cancel"]');

  if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeProductModal);

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-overlay')) {
      closeProductModal();
    }
  });

  // Form submission
  const form = modal.querySelector('#product-form, form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProduct(form);
    });
  }
}

function openProductModal(product = null) {
  const modal = document.querySelector('#product-modal');
  if (!modal) return;

  const title = modal.querySelector('.modal__title, h2, h3');
  const form = modal.querySelector('#product-form, form');

  if (product) {
    productsState.editingId = product.id;
    if (title) title.textContent = 'Edit Product';

    // Fill form
    setFormValue(form, 'name', product.name);
    setFormValue(form, 'category_id', product.category_id);
    setFormValue(form, 'brand_id', product.brand_id);
    setFormValue(form, 'price', product.price);
    setFormValue(form, 'stock', product.stock);
    setFormValue(form, 'description', product.description);

    const hiddenId = form.querySelector('#product-id, [name="product_id"]');
    if (hiddenId) hiddenId.value = product.id;
  } else {
    productsState.editingId = null;
    if (title) title.textContent = 'Add Product';
    if (form) form.reset();
  }

  modal.classList.add('modal--active', 'active');
  modal.removeAttribute('hidden');
  modal.style.display = 'flex';
}

function closeProductModal() {
  const modal = document.querySelector('#product-modal');
  if (modal) {
    modal.classList.remove('modal--active', 'active');
    modal.setAttribute('hidden', '');
    modal.style.display = 'none';
  }
  productsState.editingId = null;
}

function setFormValue(form, name, value) {
  const input = form.querySelector(`[name="${name}"], #product-${name}`);
  if (input) input.value = value || '';
}

async function saveProduct(form) {
  const formData = new FormData(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    if (productsState.editingId) {
      await API.updateProduct(productsState.editingId, formData);
      showToast('Product updated successfully!', 'success');
    } else {
      await API.createProduct(formData);
      showToast('Product added successfully!', 'success');
    }

    closeProductModal();
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function editProduct(id) {
  const product = productsState.products.find(p => p.id === id);
  if (product) {
    openProductModal(product);
  } else {
    try {
      const product = await API.getProduct(id);
      openProductModal(product);
    } catch (err) {
      showToast('Failed to load product', 'error');
    }
  }
}

function confirmDeleteProduct(id, name) {
  const deleteModal = document.querySelector('#delete-modal');

  if (deleteModal) {
    const message = deleteModal.querySelector('.delete-message, p');
    if (message) message.textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;

    const confirmBtn = deleteModal.querySelector('#confirm-delete, .btn--danger');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        try {
          await API.deleteProduct(id);
          showToast('Product deleted', 'success');
          closeDeleteModal();
          await loadAdminProducts();
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }

    const cancelBtn = deleteModal.querySelector('#cancel-delete, .btn--outline');
    if (cancelBtn) cancelBtn.onclick = closeDeleteModal;

    deleteModal.classList.add('modal--active', 'active');
    deleteModal.removeAttribute('hidden');
    deleteModal.style.display = 'flex';
  } else {
    // Fallback to native confirm
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      API.deleteProduct(id)
        .then(() => {
          showToast('Product deleted', 'success');
          loadAdminProducts();
        })
        .catch(err => showToast(err.message, 'error'));
    }
  }
}

function closeDeleteModal() {
  const modal = document.querySelector('#delete-modal');
  if (modal) {
    modal.classList.remove('modal--active', 'active');
    modal.setAttribute('hidden', '');
    modal.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════
//  REPAIRS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let repairsState = {
  repairs: [],
  editingId: null,
};

async function initRepairs() {
  bindRepairFilters();
  bindRepairModal();
  await loadAdminRepairs();
}

function bindRepairFilters() {
  const statusSelect = document.querySelector('#repair-filter-status, #filter-status');
  const searchInput = document.querySelector('#repair-filter-search, #filter-search');

  if (statusSelect) {
    statusSelect.addEventListener('change', loadAdminRepairs);
  }
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(loadAdminRepairs, 300);
    });
  }
}

async function loadAdminRepairs() {
  const container = document.querySelector('#repairs-list, #repairs-container');
  if (!container) return;

  const params = {};
  const statusSelect = document.querySelector('#repair-filter-status, #filter-status');
  const searchInput = document.querySelector('#repair-filter-search, #filter-search');

  if (statusSelect && statusSelect.value !== 'all') params.status = statusSelect.value;
  if (searchInput && searchInput.value) params.search = searchInput.value;

  try {
    const repairs = await API.getAdminRepairs(params);
    repairsState.repairs = repairs;

    if (repairs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔧</span>
          <h3>No repair orders</h3>
          <p>Create a new repair order when a customer brings in a device.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = repairs.map(repair => createAdminRepairCard(repair)).join('');
  } catch (err) {
    showToast('Failed to load repairs: ' + err.message, 'error');
  }
}

function createAdminRepairCard(repair) {
  const statusColor = getStatusColor(repair.status);
  const whatsappMsg = `Hello ${repair.customer_name}! 📱\n\nYour repair update from Mobile Klinic:\n\n📱 Device: ${repair.device_name}\n🔧 Status: ${repair.status}\n${repair.expected_date ? `📅 Expected: ${formatDate(repair.expected_date)}` : ''}\n${repair.notes ? `📝 Notes: ${repair.notes}` : ''}\n\nFor queries, call us at 7006330436.\n\n— Mobile Klinic, Kralgund Handwara`;

  return `
    <article class="card repair-card animate-fadeIn" data-id="${repair.id}">
      <div class="repair-card__header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0 0 0.25rem 0; color: var(--text-primary);">${repair.customer_name}</h3>
          <a href="tel:${repair.customer_phone}" style="color: var(--primary); text-decoration: none; font-size: 0.9rem;">
            📞 ${repair.customer_phone}
          </a>
        </div>
        <span class="badge badge--${statusColor}">${repair.status}</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div>
          <small style="color: var(--text-muted);">Device</small>
          <p style="margin: 0.25rem 0 0; font-weight: 500;">${repair.device_name}</p>
        </div>
        <div>
          <small style="color: var(--text-muted);">Issue</small>
          <p style="margin: 0.25rem 0 0;">${repair.issue}</p>
        </div>
        <div>
          <small style="color: var(--text-muted);">Expected</small>
          <p style="margin: 0.25rem 0 0;">${formatDate(repair.expected_date)}</p>
        </div>
        <div>
          <small style="color: var(--text-muted);">Cost</small>
          <p style="margin: 0.25rem 0 0; font-weight: 600; color: var(--accent);">${formatPrice(repair.estimated_cost)}</p>
        </div>
      </div>

      ${repair.notes ? `
        <div style="background: var(--surface); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
          <small style="color: var(--text-muted);">📝 Notes</small>
          <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">${repair.notes}</p>
        </div>
      ` : ''}

      <div class="flex flex-wrap gap-1" style="margin-top: auto;">
        <select class="form-input" style="flex: 1; min-width: 140px; padding: 0.5rem; font-size: 0.85rem;"
                onchange="quickUpdateStatus(${repair.id}, this.value)" title="Update Status">
          ${['Received', 'Diagnosing', 'Repairing', 'Testing', 'Ready', 'Delivered'].map(s =>
            `<option value="${s}" ${repair.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
        <button class="btn btn--sm btn--outline" onclick="editRepair(${repair.id})" title="Edit">✏️ Edit</button>
        <a class="btn btn--sm btn--whatsapp" href="${getWhatsAppLink(repair.customer_phone, whatsappMsg)}"
           target="_blank" title="Send WhatsApp Update" rel="noopener">
          💬 WhatsApp
        </a>
      </div>
    </article>
  `;
}

async function quickUpdateStatus(id, newStatus) {
  try {
    await API.updateRepair(id, { status: newStatus });
    showToast(`Status updated to "${newStatus}"`, 'success');
    await loadAdminRepairs();
  } catch (err) {
    showToast(err.message, 'error');
    await loadAdminRepairs(); // Reload to revert
  }
}

function bindRepairModal() {
  const addBtn = document.querySelector('#add-repair-btn, [data-action="add-repair"]');
  if (addBtn) {
    addBtn.addEventListener('click', () => openRepairModal());
  }

  const modal = document.querySelector('#repair-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.modal__close, [data-action="close-modal"]');
  const cancelBtn = modal.querySelector('#cancel-repair, [data-action="cancel"]');

  if (closeBtn) closeBtn.addEventListener('click', closeRepairModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeRepairModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-overlay')) {
      closeRepairModal();
    }
  });

  const form = modal.querySelector('#repair-form, form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveRepair(form);
    });
  }
}

function openRepairModal(repair = null) {
  const modal = document.querySelector('#repair-modal');
  if (!modal) return;

  const title = modal.querySelector('.modal__title, h2, h3');
  const form = modal.querySelector('#repair-form, form');

  if (repair) {
    repairsState.editingId = repair.id;
    if (title) title.textContent = 'Edit Repair Order';

    setRepairFormValue(form, 'customer_name', repair.customer_name);
    setRepairFormValue(form, 'customer_phone', repair.customer_phone);
    setRepairFormValue(form, 'device_name', repair.device_name);
    setRepairFormValue(form, 'issue', repair.issue);
    setRepairFormValue(form, 'estimated_cost', repair.estimated_cost);
    setRepairFormValue(form, 'expected_date', repair.expected_date);
    setRepairFormValue(form, 'status', repair.status);
    setRepairFormValue(form, 'notes', repair.notes);

    const hiddenId = form.querySelector('#repair-id, [name="repair_id"]');
    if (hiddenId) hiddenId.value = repair.id;
  } else {
    repairsState.editingId = null;
    if (title) title.textContent = 'New Repair Order';
    if (form) form.reset();

    // Set default expected date to 3 days from now
    const dateInput = form.querySelector('[name="expected_date"]');
    if (dateInput) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      dateInput.value = defaultDate.toISOString().split('T')[0];
    }
  }

  modal.classList.add('modal--active', 'active');
  modal.removeAttribute('hidden');
  modal.style.display = 'flex';
}

function closeRepairModal() {
  const modal = document.querySelector('#repair-modal');
  if (modal) {
    modal.classList.remove('modal--active', 'active');
    modal.setAttribute('hidden', '');
    modal.style.display = 'none';
  }
  repairsState.editingId = null;
}

function setRepairFormValue(form, name, value) {
  const input = form.querySelector(`[name="${name}"], #repair-${name}`);
  if (input) input.value = value || '';
}

async function saveRepair(form) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // Remove hidden repair_id if empty
  if (!data.repair_id) delete data.repair_id;

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    if (repairsState.editingId) {
      await API.updateRepair(repairsState.editingId, data);
      showToast('Repair order updated!', 'success');
    } else {
      await API.createRepair(data);
      showToast('Repair order created!', 'success');
    }

    closeRepairModal();
    await loadAdminRepairs();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function editRepair(id) {
  const repair = repairsState.repairs.find(r => r.id === id);
  if (repair) {
    openRepairModal(repair);
  }
}
