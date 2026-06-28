const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const { initializeDatabase, queryAll, queryOne, runSql, saveDatabase } = require('./database');
const { requireAdmin, requireCustomer } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'mobileklinic-secret-key-2024-handwara',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
  }
}));

// Uploads directory
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC API ROUTES
// ═══════════════════════════════════════════════════════════════════

// ─── Categories ────────────────────────────────────────────────────

app.get('/api/categories', (req, res) => {
  try {
    const categories = queryAll('SELECT * FROM categories ORDER BY sort_order ASC');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Brands ────────────────────────────────────────────────────────

app.get('/api/brands', (req, res) => {
  try {
    const brands = queryAll('SELECT * FROM brands ORDER BY name ASC');
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Products (Public) ────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  try {
    const { category, brand, search, sort, limit, offset } = req.query;

    let sql = `
      SELECT p.*, b.name as brand_name, b.slug as brand_slug,
             c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND c.slug = ?';
      params.push(category);
    }

    if (brand && brand !== 'all') {
      sql += ' AND b.slug = ?';
      params.push(brand);
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR b.name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    if (sort === 'price-low') {
      sql += ' ORDER BY p.price ASC';
    } else if (sort === 'price-high') {
      sql += ' ORDER BY p.price DESC';
    } else if (sort === 'newest') {
      sql += ' ORDER BY p.created_at DESC';
    } else {
      sql += ' ORDER BY c.sort_order ASC, p.name ASC';
    }

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
      if (offset) {
        sql += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }

    const products = queryAll(sql, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = queryOne(`
      SELECT p.*, b.name as brand_name, c.name as category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Customer Auth ─────────────────────────────────────────────────

app.post('/api/customer/register', (req, res) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone, and password are required' });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
    }

    // Check if phone already exists
    const existing = queryOne('SELECT id FROM customers WHERE phone = ?', [phone]);
    if (existing) {
      return res.status(400).json({ error: 'This phone number is already registered' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = runSql(
      'INSERT INTO customers (name, phone, password_hash) VALUES (?, ?, ?)',
      [name, phone, hash]
    );

    req.session.customer = {
      id: result.lastInsertRowid,
      name,
      phone
    };

    res.json({ success: true, customer: { id: result.lastInsertRowid, name, phone } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/login', (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const customer = queryOne('SELECT * FROM customers WHERE phone = ?', [phone]);
    if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    req.session.customer = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone
    };

    res.json({ success: true, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customer/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/customer/me', (req, res) => {
  if (req.session && req.session.customer) {
    res.json({ loggedIn: true, customer: req.session.customer });
  } else {
    res.json({ loggedIn: false });
  }
});

// ─── Customer Repairs ──────────────────────────────────────────────

app.get('/api/customer/repairs', requireCustomer, (req, res) => {
  try {
    const repairs = queryAll(
      'SELECT * FROM repairs WHERE customer_phone = ? ORDER BY created_at DESC',
      [req.session.customer.phone]
    );
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  ADMIN API ROUTES
// ═══════════════════════════════════════════════════════════════════

// ─── Admin Auth ────────────────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = queryOne('SELECT * FROM admin WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.admin = {
      id: admin.id,
      username: admin.username,
      displayName: admin.display_name
    };

    res.json({ success: true, admin: { id: admin.id, username: admin.username, displayName: admin.display_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => {
  if (req.session && req.session.admin) {
    res.json({ loggedIn: true, admin: req.session.admin });
  } else {
    res.json({ loggedIn: false });
  }
});

// ─── Admin: Dashboard Stats ───────────────────────────────────────

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalProducts = queryOne('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
    const activeRepairs = queryOne("SELECT COUNT(*) as count FROM repairs WHERE status NOT IN ('Ready', 'Delivered')");
    const completedRepairs = queryOne("SELECT COUNT(*) as count FROM repairs WHERE status IN ('Ready', 'Delivered')");
    const totalCustomers = queryOne('SELECT COUNT(*) as count FROM customers');

    res.json({
      totalProducts: totalProducts.count,
      activeRepairs: activeRepairs.count,
      completedRepairs: completedRepairs.count,
      totalCustomers: totalCustomers.count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Products CRUD ─────────────────────────────────────────

app.get('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const { category, brand, search } = req.query;
    let sql = `
      SELECT p.*, b.name as brand_name, b.slug as brand_slug,
             c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND c.slug = ?';
      params.push(category);
    }
    if (brand && brand !== 'all') {
      sql += ' AND b.slug = ?';
      params.push(brand);
    }
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.created_at DESC';

    const products = queryAll(sql, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/products', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, brand_id, category_id, price, stock, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    if (!name || !price) {
      return res.status(400).json({ error: 'Product name and price are required' });
    }

    const result = runSql(
      `INSERT INTO products (name, brand_id, category_id, price, stock, description, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, brand_id || null, category_id || null, parseFloat(price), parseInt(stock) || 0, description || '', image]
    );

    const product = queryOne('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const { name, brand_id, category_id, price, stock, description } = req.body;
    const productId = req.params.id;

    const existing = queryOne('SELECT * FROM products WHERE id = ?', [productId]);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let image = existing.image;
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
      // Delete old image if exists
      if (existing.image) {
        const oldPath = path.join(__dirname, 'public', existing.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    runSql(
      `UPDATE products SET name = ?, brand_id = ?, category_id = ?, price = ?, stock = ?,
       description = ?, image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, brand_id || null, category_id || null, parseFloat(price), parseInt(stock) || 0,
       description || '', image, productId]
    );

    const product = queryOne(`
      SELECT p.*, b.name as brand_name, c.name as category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [productId]);

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const product = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete image file
    if (product.image) {
      const imgPath = path.join(__dirname, 'public', product.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    runSql('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Repairs CRUD ──────────────────────────────────────────

app.get('/api/admin/repairs', requireAdmin, (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM repairs WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR device_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const repairs = queryAll(sql, params);
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/repairs', requireAdmin, (req, res) => {
  try {
    const { customer_name, customer_phone, device_name, issue, estimated_cost, expected_date, status, notes } = req.body;

    if (!customer_name || !customer_phone || !device_name || !issue) {
      return res.status(400).json({ error: 'Customer name, phone, device, and issue are required' });
    }

    const result = runSql(
      `INSERT INTO repairs (customer_name, customer_phone, device_name, issue, estimated_cost, expected_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_name, customer_phone, device_name, issue,
       parseFloat(estimated_cost) || 0, expected_date || null, status || 'Received', notes || '']
    );

    const repair = queryOne('SELECT * FROM repairs WHERE id = ?', [result.lastInsertRowid]);
    res.json({ success: true, repair });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/repairs/:id', requireAdmin, (req, res) => {
  try {
    const { customer_name, customer_phone, device_name, issue, estimated_cost, expected_date, status, notes } = req.body;
    const repairId = req.params.id;

    const existing = queryOne('SELECT * FROM repairs WHERE id = ?', [repairId]);
    if (!existing) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    runSql(
      `UPDATE repairs SET customer_name = ?, customer_phone = ?, device_name = ?, issue = ?,
       estimated_cost = ?, expected_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [customer_name || existing.customer_name, customer_phone || existing.customer_phone,
       device_name || existing.device_name, issue || existing.issue,
       parseFloat(estimated_cost) || existing.estimated_cost,
       expected_date || existing.expected_date, status || existing.status,
       notes !== undefined ? notes : existing.notes, repairId]
    );

    const repair = queryOne('SELECT * FROM repairs WHERE id = ?', [repairId]);
    res.json({ success: true, repair });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/repairs/:id', requireAdmin, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Repair order not found' });
    }

    runSql('DELETE FROM repairs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Customers ─────────────────────────────────────────────

app.get('/api/admin/customers', requireAdmin, (req, res) => {
  try {
    const customers = queryAll(
      'SELECT id, name, phone, created_at FROM customers ORDER BY created_at DESC'
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Recent Repairs ────────────────────────────────────────

app.get('/api/admin/repairs/recent', requireAdmin, (req, res) => {
  try {
    const repairs = queryAll(
      'SELECT * FROM repairs ORDER BY created_at DESC LIMIT 5'
    );
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    await initializeDatabase();
    console.log('📦 Database initialized');

    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║           📱 MOBILE KLINIC SERVER               ║');
      console.log('║    Kralgund, Handwara | Owner: Towhead Bhat      ║');
      console.log('╠══════════════════════════════════════════════════╣');
      console.log(` Website: http://localhost:${PORT}`);
      console.log(` Admin:   http://localhost:${PORT}/admin/`);
      console.log('║  👤 Admin Login: towhead / mobile@klinic123      ║');
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
