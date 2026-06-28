const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'mobileklinic.db');
let db = null;

// Save database to disk
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save every 30 seconds
let saveInterval = null;

async function initializeDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('📂 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('🆕 Created new database');
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // ─── Create Tables ───────────────────────────────────────────────

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '📦',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      category_type TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand_id INTEGER,
      category_id INTEGER,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      device_name TEXT NOT NULL,
      issue TEXT NOT NULL,
      status TEXT DEFAULT 'Received',
      estimated_cost REAL DEFAULT 0,
      expected_date TEXT,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Seed Categories ─────────────────────────────────────────────

  const catResult = db.exec('SELECT COUNT(*) as count FROM categories');
  const categoryCount = catResult[0].values[0][0];

  if (categoryCount === 0) {
    const categories = [
      ['Smartphones', 'smartphones', '📱', 1],
      ['Earphones & Headphones', 'earphones', '🎧', 2],
      ['Smart Watches', 'smart-watches', '⌚', 3],
      ['Chargers & Cables', 'chargers', '🔌', 4],
      ['Cases & Screen Guards', 'cases', '🛡️', 5],
      ['Power Banks', 'power-banks', '🔋', 6],
      ['Speakers', 'speakers', '🔊', 7],
      ['Fans', 'fans', '🌀', 8],
      ['Heaters', 'heaters', '🔥', 9],
      ['Other Gadgets', 'other', '⚡', 10],
    ];

    for (const [name, slug, icon, order] of categories) {
      db.run(
        'INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)',
        [name, slug, icon, order]
      );
    }
    console.log('✅ Seeded categories');
  }

  // ─── Seed Brands ─────────────────────────────────────────────────

  const brandResult = db.exec('SELECT COUNT(*) as count FROM brands');
  const brandCount = brandResult[0].values[0][0];

  if (brandCount === 0) {
    const brands = [
      ['Samsung', 'samsung', 'phones'],
      ['Xiaomi', 'xiaomi', 'phones'],
      ['Redmi', 'redmi', 'phones'],
      ['Realme', 'realme', 'phones'],
      ['Oppo', 'oppo', 'phones'],
      ['Vivo', 'vivo', 'phones'],
      ['OnePlus', 'oneplus', 'phones'],
      ['Apple', 'apple', 'phones'],
      ['Nothing', 'nothing', 'phones'],
      ['Motorola', 'motorola', 'phones'],
      ['Nokia', 'nokia', 'phones'],
      ['iQOO', 'iqoo', 'phones'],
      ['Poco', 'poco', 'phones'],
      ['Tecno', 'tecno', 'phones'],
      ['Infinix', 'infinix', 'phones'],
      ['Lava', 'lava', 'phones'],
      ['Micromax', 'micromax', 'phones'],
      ['boAt', 'boat', 'audio'],
      ['Noise', 'noise', 'audio'],
      ['Fire-Boltt', 'fire-boltt', 'audio'],
      ['JBL', 'jbl', 'audio'],
      ['Sony', 'sony', 'audio'],
      ['Zebronics', 'zebronics', 'audio'],
      ['Ambrane', 'ambrane', 'accessories'],
      ['Portronics', 'portronics', 'accessories'],
      ['pTron', 'ptron', 'accessories'],
      ['Syska', 'syska', 'accessories'],
      ['Anker', 'anker', 'accessories'],
      ['URB', 'urb', 'accessories'],
      ['Crompton', 'crompton', 'electrical'],
      ['Havells', 'havells', 'electrical'],
      ['Bajaj', 'bajaj', 'electrical'],
      ['Orient', 'orient', 'electrical'],
      ['Usha', 'usha', 'electrical'],
      ['Maharaja Whiteline', 'maharaja-whiteline', 'electrical'],
      ['Orpat', 'orpat', 'electrical'],
      ['Singer', 'singer', 'electrical'],
    ];

    for (const [name, slug, catType] of brands) {
      db.run(
        'INSERT INTO brands (name, slug, category_type) VALUES (?, ?, ?)',
        [name, slug, catType]
      );
    }
    console.log('✅ Seeded brands');
  }

  // ─── Seed Admin ──────────────────────────────────────────────────

  const adminResult = db.exec('SELECT COUNT(*) as count FROM admin');
  const adminCount = adminResult[0].values[0][0];

  if (adminCount === 0) {
    const hash = bcrypt.hashSync('mobile@klinic123', 10);
    db.run(
      'INSERT INTO admin (username, password_hash, display_name) VALUES (?, ?, ?)',
      ['towhead', hash, 'Towhead Bhat']
    );
    console.log('✅ Seeded admin user (towhead / mobile@klinic123)');
  }

  // ─── Seed Sample Products ────────────────────────────────────────

  const prodResult = db.exec('SELECT COUNT(*) as count FROM products');
  const productCount = prodResult[0].values[0][0];

  if (productCount === 0) {
    const getBrandId = (slug) => {
      const r = db.exec('SELECT id FROM brands WHERE slug = ?', [slug]);
      return r.length > 0 ? r[0].values[0][0] : null;
    };
    const getCatId = (slug) => {
      const r = db.exec('SELECT id FROM categories WHERE slug = ?', [slug]);
      return r.length > 0 ? r[0].values[0][0] : null;
    };

    const sampleProducts = [
      { name: 'Samsung Galaxy M34 5G', brand: 'samsung', cat: 'smartphones', price: 16999, stock: 5, desc: '6GB RAM, 128GB Storage, 6000mAh Battery, 50MP Camera' },
      { name: 'Samsung Galaxy A15', brand: 'samsung', cat: 'smartphones', price: 12499, stock: 8, desc: '6GB RAM, 128GB, Super AMOLED Display, 50MP Camera' },
      { name: 'Redmi Note 13 Pro', brand: 'redmi', cat: 'smartphones', price: 19999, stock: 6, desc: '8GB RAM, 128GB, 200MP Camera, AMOLED 120Hz' },
      { name: 'Redmi 13C', brand: 'redmi', cat: 'smartphones', price: 8999, stock: 10, desc: '4GB RAM, 128GB, 50MP AI Camera, 5000mAh' },
      { name: 'Realme Narzo 60', brand: 'realme', cat: 'smartphones', price: 14999, stock: 4, desc: '8GB RAM, 128GB, 64MP Camera, 33W Fast Charge' },
      { name: 'Realme C55', brand: 'realme', cat: 'smartphones', price: 10499, stock: 7, desc: '6GB RAM, 64GB, 64MP Camera, Mini Capsule' },
      { name: 'Oppo A78 5G', brand: 'oppo', cat: 'smartphones', price: 17999, stock: 3, desc: '8GB RAM, 128GB, 5000mAh, 33W SUPERVOOC' },
      { name: 'Vivo T2x 5G', brand: 'vivo', cat: 'smartphones', price: 12999, stock: 6, desc: '6GB RAM, 128GB, 50MP Camera, 6000mAh' },
      { name: 'OnePlus Nord CE 3 Lite', brand: 'oneplus', cat: 'smartphones', price: 17999, stock: 4, desc: '8GB RAM, 128GB, 108MP Camera, 67W SUPERVOOC' },
      { name: 'Poco M6 Pro', brand: 'poco', cat: 'smartphones', price: 10999, stock: 9, desc: '6GB RAM, 128GB, 64MP Camera, AMOLED Display' },
      { name: 'Nokia G42 5G', brand: 'nokia', cat: 'smartphones', price: 13999, stock: 3, desc: '6GB RAM, 128GB, QuickFix Design, 3-day Battery' },
      { name: 'Tecno Spark 20 Pro', brand: 'tecno', cat: 'smartphones', price: 11999, stock: 5, desc: '8GB RAM, 256GB, 108MP Camera, 33W Charging' },
      { name: 'iQOO Z7 5G', brand: 'iqoo', cat: 'smartphones', price: 14999, stock: 4, desc: '6GB RAM, 128GB, OIS Camera, 44W FlashCharge' },
      { name: 'Apple iPhone 15', brand: 'apple', cat: 'smartphones', price: 69999, stock: 2, desc: '128GB, A16 Bionic, 48MP Camera, Dynamic Island' },
      { name: 'Nothing Phone 2a', brand: 'nothing', cat: 'smartphones', price: 23999, stock: 3, desc: '8GB RAM, 128GB, Glyph Interface, 50MP Camera' },
      { name: 'boAt Airdopes 141', brand: 'boat', cat: 'earphones', price: 1299, stock: 20, desc: 'TWS Earbuds, 42H Playback, ENx Tech, IPX4' },
      { name: 'boAt Rockerz 450', brand: 'boat', cat: 'earphones', price: 1499, stock: 15, desc: 'Wireless Headphones, 40mm Drivers, 15H Playback' },
      { name: 'Noise Buds VS104', brand: 'noise', cat: 'earphones', price: 1099, stock: 18, desc: 'TWS, Hyper Sync Technology, 30H Playback' },
      { name: 'JBL Tune 230NC', brand: 'jbl', cat: 'earphones', price: 4999, stock: 5, desc: 'TWS ANC, JBL Pure Bass, 40H Battery' },
      { name: 'Realme Buds T300', brand: 'realme', cat: 'earphones', price: 1799, stock: 12, desc: '30dB ANC, 360° Spatial Audio, 40H Playback' },
      { name: 'OnePlus Nord Buds 2', brand: 'oneplus', cat: 'earphones', price: 2999, stock: 8, desc: '12.4mm Titanium Drivers, 25dB ANC, IP55' },
      { name: 'Noise ColorFit Pro 5', brand: 'noise', cat: 'smart-watches', price: 3999, stock: 8, desc: '1.85" AMOLED, Bluetooth Calling, 100+ Sports' },
      { name: 'Fire-Boltt Phoenix', brand: 'fire-boltt', cat: 'smart-watches', price: 1599, stock: 15, desc: '1.3" Display, SpO2, Heart Rate, 120+ Sports Modes' },
      { name: 'boAt Storm Call 2', brand: 'boat', cat: 'smart-watches', price: 2499, stock: 10, desc: '1.83" HD, Bluetooth Calling, 700+ Active Modes' },
      { name: 'Samsung Galaxy Watch FE', brand: 'samsung', cat: 'smart-watches', price: 19999, stock: 2, desc: 'Wear OS, BIA Sensor, Advanced Sleep Coaching' },
      { name: 'Apple Watch SE', brand: 'apple', cat: 'smart-watches', price: 29999, stock: 1, desc: 'GPS, watchOS, Crash Detection, Water Resistant' },
      { name: 'Ambrane 20W Type-C Charger', brand: 'ambrane', cat: 'chargers', price: 699, stock: 25, desc: 'Quick Charge 3.0, BIS Certified, Type-C Cable Included' },
      { name: 'pTron Volta FC15 20W Charger', brand: 'ptron', cat: 'chargers', price: 499, stock: 30, desc: 'Type-C PD Charger, BIS Certified, Made in India' },
      { name: 'Portronics Konnect L 1.2M Cable', brand: 'portronics', cat: 'chargers', price: 299, stock: 40, desc: 'Lightning to USB Cable, Fast Charging, Nylon Braided' },
      { name: 'Anker PowerPort III 65W', brand: 'anker', cat: 'chargers', price: 3499, stock: 5, desc: '3-Port GaN Charger, PD + Quick Charge' },
      { name: 'Ambrane 10000mAh Power Bank', brand: 'ambrane', cat: 'power-banks', price: 899, stock: 15, desc: '22.5W Fast Charging, Dual USB, Type-C Input' },
      { name: 'Syska 20000mAh Power Bank', brand: 'syska', cat: 'power-banks', price: 1499, stock: 10, desc: '22.5W QC, Li-Polymer, LED Indicators' },
      { name: 'Samsung Galaxy M34 Back Cover', brand: 'samsung', cat: 'cases', price: 299, stock: 20, desc: 'TPU Transparent, Shockproof, Slim Fit' },
      { name: 'Redmi Note 13 Tempered Glass', brand: 'redmi', cat: 'cases', price: 199, stock: 50, desc: '9H Hardness, Full Glue, Anti-Fingerprint' },
      { name: 'iPhone 15 Silicone Case', brand: 'apple', cat: 'cases', price: 1499, stock: 8, desc: 'MagSafe Compatible, Soft Touch, Multiple Colors' },
      { name: 'boAt Stone 352', brand: 'boat', cat: 'speakers', price: 1499, stock: 8, desc: '10W, Bluetooth 5.3, IPX5, 12H Playback' },
      { name: 'JBL Go 3', brand: 'jbl', cat: 'speakers', price: 3499, stock: 4, desc: 'Ultra-Portable, IP67 Waterproof, Bold Sound' },
      { name: 'Zebronics Zeb-Action', brand: 'zebronics', cat: 'speakers', price: 999, stock: 12, desc: '10W, TWS, RGB Lights, USB/SD/AUX' },
      { name: 'Crompton Super Fan Neo 1200mm', brand: 'crompton', cat: 'fans', price: 1899, stock: 4, desc: '3-Blade Ceiling Fan, High Air Delivery, Energy Efficient' },
      { name: 'Havells Pacer 1200mm', brand: 'havells', cat: 'fans', price: 2199, stock: 3, desc: '3-Blade Ceiling Fan, Double Ball Bearing, 390 RPM' },
      { name: 'Bajaj Frore 1200mm', brand: 'bajaj', cat: 'fans', price: 1549, stock: 6, desc: '3-Blade, Anti-Rust, High Speed, 5 Star Rated' },
      { name: 'Orient Electric Hill Breeze', brand: 'orient', cat: 'fans', price: 1399, stock: 5, desc: 'Wall Mounted Fan, 3 Speed, 300mm' },
      { name: 'Usha Maxx Air 400mm Table Fan', brand: 'usha', cat: 'fans', price: 2299, stock: 3, desc: 'Powerful Motor, 3-Speed, Oscillation' },
      { name: 'Bajaj Flashy 1000W Room Heater', brand: 'bajaj', cat: 'heaters', price: 999, stock: 8, desc: 'Radiant Heater, 1000W, Nickel Chrome Element' },
      { name: 'Orpat OEH-1220 Fan Heater', brand: 'orpat', cat: 'heaters', price: 1099, stock: 6, desc: '2000W, 2 Heat Settings, Overheat Protection' },
      { name: 'Havells Cista Room Heater', brand: 'havells', cat: 'heaters', price: 2499, stock: 3, desc: 'Oil Filled Radiator, 9 Fins, 2400W, 3 Heat Settings' },
      { name: 'Singer Quartz Heater', brand: 'singer', cat: 'heaters', price: 1299, stock: 5, desc: '800W, 2 Rod Quartz, Tip-Over Protection' },
      { name: 'Usha QH 3002 Quartz Heater', brand: 'usha', cat: 'heaters', price: 1499, stock: 4, desc: '800W, ISI Certified, Low Power Consumption' },
    ];

    for (const p of sampleProducts) {
      const brandId = getBrandId(p.brand);
      const catId = getCatId(p.cat);
      if (brandId && catId) {
        db.run(
          'INSERT INTO products (name, brand_id, category_id, price, stock, description) VALUES (?, ?, ?, ?, ?, ?)',
          [p.name, brandId, catId, p.price, p.stock, p.desc]
        );
      }
    }
    console.log(`✅ Seeded ${sampleProducts.length} sample products`);
  }

  // Save to disk
  saveDatabase();

  // Auto-save interval
  saveInterval = setInterval(saveDatabase, 30000);

  return db;
}

// Helper to convert sql.js results to array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return { changes: db.getRowsModified(), lastInsertRowid: queryOne('SELECT last_insert_rowid() as id').id };
}

function getDb() {
  return db;
}

// Cleanup on exit
function cleanup() {
  if (saveInterval) clearInterval(saveInterval);
  if (db) {
    saveDatabase();
    db.close();
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

module.exports = { initializeDatabase, queryAll, queryOne, runSql, getDb, saveDatabase };
