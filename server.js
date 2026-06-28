const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const { initializeDatabase, query, queryOne, runSql, pool } = require('./database');
const { requireAdmin, requireCustomer } = require('./middleware/auth');

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'mobileklinic-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24*60*60*1000, httpOnly: true, secure: true, sameSite: 'none' }
}));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ storage: multer.diskStorage({
  destination: (req,file,cb) => cb(null,uploadsDir),
  filename: (req,file,cb) => cb(null, Date.now()+'-'+Math.round(Math.random()*1E9)+path.extname(file.originalname))
}), limits:{fileSize:5*1024*1024} });

app.get('/api/categories', async (req,res) => { try { res.json(await query('SELECT * FROM categories ORDER BY sort_order ASC')); } catch(err){res.status(500).json({error:err.message})} });
app.get('/api/brands', async (req,res) => { try { res.json(await query('SELECT * FROM brands ORDER BY name ASC')); } catch(err){res.status(500).json({error:err.message})} });

app.get('/api/products', async (req,res) => {
  try {
    const {category,brand,search,sort,limit,offset} = req.query;
    let sql = `SELECT p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name, c.slug as category_slug, c.icon as category_icon FROM products p LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_active=1`;
    const params=[]; let n=0;
    if(category&&category!=='all'){sql+=` AND c.slug=$${++n}`;params.push(category)}
    if(brand&&brand!=='all'){sql+=` AND b.slug=$${++n}`;params.push(brand)}
    if(search){sql+=` AND (p.name ILIKE $${++n} OR p.description ILIKE $${n} OR b.name ILIKE $${n})`;params.push('%'+search+'%')}
    if(sort==='price-low')sql+=' ORDER BY p.price ASC';
    else if(sort==='price-high')sql+=' ORDER BY p.price DESC';
    else if(sort==='newest')sql+=' ORDER BY p.created_at DESC';
    else sql+=' ORDER BY c.sort_order ASC, p.name ASC';
    if(limit){sql+=` LIMIT $${++n}`;params.push(parseInt(limit));if(offset){sql+=` OFFSET $${++n}`;params.push(parseInt(offset))}}
    res.json(await query(sql,params));
  } catch(err){res.status(500).json({error:err.message})}
});

app.get('/api/products/:id', async (req,res) => {
  try {
    const p = await queryOne(`SELECT p.*,b.name as brand_name,c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id WHERE p.id=$1`,[req.params.id]);
    if(!p) return res.status(404).json({error:'Product not found'});
    res.json(p);
  } catch(err){res.status(500).json({error:err.message})}
});

app.post('/api/customer/register', async (req,res) => {
  try {
    const {name,phone,password}=req.body;
    if(!name||!phone||!password) return res.status(400).json({error:'All fields required'});
    if(!/^\d{10}$/.test(phone)) return res.status(400).json({error:'Enter valid 10-digit phone'});
    if(await queryOne('SELECT id FROM customers WHERE phone=$1',[phone])) return res.status(400).json({error:'Phone already registered'});
    const hash=bcrypt.hashSync(password,10);
    const r=await runSql('INSERT INTO customers(name,phone,password_hash) VALUES($1,$2,$3) RETURNING id',[name,phone,hash]);
    req.session.customer={id:r.rows[0].id,name,phone};
    res.json({success:true,customer:req.session.customer});
  } catch(err){res.status(500).json({error:err.message})}
});

app.post('/api/customer/login', async (req,res) => {
  try {
    const {phone,password}=req.body;
    const c=await queryOne('SELECT * FROM customers WHERE phone=$1',[phone]);
    if(!c||!bcrypt.compareSync(password,c.password_hash)) return res.status(401).json({error:'Invalid credentials'});
    req.session.customer={id:c.id,name:c.name,phone:c.phone};
    res.json({success:true,customer:req.session.customer});
  } catch(err){res.status(500).json({error:err.message})}
});

app.post('/api/customer/logout',(req,res)=>{req.session.destroy();res.json({success:true})});
app.get('/api/customer/me',(req,res)=>{ if(req.session?.customer) res.json({loggedIn:true,customer:req.session.customer}); else res.json({loggedIn:false}) });
app.get('/api/customer/repairs', requireCustomer, async (req,res) => { try{res.json(await query('SELECT * FROM repairs WHERE customer_phone=$1 ORDER BY created_at DESC',[req.session.customer.phone]))}catch(err){res.status(500).json({error:err.message})} });

app.post('/api/admin/login', async (req,res) => {
  try {
    const {username,password}=req.body;
    const admin=await queryOne('SELECT * FROM admin WHERE username=$1',[username]);
    if(!admin||!bcrypt.compareSync(password,admin.password_hash)) return res.status(401).json({error:'Invalid credentials'});
    req.session.admin={id:admin.id,username:admin.username,displayName:admin.display_name};
    res.json({success:true,admin:req.session.admin});
  } catch(err){res.status(500).json({error:err.message})}
});

app.post('/api/admin/logout',(req,res)=>{req.session.destroy();res.json({success:true})});
app.get('/api/admin/me',(req,res)=>{ if(req.session?.admin) res.json({loggedIn:true,admin:req.session.admin}); else res.json({loggedIn:false}) });

app.get('/api/admin/stats', requireAdmin, async (req,res) => {
  try {
    const [p,ar,cr,c] = await Promise.all([
      queryOne("SELECT COUNT(*) as count FROM products WHERE is_active=1"),
      queryOne("SELECT COUNT(*) as count FROM repairs WHERE status NOT IN ('Ready','Delivered')"),
      queryOne("SELECT COUNT(*) as count FROM repairs WHERE status IN ('Ready','Delivered')"),
      queryOne("SELECT COUNT(*) as count FROM customers")
    ]);
    res.json({totalProducts:parseInt(p.count),activeRepairs:parseInt(ar.count),completedRepairs:parseInt(cr.count),totalCustomers:parseInt(c.count)});
  } catch(err){res.status(500).json({error:err.message})}
});

app.get('/api/admin/products', requireAdmin, async (req,res) => {
  try {
    const {category,brand,search}=req.query;
    let sql=`SELECT p.*,b.name as brand_name,b.slug as brand_slug,c.name as category_name,c.slug as category_slug FROM products p LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id WHERE 1=1`;
    const params=[]; let n=0;
    if(category&&category!=='all'){sql+=` AND c.slug=$${++n}`;params.push(category)}
    if(brand&&brand!=='all'){sql+=` AND b.slug=$${++n}`;params.push(brand)}
    if(search){sql+=` AND (p.name ILIKE $${++n} OR p.description ILIKE $${n})`;params.push('%'+search+'%')}
    sql+=' ORDER BY p.created_at DESC';
    res.json(await query(sql,params));
  } catch(err){res.status(500).json({error:err.message})}
});

app.post('/api/admin/products', requireAdmin, upload.single('image'), async (req,res) => {
  try {
    const {name,brand_id,category_id,price,stock,description}=req.body;
    const image=req.file?`/uploads/${req.file.filename}`:'';
    if(!name||!price) return res.status(400).json({error:'Name and price required'});
    const r=await runSql(`INSERT INTO products(name,brand_id,category_id,price,stock,description,image) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[name,brand_id||null,category_id||null,parseFloat(price),parseInt(stock)||0,description||'',image]);
    res.json({success:true,product:await queryOne('SELECT * FROM products WHERE id=$1',[r.rows[0].id])});
  } catch(err){res.status(500).json({error:err.message})}
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), async (req,res) => {
  try {
    const {name,brand_id,category_id,price,stock,description}=req.body;
    const existing=await queryOne('SELECT * FROM products WHERE id=$1',[req.params.id]);
    if(!existing) return res.status(404).json({error:'Product not found'});
    let image=existing.image;
    if(req.file){image=`/uploads/${req.file.filename}`;if(existing.image){const op=path.join(__dirname,'public',existing.image);if(fs.existsSync(op))fs.unlinkSync(op)}}
    await runSql(`UPDATE products SET name=$1,brand_id=$2,category_id=$3,price=$4,stock=$5,description=$6,image=$7,updated_at=NOW() WHERE id=$8`,[name,brand_id||null,category_id||null,parseFloat(price),parseInt(stock)||0,description||'',image,req.params.id]);
    res.json({success:true,product:await queryOne(`SELECT p.*,b.name as brand_name,c.name as category_name FROM products p LEFT JOIN brands b ON p.brand_id=b.id LEFT JOIN categories c ON p.category_id=c.id WHERE p.id=$1`,[req.params.id])});
  } catch(err){res.status(500).json({error:err.message})}
});

app.delete('/api/admin/products/:id', requireAdmin, async (req,res) => {
  try {
    const p=await queryOne('SELECT * FROM products WHERE id=$1',[req.params.id]);
    if(!p) return res.status(404).json({error:'Product not found'});
    if(p.image){const ip=path.join(__dirname,'public',p.image);if(fs.existsSync(ip))fs.unlinkSync(ip)}
    await runSql('DELETE FROM products WHERE id=$1',[req.params.id]);
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message})}
});

app.get('/api/admin/repairs/recent', requireAdmin, async (req,res) => { try{res.json(await query('SELECT * FROM repairs ORDER BY created_at DESC LIMIT 5'))}catch(err){res.status(500).json({error:err.message})} });

app.get('/api/admin/repairs', requireAdmin, async (req,res) => {
  try {
    const {status,search}=req.query;
    let sql='SELECT * FROM repairs WHERE 1=1'; const params=[]; let n=0;
    if(status&&status!=='all'){sql+=` AND status=$${++n}`;params.push(status)}
    if(search){sql+=` AND (customer_name ILIKE $${++n} OR customer_phone ILIKE $${n} OR device_name ILIKE $${n})`;params.push('%'+search+'%')}
    sql+=' ORDER BY created_at DESC';
    res.json(await query(sql,params));
  } catch(err){res.status(500).json({error:err.message})}
});

app.post('/api/admin/repairs', requireAdmin, async (req,res) => {
  try {
    const {customer_name,customer_phone,device_name,issue,estimated_cost,expected_date,status,notes}=req.body;
    if(!customer_name||!customer_phone||!device_name||!issue) return res.status(400).json({error:'Required fields missing'});
    const r=await runSql(`INSERT INTO repairs(customer_name,customer_phone,device_name,issue,estimated_cost,expected_date,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[customer_name,customer_phone,device_name,issue,parseFloat(estimated_cost)||0,expected_date||null,status||'Received',notes||'']);
    res.json({success:true,repair:await queryOne('SELECT * FROM repairs WHERE id=$1',[r.rows[0].id])});
  } catch(err){res.status(500).json({error:err.message})}
});

app.put('/api/admin/repairs/:id', requireAdmin, async (req,res) => {
  try {
    const {customer_name,customer_phone,device_name,issue,estimated_cost,expected_date,status,notes}=req.body;
    const e=await queryOne('SELECT * FROM repairs WHERE id=$1',[req.params.id]);
    if(!e) return res.status(404).json({error:'Repair not found'});
    await runSql(`UPDATE repairs SET customer_name=$1,customer_phone=$2,device_name=$3,issue=$4,estimated_cost=$5,expected_date=$6,status=$7,notes=$8,updated_at=NOW() WHERE id=$9`,[customer_name||e.customer_name,customer_phone||e.customer_phone,device_name||e.device_name,issue||e.issue,parseFloat(estimated_cost)||e.estimated_cost,expected_date||e.expected_date,status||e.status,notes!==undefined?notes:e.notes,req.params.id]);
    res.json({success:true,repair:await queryOne('SELECT * FROM repairs WHERE id=$1',[req.params.id])});
  } catch(err){res.status(500).json({error:err.message})}
});

app.delete('/api/admin/repairs/:id', requireAdmin, async (req,res) => {
  try {
    if(!await queryOne('SELECT id FROM repairs WHERE id=$1',[req.params.id])) return res.status(404).json({error:'Not found'});
    await runSql('DELETE FROM repairs WHERE id=$1',[req.params.id]);
    res.json({success:true});
  } catch(err){res.status(500).json({error:err.message})}
});

app.get('/api/admin/customers', requireAdmin, async (req,res) => { try{res.json(await query('SELECT id,name,phone,created_at FROM customers ORDER BY created_at DESC'))}catch(err){res.status(500).json({error:err.message})} });

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`📱 MOBILE KLINIC running on port ${PORT}`);
      console.log(`👤 Admin: towhead / mobile@klinic123`);
    });
  } catch(err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

startServer();
