const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function runSql(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function initializeDatabase() {
  await runSql(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, icon TEXT DEFAULT '📦', sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
  await runSql(`CREATE TABLE IF NOT EXISTS brands (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, category_type TEXT DEFAULT 'general', created_at TIMESTAMP DEFAULT NOW())`);
  await runSql(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, brand_id INTEGER REFERENCES brands(id), category_id INTEGER REFERENCES categories(id), price NUMERIC NOT NULL DEFAULT 0, stock INTEGER DEFAULT 0, description TEXT DEFAULT '', image TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
  await runSql(`CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
  await runSql(`CREATE TABLE IF NOT EXISTS repairs (id SERIAL PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, device_name TEXT NOT NULL, issue TEXT NOT NULL, status TEXT DEFAULT 'Received', estimated_cost NUMERIC DEFAULT 0, expected_date TEXT, notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
  await runSql(`CREATE TABLE IF NOT EXISTS admin (id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW())`);

  const catCount = await queryOne('SELECT COUNT(*) as count FROM categories');
  if (parseInt(catCount.count) === 0) {
    const cats = [['Smartphones','smartphones','📱',1],['Earphones & Headphones','earphones','🎧',2],['Smart Watches','smart-watches','⌚',3],['Chargers & Cables','chargers','🔌',4],['Cases & Screen Guards','cases','🛡️',5],['Power Banks','power-banks','🔋',6],['Speakers','speakers','🔊',7],['Fans','fans','🌀',8],['Heaters','heaters','🔥',9],['Other Gadgets','other','⚡',10]];
    for (const [name,slug,icon,order] of cats) await runSql('INSERT INTO categories (name,slug,icon,sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',[name,slug,icon,order]);
    console.log('✅ Seeded categories');
  }

  const brandCount = await queryOne('SELECT COUNT(*) as count FROM brands');
  if (parseInt(brandCount.count) === 0) {
    const brands = [['Samsung','samsung','phones'],['Xiaomi','xiaomi','phones'],['Redmi','redmi','phones'],['Realme','realme','phones'],['Oppo','oppo','phones'],['Vivo','vivo','phones'],['OnePlus','oneplus','phones'],['Apple','apple','phones'],['Nothing','nothing','phones'],['Motorola','motorola','phones'],['Nokia','nokia','phones'],['iQOO','iqoo','phones'],['Poco','poco','phones'],['Tecno','tecno','phones'],['Infinix','infinix','phones'],['Lava','lava','phones'],['Micromax','micromax','phones'],['boAt','boat','audio'],['Noise','noise','audio'],['Fire-Boltt','fire-boltt','audio'],['JBL','jbl','audio'],['Sony','sony','audio'],['Zebronics','zebronics','audio'],['Ambrane','ambrane','accessories'],['Portronics','portronics','accessories'],['pTron','ptron','accessories'],['Syska','syska','accessories'],['Anker','anker','accessories'],['URB','urb','accessories'],['Crompton','crompton','electrical'],['Havells','havells','electrical'],['Bajaj','bajaj','electrical'],['Orient','orient','electrical'],['Usha','usha','electrical'],['Maharaja Whiteline','maharaja-whiteline','electrical'],['Orpat','orpat','electrical'],['Singer','singer','electrical']];
    for (const [name,slug,cat] of brands) await runSql('INSERT INTO brands (name,slug,category_type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[name,slug,cat]);
    console.log('✅ Seeded brands');
  }

  const adminCount = await queryOne('SELECT COUNT(*) as count FROM admin');
  if (parseInt(adminCount.count) === 0) {
    const hash = bcrypt.hashSync('mobile@klinic123', 10);
    await runSql('INSERT INTO admin (username,password_hash,display_name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',['towhead',hash,'Towhead Bhat']);
    console.log('✅ Seeded admin');
  }

  console.log('📦 Database ready');
}

module.exports = { initializeDatabase, query, queryOne, runSql, pool };
