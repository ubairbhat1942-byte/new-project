// ─── API Helper for Mobile Klinic ──────────────────────────────────

const API = {
  BASE_URL: '',

  async request(url, options = {}) {
    try {
      const response = await fetch(`${this.BASE_URL}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw err;
    }
  },

  // For form data (file uploads)
  async upload(url, formData, method = 'POST') {
    try {
      const response = await fetch(`${this.BASE_URL}${url}`, {
        method,
        body: formData,
        // Don't set Content-Type - let browser set it with boundary
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server.');
      }
      throw err;
    }
  },

  // ─── Public API ────────────────────────────────────────────────

  getCategories() {
    return this.request('/api/categories');
  },

  getBrands() {
    return this.request('/api/brands');
  },

  getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/products${query ? '?' + query : ''}`);
  },

  getProduct(id) {
    return this.request(`/api/products/${id}`);
  },

  // ─── Customer Auth ─────────────────────────────────────────────

  customerLogin(phone, password) {
    return this.request('/api/customer/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
  },

  customerRegister(name, phone, password) {
    return this.request('/api/customer/register', {
      method: 'POST',
      body: JSON.stringify({ name, phone, password }),
    });
  },

  customerLogout() {
    return this.request('/api/customer/logout', { method: 'POST' });
  },

  getCustomerMe() {
    return this.request('/api/customer/me');
  },

  getCustomerRepairs() {
    return this.request('/api/customer/repairs');
  },

  // ─── Admin Auth ────────────────────────────────────────────────

  adminLogin(username, password) {
    return this.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  adminLogout() {
    return this.request('/api/admin/logout', { method: 'POST' });
  },

  getAdminMe() {
    return this.request('/api/admin/me');
  },

  // ─── Admin: Stats ──────────────────────────────────────────────

  getStats() {
    return this.request('/api/admin/stats');
  },

  // ─── Admin: Products ───────────────────────────────────────────

  getAdminProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/products${query ? '?' + query : ''}`);
  },

  createProduct(formData) {
    return this.upload('/api/admin/products', formData);
  },

  updateProduct(id, formData) {
    return this.upload(`/api/admin/products/${id}`, formData, 'PUT');
  },

  deleteProduct(id) {
    return this.request(`/api/admin/products/${id}`, { method: 'DELETE' });
  },

  // ─── Admin: Repairs ────────────────────────────────────────────

  getAdminRepairs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/repairs${query ? '?' + query : ''}`);
  },

  getRecentRepairs() {
    return this.request('/api/admin/repairs/recent');
  },

  createRepair(data) {
    return this.request('/api/admin/repairs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRepair(id, data) {
    return this.request(`/api/admin/repairs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteRepair(id) {
    return this.request(`/api/admin/repairs/${id}`, { method: 'DELETE' });
  },

  // ─── Admin: Customers ──────────────────────────────────────────

  getCustomers() {
    return this.request('/api/admin/customers');
  },
};

// ─── Toast Notifications ──────────────────────────────────────────

function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toasts
  const existing = document.querySelectorAll('.toast');
  existing.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${message}</span>
    <button class="toast__close" onclick="this.parentElement.remove()">&times;</button>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Utility Functions ────────────────────────────────────────────

function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getWhatsAppLink(phone, message) {
  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
}

function getStatusColor(status) {
  const colors = {
    'Received': 'info',
    'Diagnosing': 'warning',
    'Repairing': 'primary',
    'Testing': 'accent',
    'Ready': 'success',
    'Delivered': 'success',
  };
  return colors[status] || 'info';
}

function getStatusIndex(status) {
  const statuses = ['Received', 'Diagnosing', 'Repairing', 'Testing', 'Ready'];
  return statuses.indexOf(status);
}

// ─── Product Card HTML Generator ──────────────────────────────────

function createProductCard(product) {
  const imgSrc = product.image || generatePlaceholderImage(product.category_name || 'Product');

  return `
    <div class="card card--product animate-fadeIn" data-id="${product.id}">
      <div class="card__image-wrapper">
        <img class="card__image" src="${imgSrc}" alt="${product.name}" loading="lazy"
             onerror="this.src='${generatePlaceholderImage(product.category_name || 'Product')}'">
      </div>
      <div class="card__body">
        ${product.brand_name ? `<span class="badge badge--primary">${product.brand_name}</span>` : ''}
        <h3 class="card__title">${product.name}</h3>
        <p class="card__description">${product.description || ''}</p>
        <div class="card__footer">
          <span class="card__price">${formatPrice(product.price)}</span>
          <span class="badge ${product.stock > 0 ? 'badge--success' : 'badge--danger'}">
            ${product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
          </span>
        </div>
      </div>
    </div>
  `;
}

// Generate SVG placeholder for products without images
function generatePlaceholderImage(category) {
  const icons = {
    'Smartphones': '📱',
    'Earphones & Headphones': '🎧',
    'Smart Watches': '⌚',
    'Chargers & Cables': '🔌',
    'Cases & Screen Guards': '🛡️',
    'Power Banks': '🔋',
    'Speakers': '🔊',
    'Fans': '🌀',
    'Heaters': '🔥',
    'Other Gadgets': '⚡',
  };
  const icon = icons[category] || '📦';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="%231a2942"/>
    <text x="150" y="140" text-anchor="middle" font-size="64">${icon}</text>
    <text x="150" y="190" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8">${category}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ─── Repair Timeline HTML Generator ───────────────────────────────

function createRepairTimeline(currentStatus) {
  const steps = ['Received', 'Diagnosing', 'Repairing', 'Testing', 'Ready'];
  const currentIdx = getStatusIndex(currentStatus);
  const isDelivered = currentStatus === 'Delivered';

  return `
    <div class="timeline">
      ${steps.map((step, idx) => {
        let state = 'pending';
        if (isDelivered || idx < currentIdx) state = 'completed';
        else if (idx === currentIdx) state = 'active';

        return `
          <div class="timeline__step timeline__step--${state}">
            <div class="timeline__marker"></div>
            <div class="timeline__label">${step}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
