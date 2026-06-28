// ─── Mobile Klinic — Customer Side JavaScript ─────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  checkAuth();

  // Page-specific initialization
  const page = detectPage();
  switch (page) {
    case 'home':
      initHomePage();
      break;
    case 'shop':
      initShopPage();
      break;
    case 'login':
      initLoginPage();
      break;
    case 'repair-status':
      initRepairPage();
      break;
  }
});

// ─── Detect Current Page ──────────────────────────────────────────

function detectPage() {
  const path = window.location.pathname;
  if (path === '/' || path.endsWith('index.html')) return 'home';
  if (path.endsWith('shop.html')) return 'shop';
  if (path.endsWith('login.html') && !path.includes('admin')) return 'login';
  if (path.endsWith('repair-status.html')) return 'repair-status';
  return 'unknown';
}

// ─── Navbar ───────────────────────────────────────────────────────

function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('active');
      menu.classList.toggle('open');
      toggle.classList.toggle('active');
      toggle.setAttribute('aria-expanded',
        toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'
      );
    });

    // Close menu when clicking a link
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('active', 'open');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      navbar.classList.toggle('navbar--scrolled', window.scrollY > 50);
    }
  });
}

// ─── Auth Check ───────────────────────────────────────────────────

async function checkAuth() {
  try {
    const data = await API.getCustomerMe();
    const authBtn = document.getElementById('nav-auth-btn');

    if (data.loggedIn) {
      if (authBtn) {
        authBtn.textContent = `👤 ${data.customer.name}`;
        authBtn.href = '#';
        authBtn.classList.remove('btn--primary');
        authBtn.classList.add('btn--outline');
        authBtn.addEventListener('click', (e) => {
          e.preventDefault();
          handleLogout();
        });
      }
      window.currentCustomer = data.customer;
    } else {
      window.currentCustomer = null;
    }
  } catch (err) {
    console.log('Auth check:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  HOME PAGE
// ═══════════════════════════════════════════════════════════════════

function initHomePage() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fadeIn');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.card, .section__heading').forEach(el => {
    observer.observe(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  SHOP PAGE
// ═══════════════════════════════════════════════════════════════════

let shopState = {
  products: [],
  category: 'all',
  brand: 'all',
  search: '',
  sort: 'default',
};

async function initShopPage() {
  // Parse URL params for initial filters
  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) shopState.category = params.get('category');
  if (params.get('brand')) shopState.brand = params.get('brand');

  // Set initial filter values
  const categorySelect = document.getElementById('category-filter');
  const brandSelect = document.getElementById('brand-filter');

  if (categorySelect && shopState.category !== 'all') {
    categorySelect.value = shopState.category;
  }
  if (brandSelect && shopState.brand !== 'all') {
    brandSelect.value = shopState.brand;
  }

  // Set active chip
  updateChips(shopState.category);

  // Bind filter events
  bindShopFilters();

  // Load products
  await loadProducts();
}

function bindShopFilters() {
  // Category dropdown
  const categorySelect = document.getElementById('category-filter');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      shopState.category = e.target.value || 'all';
      updateChips(shopState.category);
      loadProducts();
    });
  }

  // Brand dropdown
  const brandSelect = document.getElementById('brand-filter');
  if (brandSelect) {
    brandSelect.addEventListener('change', (e) => {
      shopState.brand = e.target.value || 'all';
      loadProducts();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('sort-filter');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      shopState.sort = e.target.value || 'default';
      loadProducts();
    });
  }

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        shopState.search = e.target.value;
        loadProducts();
      }, 300);
    });
  }

  // Category chips
  document.querySelectorAll('#category-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.category || 'all';
      shopState.category = cat;
      updateChips(cat);

      // Sync dropdown
      const categorySelect = document.getElementById('category-filter');
      if (categorySelect) categorySelect.value = cat;

      loadProducts();
    });
  });
}

function updateChips(category) {
  document.querySelectorAll('#category-chips .chip').forEach(c => {
    const chipCat = c.dataset.category || 'all';
    c.classList.toggle('chip--active', chipCat === category);
    c.setAttribute('aria-selected', chipCat === category ? 'true' : 'false');
  });
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  const emptyState = document.getElementById('products-empty');
  const loading = document.getElementById('products-loading');

  if (!grid) return;

  // Show loading
  if (loading) loading.removeAttribute('hidden');
  if (emptyState) emptyState.setAttribute('hidden', '');
  grid.innerHTML = '';

  try {
    const params = {};
    if (shopState.category !== 'all') params.category = shopState.category;
    if (shopState.brand !== 'all') params.brand = shopState.brand;
    if (shopState.search) params.search = shopState.search;
    if (shopState.sort !== 'default') params.sort = shopState.sort;

    const products = await API.getProducts(params);
    shopState.products = products;

    if (loading) loading.setAttribute('hidden', '');

    if (products.length === 0) {
      if (emptyState) {
        emptyState.removeAttribute('hidden');
      }
      return;
    }

    grid.innerHTML = products.map(product => createProductCard(product)).join('');

  } catch (err) {
    if (loading) loading.setAttribute('hidden', '');
    grid.innerHTML = `
      <div class="alert alert--error" style="grid-column: 1 / -1;">
        <p>Failed to load products: ${err.message}</p>
        <button class="btn btn--sm btn--primary" onclick="loadProducts()">Retry</button>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ═══════════════════════════════════════════════════════════════════

function initLoginPage() {
  // Tab switching
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');

  if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('auth-tabs__tab--active');
      loginTab.setAttribute('aria-selected', 'true');
      registerTab.classList.remove('auth-tabs__tab--active');
      registerTab.setAttribute('aria-selected', 'false');

      if (loginPanel) loginPanel.removeAttribute('hidden');
      if (registerPanel) registerPanel.setAttribute('hidden', '');
    });

    registerTab.addEventListener('click', () => {
      registerTab.classList.add('auth-tabs__tab--active');
      registerTab.setAttribute('aria-selected', 'true');
      loginTab.classList.remove('auth-tabs__tab--active');
      loginTab.setAttribute('aria-selected', 'false');

      if (registerPanel) registerPanel.removeAttribute('hidden');
      if (loginPanel) loginPanel.setAttribute('hidden', '');
    });
  }

  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('login-error');
      if (errorDiv) errorDiv.setAttribute('hidden', '');

      const phone = document.getElementById('login-phone').value.trim();
      const password = document.getElementById('login-password').value;

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      try {
        await API.customerLogin(phone, password);
        showToast('Login successful!', 'success');
        const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/';
        setTimeout(() => window.location.href = redirectTo, 500);
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

  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('register-error');
      if (errorDiv) errorDiv.setAttribute('hidden', '');

      const name = document.getElementById('register-name').value.trim();
      const phone = document.getElementById('register-phone').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;

      if (password !== confirmPassword) {
        if (errorDiv) {
          errorDiv.textContent = 'Passwords do not match';
          errorDiv.removeAttribute('hidden');
        }
        return;
      }

      if (password.length < 6) {
        if (errorDiv) {
          errorDiv.textContent = 'Password must be at least 6 characters';
          errorDiv.removeAttribute('hidden');
        }
        return;
      }

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        await API.customerRegister(name, phone, password);
        showToast('Account created successfully!', 'success');
        setTimeout(() => window.location.href = '/', 500);
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
}

// ═══════════════════════════════════════════════════════════════════
//  REPAIR STATUS PAGE
// ═══════════════════════════════════════════════════════════════════

async function initRepairPage() {
  const loginPrompt = document.getElementById('login-prompt');
  const repairsSection = document.getElementById('repairs-section');
  const repairsContainer = document.getElementById('repairs-container');
  const emptyState = document.getElementById('repairs-empty');
  const loadingState = document.getElementById('repairs-loading');

  try {
    const authData = await API.getCustomerMe();

    if (!authData.loggedIn) {
      if (loginPrompt) loginPrompt.removeAttribute('hidden');
      if (repairsSection) repairsSection.setAttribute('hidden', '');
      return;
    }

    // Hide login prompt, show repairs section
    if (loginPrompt) loginPrompt.setAttribute('hidden', '');
    if (repairsSection) repairsSection.removeAttribute('hidden');
    if (loadingState) loadingState.removeAttribute('hidden');

    const repairs = await API.getCustomerRepairs();
    if (loadingState) loadingState.setAttribute('hidden', '');

    if (repairs.length === 0) {
      if (emptyState) emptyState.removeAttribute('hidden');
      return;
    }
    if (emptyState) emptyState.setAttribute('hidden', '');

    repairsContainer.innerHTML = repairs.map(repair => createRepairCard(repair)).join('');

  } catch (err) {
    if (loadingState) loadingState.setAttribute('hidden', '');
    // If auth check fails, show login prompt
    if (loginPrompt) loginPrompt.removeAttribute('hidden');
    if (repairsSection) repairsSection.setAttribute('hidden', '');
  }
}

function createRepairCard(repair) {
  const statusColor = getStatusColor(repair.status);

  return `
    <article class="card repair-card animate-fadeIn" style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0 0 0.25rem 0; color: var(--text-primary, #f1f5f9); font-family: 'Outfit', sans-serif;">${repair.device_name}</h3>
          <p style="margin: 0; color: var(--text-secondary, #94a3b8); font-size: 0.9rem;">${repair.issue}</p>
        </div>
        <span class="badge badge--${statusColor}">${repair.status}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <small style="color: var(--text-muted, #64748b);">📅 Submitted</small>
          <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">${formatDate(repair.created_at)}</p>
        </div>
        <div>
          <small style="color: var(--text-muted, #64748b);">📆 Expected</small>
          <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">${formatDate(repair.expected_date)}</p>
        </div>
        <div>
          <small style="color: var(--text-muted, #64748b);">💰 Cost</small>
          <p style="margin: 0.25rem 0 0; font-weight: 600; color: var(--accent, #f97316);">${formatPrice(repair.estimated_cost)}</p>
        </div>
      </div>

      ${createRepairTimeline(repair.status)}

      ${repair.notes ? `
        <div style="background: var(--surface, #1a2942); padding: 0.75rem 1rem; border-radius: 8px; margin-top: 1rem;">
          <strong style="font-size: 0.85rem;">📝 Shop Notes:</strong>
          <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--text-secondary, #94a3b8);">${repair.notes}</p>
        </div>
      ` : ''}
    </article>
  `;
}

// ─── Logout Handler ───────────────────────────────────────────────

async function handleLogout() {
  try {
    await API.customerLogout();
    showToast('Logged out successfully', 'info');
    window.location.href = '/';
  } catch (err) {
    showToast('Logout failed', 'error');
  }
}
