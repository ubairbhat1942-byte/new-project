const API = {
  BASE_URL: '',

  async request(url, options = {}) {
    try {
      const response = await fetch(`${this.BASE_URL}${url}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong');
      return data;
    } catch(err) {
      if (err.message === 'Failed to fetch') throw new Error('Cannot connect to server');
      throw err;
    }
  },

  async upload(url, formData, method = 'POST') {
    try {
      const response = await fetch(`${this.BASE_URL}${url}`, {
        method, body: formData, credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      return data;
    } catch(err) {
      if (err.message === 'Failed to fetch') throw new Error('Cannot connect to server');
      throw err;
    }
  },

  getCategories() { return this.request('/api/categories') },
  getBrands() { return this.request('/api/brands') },
  getProducts(params={}) { const q=new URLSearchParams(params).toString(); return this.request(`/api/products${q?'?'+q:''}`) },
  getProduct(id) { return this.request(`/api/products/${id}`) },
  customerLogin(phone,password) { return this.request('/api/customer/login',{method:'POST',body:JSON.stringify({phone,password})}) },
  customerRegister(name,phone,password) { return this.request('/api/customer/register',{method:'POST',body:JSON.stringify({name,phone,password})}) },
  customerLogout() { return this.request('/api/customer/logout',{method:'POST'}) },
  getCustomerMe() { return this.request('/api/customer/me') },
  getCustomerRepairs() { return this.request('/api/customer/repairs') },
  adminLogin(username,password) { return this.request('/api/admin/login',{method:'POST',body:JSON.stringify({username,password})}) },
  adminLogout() { return this.request('/api/admin/logout',{method:'POST'}) },
  getAdminMe() { return this.request('/api/admin/me') },
  getStats() { return this.request('/api/admin/stats') },
  getAdminProducts(params={}) { const q=new URLSearchParams(params).toString(); return this.request(`/api/admin/products${q?'?'+q:''}`) },
  createProduct(formData) { return this.upload('/api/admin/products',formData) },
  updateProduct(id,formData) { return this.upload(`/api/admin/products/${id}`,formData,'PUT') },
  deleteProduct(id) { return this.request(`/api/admin/products/${id}`,{method:'DELETE'}) },
  getAdminRepairs(params={}) { const q=new URLSearchParams(params).toString(); return this.request(`/api/admin/repairs${q?'?'+q:''}`) },
  getRecentRepairs() { return this.request('/api/admin/repairs/recent') },
  createRepair(data) { return this.request('/api/admin/repairs',{method:'POST',body:JSON.stringify(data)}) },
  updateRepair(id,data) { return this.request(`/api/admin/repairs/${id}`,{method:'PUT',body:JSON.stringify(data)}) },
  deleteRepair(id) { return this.request(`/api/admin/repairs/${id}`,{method:'DELETE'}) },
  getCustomers() { return this.request('/api/admin/customers') },
};

function showToast(message, type='info', duration=3000) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icons = {success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  toast.innerHTML = `<span>${icons[type]||icons.info}</span><span style="flex:1">${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.2rem">&times;</button>`;
  toast.style.cssText = 'position:fixed;bottom:1rem;right:1rem;background:var(--surface);border:1px solid var(--border);padding:1rem;border-radius:8px;display:flex;gap:0.5rem;align-items:center;z-index:9999;min-width:250px;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(), duration);
}

function formatPrice(price) { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(price) }
function formatDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) }
function getWhatsAppLink(phone,message) { const p=phone.replace(/\D/g,''); const fp=p.startsWith('91')?p:'91'+p; return `https://wa.me/${fp}?text=${encodeURIComponent(message)}` }
function getStatusColor(status) { return {Received:'info',Diagnosing:'warning',Repairing:'primary',Testing:'accent',Ready:'success',Delivered:'success'}[status]||'info' }
function generatePlaceholderImage(category) {
  const icons = {'Smartphones':'📱','Earphones & Headphones':'🎧','Smart Watches':'⌚','Chargers & Cables':'🔌','Cases & Screen Guards':'🛡️','Power Banks':'🔋','Speakers':'🔊','Fans':'🌀','Heaters':'🔥','Other Gadgets':'⚡'};
  const icon = icons[category]||'📦';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231a2942"/><text x="150" y="160" text-anchor="middle" font-size="80">${icon}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function createProductCard(product) {
  const imgSrc = product.image || generatePlaceholderImage(product.category_name||'Product');
  return `<div class="card card--product" data-id="${product.id}"><div class="card__image-wrapper"><img class="card__image" src="${imgSrc}" alt="${product.name}" loading="lazy" onerror="this.src='${generatePlaceholderImage(product.category_name||'Product')}'"></div><div class="card__body">${product.brand_name?`<span class="badge badge--primary">${product.brand_name}</span>`:''}<h3 class="card__title">${product.name}</h3><p class="card__description">${product.description||''}</p><div class="card__footer"><span class="card__price">${formatPrice(product.price)}</span><span class="badge ${product.stock>0?'badge--success':'badge--danger'}">${product.stock>0?`In Stock (${product.stock})`:'Out of Stock'}</span></div></div></div>`;
}
