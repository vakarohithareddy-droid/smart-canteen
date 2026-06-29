// ═══════════════════════════════════════════════════════════
//  app.js  —  SmartCanteen Frontend v3
//  CHANGE 1: Calls real backend API (not hardcoded data)
//  CHANGE 2: Cart + Orders saved in MongoDB
//  CHANGE 3: JWT token stored in localStorage
//  CHANGE 4: ML prediction from backend
//  CHANGE 5: Socket.IO for live order status updates
//  v4: Direct order placement + Email confirmation
//  UPGRADE 7: Deploy-ready (Vercel + Render compatible)
//  UPGRADE 8: Menu from API — zero hardcoded items in frontend
// ═══════════════════════════════════════════════════════════

// ── API + Socket setup ──────────────────────────────────────
// Backend always runs on port 5001. Use absolute URL for local dev,
// relative paths for production deployment.

const BACKEND_PORT = 5001;
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = isLocal
  ? 'http://localhost:' + BACKEND_PORT + '/api'
  : process.env.REACT_APP_API_URL + '/api';

const SOCKET_URL = isLocal
  ? 'http://localhost:' + BACKEND_PORT
  : process.env.REACT_APP_API_URL;

// CHANGE 5: Connect Socket.IO from CDN
const socket = io(SOCKET_URL);

// ── Token / User helpers ────────────────────────────────────
const getToken   = ()      => localStorage.getItem('sc_token');
const setToken   = (t)     => localStorage.setItem('sc_token', t);
const clearToken = ()      => localStorage.removeItem('sc_token');
const getUser    = ()      => JSON.parse(localStorage.getItem('sc_user') || 'null');
const setUser    = (u)     => localStorage.setItem('sc_user', JSON.stringify(u));
const clearUser  = ()      => localStorage.removeItem('sc_user');

const authHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

// ── Generic API helpers ─────────────────────────────────────
async function apiPost(path, body, auth = false) {
  const r = await fetch(API_URL + path, {
    method:  'POST',
    headers: auth ? authHeaders() : { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return r.json();
}
async function apiGet(path, auth = false) {
  const r = await fetch(API_URL + path, { headers: auth ? authHeaders() : {} });
  return r.json();
}
async function apiPut(path, body = {}) {
  const r = await fetch(API_URL + path, {
    method:  'PUT',
    headers: authHeaders(),
    body:    JSON.stringify(body),
  });
  return r.json();
}
async function apiDelete(path) {
  const r = await fetch(API_URL + path, { method: 'DELETE', headers: authHeaders() });
  return r.json();
}

// ── State ───────────────────────────────────────────────────
let MENU_DATA    = [];
let cart         = {};          // local mirror of DB cart
let avail        = {};
let activeCat    = 'All';
let activeOrders = 25;

const isLoggedIn = () => !!getToken() && !!getUser();
const isAdmin    = () => isLoggedIn() && getUser().role === 'admin';
const CATS_EMOJI = { All:'🍽', Meals:'🥘', Breakfast:'🌅', Snacks:'🍟', Drinks:'🥤' };

// ── CHANGE 5: Socket.IO event listeners ─────────────────────

// Admin: new order arrives → refresh admin view + toast
socket.on('new_order', (data) => {
  if (isAdmin()) {
    showToast(`🛎 New order ${data.orderId} from ${data.userName} — ₹${data.total}`, 'green');
    if (document.getElementById('page-admin').classList.contains('active')) renderAdmin();
    if (document.getElementById('page-orders').classList.contains('active')) renderOrders();
  }
});

// Student: their order status changed → update tracker live
socket.on('order_status_updated', (data) => {
  showToast(`📦 Order ${data.orderId} is now: ${data.status}`, 'green');
  if (document.getElementById('page-orders').classList.contains('active')) renderOrders();
});

// All users: menu item toggled by admin → reload menu live
socket.on('menu_updated', (data) => {
  avail[data.itemId] = data.avail;
  const statusText = data.avail ? 'available' : 'unavailable';
  showToast(`🍽 ${data.name} is now ${statusText}`, data.avail ? 'green' : 'red');
  if (document.getElementById('page-menu').classList.contains('active')) renderMenuGrid();
});

// UPGRADE 8: Admin added/removed a menu item → reload full menu
socket.on('menu_item_added', async () => {
  await loadMenu();
  showToast('🍽 New menu item added!', 'green');
  if (document.getElementById('page-menu').classList.contains('active')) renderMenu();
  if (document.getElementById('page-admin').classList.contains('active')) renderAdmin();
});
socket.on('menu_item_deleted', async () => {
  await loadMenu();
  if (document.getElementById('page-menu').classList.contains('active')) renderMenu();
  if (document.getElementById('page-admin').classList.contains('active')) renderAdmin();
});

// ── Role-based UI ───────────────────────────────────────────
function applyRoleUI() {
  const loggedIn = isLoggedIn();
  const admin    = isAdmin();
  const user     = getUser();

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });
  document.getElementById('login-btn').style.display  = loggedIn ? 'none' : '';
  document.getElementById('logout-btn').style.display = loggedIn ? '' : 'none';

  const badge = document.getElementById('nav-user-badge');
  if (loggedIn && user) {
    badge.style.display = '';
    badge.textContent   = (admin ? '🔑 ' : '🎓 ') + user.name;
  } else {
    badge.style.display = 'none';
  }

  // CHANGE 5: Join Socket.IO rooms based on role
  if (loggedIn && user) {
    if (admin) {
      socket.emit('join_admin_room');
    } else {
      socket.emit('join_user_room', user.id);
    }
  }
}

// ── Navigation ──────────────────────────────────────────────
function goPage(name) {
  if ((name === 'admin' || name === 'analytics') && !isAdmin()) {
    showToast('🔒 Admin access only', 'red'); openLogin(); return;
  }
  if ((name === 'orders' || name === 'cart') && !isLoggedIn()) {
    showToast('Please sign in first', 'red'); openLogin(); return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const nl = document.getElementById('nav-' + name);
  if (nl) nl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'menu')      renderMenu();
  if (name === 'cart')      renderCart();
  if (name === 'orders')    renderOrders();
  if (name === 'analytics') renderAnalytics();  // async, fires and forgets
  if (name === 'admin')     renderAdmin();
  updateAllQueues();
}

// ── ML Prediction (mirrors backend logic) ───────────────────
// CHANGE 4: Multiple features instead of single formula
function predictWait(activeOrders) {
  const h           = new Date().getHours();
  const isPeak      = h >= 11 && h <= 14;
  const peakFactor  = isPeak ? 1.35 : 1.0;
  const offPeak     = (h < 9 || h > 16) ? 0.8 : 1.0;
  return Math.max(2, Math.round((2 + activeOrders * 0.45) * peakFactor * offPeak));
}
function queueLoad(n)  { return n < 10 ? 'Low load' : n < 30 ? 'Moderate load' : 'High load'; }
function queuePct(n)   { return Math.min(100, Math.round(n / 60 * 100)); }

function updateAllQueues() {
  const w   = predictWait(activeOrders);
  const pct = queuePct(activeOrders);
  const load = queueLoad(activeOrders);
  const t   = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setW = (id, w)  => { const el = document.getElementById(id); if (el) el.style.width = w; };
  set('home-wait', w); setW('home-fill', pct + '%'); set('home-load', load);
  set('home-orders', activeOrders + ' active orders'); set('home-time-pill', t);
  set('sidebar-wait', w); setW('sidebar-bar', pct + '%');
  set('menu-wait-inline', w + ' min'); set('admin-wait-display', w);
  updateCartBadge();
}

// ── Menu ─────────────────────────────────────────────────────
async function loadMenu() {
  const res = await apiGet('/menu');
  if (res.success) {
    MENU_DATA = res.data;
    MENU_DATA.forEach(i => { avail[i.id] = i.avail; });
  }
}

function renderMenu() {
  const CATS  = ['All', ...new Set(MENU_DATA.map(i => i.cat))];
  const catEl = document.getElementById('sidebar-cats');
  catEl.innerHTML = CATS.map(c => `
    <div class="sidebar-cat${c === activeCat ? ' active' : ''}" onclick="setCat('${c}')">
      <span>${CATS_EMOJI[c] || '🍽'}</span> ${c}
      <span class="sidebar-cat-count">${c === 'All' ? MENU_DATA.length : MENU_DATA.filter(i => i.cat === c).length}</span>
    </div>`).join('');
  renderMenuGrid();
}

function setCat(c)    { activeCat = c; renderMenu(); }
function filterMenu() { renderMenuGrid(); }

function renderMenuGrid() {
  const q     = (document.getElementById('menu-search-input') || {}).value || '';
  const items = MENU_DATA.filter(i =>
    (activeCat === 'All' || i.cat === activeCat) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()))
  );
  document.getElementById('menu-grid').innerHTML = items.map(i => {
    const inCart = cart[i.id] || 0;
    const a      = avail[i.id];
    return `<div class="menu-card">
      <div class="menu-card-img" role="img">${i.emoji}
        ${!a ? '<div class="menu-card-unavail-overlay"><div class="unavail-label">Unavailable today</div></div>' : ''}
      </div>
      <div class="menu-card-body">
        <div class="menu-card-name">${i.name}</div>
        <div class="menu-card-desc">${i.desc}</div>
        <div class="menu-card-footer">
          <div class="menu-price">₹${i.price}</div>
          ${a ? (inCart > 0
            ? `<div class="qty-control">
                <button class="qty-btn" onclick="changeQty(${i.id},-1)">−</button>
                <div class="qty-display">${inCart}</div>
                <button class="qty-btn" onclick="changeQty(${i.id},1)">+</button>
               </div>`
            : `<button class="add-to-cart" onclick="addToCart(${i.id})">+ Add</button>`)
          : `<button class="add-to-cart" disabled>Unavailable</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  updateCartBadge(); renderMenuGrid();
  // CHANGE 2: Sync to DB if logged in
  if (isLoggedIn()) {
    const m = MENU_DATA.find(i => i.id == id);
    await apiPost('/cart', { menuItemId: m.id, name: m.name, emoji: m.emoji, price: m.price, qty: cart[id] }, true);
  }
  showToast('Added to cart 🛒', 'green');
}

async function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  updateCartBadge(); renderMenuGrid();
  if (isLoggedIn()) {
    if (cart[id]) {
      const m = MENU_DATA.find(i => i.id == id);
      await apiPost('/cart', { menuItemId: m.id, name: m.name, emoji: m.emoji, price: m.price, qty: cart[id] }, true);
    } else {
      await apiDelete('/cart/' + id);
    }
  }
}

function updateCartBadge() {
  const total = Object.values(cart).reduce((a, b) => a + b, 0);
  const b     = document.getElementById('cart-badge');
  b.textContent   = total;
  b.style.display = total > 0 ? 'flex' : 'none';
}

// ── Cart ─────────────────────────────────────────────────────
function renderCart() {
  const el   = document.getElementById('cart-page-content');
  const keys = Object.keys(cart).filter(k => cart[k] > 0);
  if (!keys.length) {
    el.innerHTML = `<div class="cart-empty">
      <span class="cart-empty-emoji">🛒</span>
      <div style="font-size:20px;font-weight:600;font-family:var(--font-display);margin-bottom:8px">Your cart is empty</div>
      <div style="font-size:15px;margin-bottom:24px">Add items from the menu</div>
      <button class="btn btn-primary btn-lg" onclick="goPage('menu')">Browse menu →</button>
    </div>`;
    return;
  }
  const items    = keys.map(k => { const m = MENU_DATA.find(i => i.id == k); return { ...m, qty: cart[k] }; });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const gst      = Math.round(subtotal * 0.05);
  const total    = subtotal + gst;
  const wait     = predictWait(activeOrders);

  el.innerHTML = `<div class="cart-layout">
    <div class="cart-main">
      ${items.map(i => `<div class="cart-item-row">
        <div class="cart-item-emoji">${i.emoji}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-price">₹${i.price} each · ${i.cat}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQtyCart(${i.id},-1)">−</button>
          <div class="qty-display">${i.qty}</div>
          <button class="qty-btn" onclick="changeQtyCart(${i.id},1)">+</button>
        </div>
        <div class="cart-item-subtotal">₹${i.price * i.qty}</div>
      </div>`).join('')}
    </div>
    <div class="cart-sidebar">
      <div class="cart-sidebar-title">Order summary</div>
      <div class="cart-line"><span>Subtotal</span><span>₹${subtotal}</span></div>
      <div class="cart-line"><span>GST (5%)</span><span>₹${gst}</span></div>
      <div class="cart-total-line"><span>Total</span><span>₹${total}</span></div>
      <div class="cart-wait-box">
        <div class="cart-wait-label">ML predicted wait time</div>
        <div class="cart-wait-val">${wait} min</div>
        <div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:2px">Based on ${activeOrders} active orders · peak hours factor applied</div>
      </div>
      <button class="place-order-btn" onclick="placeOrder()">✅ Place Order — ₹${total}</button>
      <div style="font-size:12px;color:var(--muted);text-align:center;margin-top:10px">Pay at counter when you pick up your order 🍽</div>
    </div>
  </div>`;
}

async function changeQtyCart(id, delta) {
  await changeQty(id, delta);
  renderCart();
}

// ── Place Order — direct order, email confirmation ────────
async function placeOrder() {
  if (!isLoggedIn()) { showToast('Please sign in to place an order', 'red'); openLogin(); return; }
  const keys = Object.keys(cart).filter(k => cart[k] > 0);
  if (!keys.length) return;

  const items = keys.map(k => {
    const m = MENU_DATA.find(i => i.id == k);
    return { menuItemId: m.id, name: m.name, emoji: m.emoji, price: m.price, qty: cart[k] };
  });

  try {
    showToast('Placing your order...', 'green');
    const res = await apiPost('/orders', { items }, true);

    if (!res.success) {
      showToast(res.message || 'Order failed, please try again', 'red');
      return;
    }

    // Clear cart locally + in DB
    cart = {};
    updateCartBadge();
    await apiDelete('/cart');

    const order = res.data;
    const wait  = res.estimatedWait;

    // Show success screen
    document.getElementById('cart-page-content').innerHTML = `<div class="success-screen">
      <span class="success-emoji">🎉</span>
      <div class="success-title">Order Successful!</div>
      <div class="success-sub">Order ID</div>
      <div class="success-id">${order.orderId}</div>
      <div class="success-sub" style="margin-bottom:8px">Est. wait: <strong>${wait} minutes</strong></div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:24px;">Pay ₹${order.total} at the counter when you pick up your order.</div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-lg" onclick="goPage('orders')">📦 Track order</button>
        <button class="btn btn-secondary btn-lg" onclick="goPage('menu')">+ Order more</button>
      </div>
    </div>`;
    showToast(`Order ${order.orderId} placed successfully! 🎉`, 'green');

  } catch (err) {
    showToast('Network error — is the backend running?', 'red');
  }
}

// ── Orders ───────────────────────────────────────────────────
const STEPS       = ['Order Received', 'Preparing', 'Ready for Pickup', 'Completed'];
const STEP_EMOJIS = ['📋', '🔥', '📦', '✅'];

function stepState(status, step) {
  const si = STEPS.indexOf(status), ti = STEPS.indexOf(step);
  return si > ti ? 'done' : si === ti ? 'current' : 'pending';
}

async function renderOrders() {
  const titleEl = document.getElementById('orders-page-title');
  const subEl   = document.getElementById('orders-page-sub');
  const el      = document.getElementById('orders-list');
  el.innerHTML  = '<div style="text-align:center;padding:40px;color:var(--muted)">Loading orders...</div>';

  if (isAdmin()) {
    if (titleEl) titleEl.textContent = 'All Orders';
    if (subEl)   subEl.textContent   = 'Real-time view — all student orders (admin only)';
  } else {
    if (titleEl) titleEl.textContent = 'My Orders';
    if (subEl)   subEl.textContent   = 'Live tracking — updates automatically';
  }

  try {
    const res = await apiGet('/orders', true);
    if (!res.success) { el.innerHTML = '<div style="color:var(--danger);text-align:center;padding:40px">Failed to load</div>'; return; }

    const orders = res.data;
    if (!orders.length) {
      el.innerHTML = `<div class="cart-empty"><span class="cart-empty-emoji">📋</span>
        <div style="font-size:18px;font-weight:600;font-family:var(--font-display)">No orders yet</div>
        <div style="margin:8px 0 20px;color:var(--muted)">Place your first pre-order</div>
        <button class="btn btn-primary" onclick="goPage('menu')">Browse menu →</button></div>`;
      return;
    }

    el.innerHTML = orders.map(o => `<div class="order-card">
      <div class="order-card-head">
        <div>
          <div class="order-card-id">${o.orderId}${isAdmin() && o.userName ? ` <span style="font-size:13px;font-weight:500;color:var(--muted)">— ${o.userName}</span>` : ''}</div>
          <div class="order-card-meta">${new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · ₹${o.total} · ${o.items.length} item(s)</div>
        </div>
        <span class="tag ${o.status==='Order Received'?'tag-blue':o.status==='Preparing'?'tag-amber':o.status==='Ready for Pickup'?'tag-green':''}">${o.status}</span>
      </div>
      <div class="order-card-body">
        <div class="tracker">
          ${STEPS.map((s, si) => { const st = stepState(o.status, s); return `<div class="track-step ${st}"><div class="track-dot">${STEP_EMOJIS[si]}</div><div class="track-step-label">${s}</div></div>`; }).join('')}
        </div>
        <div class="order-items-list">
          ${o.items.map(i => `<div class="order-item-pill">${i.emoji||''} ${i.name} ×${i.qty}</div>`).join('')}
        </div>
        <div class="order-footer">
          <div style="font-size:13px;color:var(--muted)">Total: <strong style="color:var(--text)">₹${o.total}</strong>${o.estimatedWait ? ` · ML wait: <strong>${o.estimatedWait} min</strong>` : ''}</div>
          ${isAdmin() && o.status !== 'Completed'
            ? `<button class="advance-btn" onclick="advanceOrder('${o._id}')">↻ Advance status</button>`
            : o.status === 'Completed' ? '<span class="tag tag-green">✅ Completed</span>' : '<span style="font-size:12px;color:var(--muted)">📡 Live updates on</span>'}
        </div>
      </div>
    </div>`).join('');
  } catch (err) {
    el.innerHTML = '<div style="color:var(--danger);text-align:center;padding:40px">Network error — is the backend running?</div>';
  }
}

async function advanceOrder(mongoId) {
  const res = await apiPut('/orders/' + mongoId);
  if (res.success) {
    if (res.data.status === 'Ready for Pickup') showToast(`🔔 Order ${res.data.orderId} ready for pickup!`, 'green');
    renderOrders();
  }
}

// ── Analytics ─────────────────────────────────────────────────
async function renderAnalytics() {
  // Show loading state
  document.getElementById('stat-cards').innerHTML = `<div style="color:var(--muted);font-size:14px;padding:20px 0">Loading real data...</div>`;

  let d = {};
  try {
    const res = await apiGet('/orders/stats', true);
    if (res.success) d = res.data;
  } catch(e) {}

  // ── Stat cards — real values ──────────────────────────────
  const fmtChange = (pct, label) => {
    if (pct === null || pct === undefined) return { txt: 'No data yet', up: true };
    const sign = pct >= 0 ? '+' : '';
    return { txt: `${sign}${pct}% vs ${label}`, up: pct >= 0 };
  };
  const revDelta    = fmtChange(d.revenueChange, 'yesterday');
  const ordersDelta = fmtChange(d.ordersChange,  'yesterday');

  const stats = [
    {
      val:   d.todayRevenue !== undefined ? `₹${d.todayRevenue.toLocaleString('en-IN')}` : '₹0',
      lbl:   'Revenue today',
      delta: revDelta.txt,
      up:    revDelta.up,
    },
    {
      val:   d.todayOrderCount !== undefined ? String(d.todayOrderCount) : '0',
      lbl:   'Orders today',
      delta: ordersDelta.txt,
      up:    ordersDelta.up,
    },
    {
      val:   d.estimatedWait !== undefined ? `${d.estimatedWait} min` : '—',
      lbl:   'ML predicted wait',
      delta: d.isPeakHour ? '⚠ Peak hour now' : 'Off-peak period',
      up:    !d.isPeakHour,
    },
    {
      val:   d.activeOrders !== undefined ? String(d.activeOrders) : '0',
      lbl:   'Active orders',
      delta: d.activeOrders > 0 ? 'In kitchen now' : 'Queue is clear',
      up:    true,
    },
  ];
  document.getElementById('stat-cards').innerHTML = stats.map(s => `<div class="stat-card">
    <div class="stat-card-val">${s.val}</div>
    <div class="stat-card-lbl">${s.lbl}</div>
    <div class="stat-card-delta ${s.up ? 'delta-up' : 'delta-down'}">${s.delta}</div>
  </div>`).join('');

  // ── Popular items — real from DB ──────────────────────────
  const popular = d.popularItems || [];
  if (popular.length === 0) {
    document.getElementById('popular-chart').innerHTML =
      `<div style="color:var(--muted);font-size:13px;padding:16px 0">No orders placed today yet.</div>`;
  } else {
    const maxCount = Math.max(...popular.map(p => p.count));
    document.getElementById('popular-chart').innerHTML = popular.map(p => `<div class="bar-row">
      <div class="bar-label">${p.emoji || '🍽'} ${p.name}</div>
      <div class="bar-track"><div class="bar-fill-g" style="width:${Math.round(p.count/maxCount*100)}%"></div></div>
      <div class="bar-val-label">${p.count}</div>
    </div>`).join('');
  }

  // ── Orders by hour — real from DB ────────────────────────
  const hours   = d.hourlyBuckets || Array(12).fill(0);
  const hLabels = ['8am','9','10','11','12','1pm','2','3','4','5','6','7'];
  const peakHrs = [false,false,false,true,true,true,false,false,false,false,false,false];
  const maxH    = Math.max(...hours, 1);
  document.getElementById('hour-bars').innerHTML   = hours.map((h, i) => `<div class="h-bar ${peakHrs[i]?'peak':'offpeak'}" style="height:${Math.round(h/maxH*100)}%" title="${hLabels[i]}: ${h} orders"></div>`).join('');
  document.getElementById('hour-labels').innerHTML = hLabels.map(l => `<div class="h-lbl">${l}</div>`).join('');

  // ── Revenue last 7 days — real from DB ───────────────────
  const rev       = d.revByDay   || Array(7).fill(0);
  const revLabels = d.revLabels  || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxR      = Math.max(...rev, 1);
  const todayIdx  = revLabels.length - 1; // last entry is always today
  document.getElementById('revenue-chart').innerHTML = rev.map((r, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
    <div style="font-size:10px;color:var(--muted)">${r >= 1000 ? '₹'+(r/1000).toFixed(1)+'k' : r > 0 ? '₹'+r : ''}</div>
    <div style="width:100%;background:${i===todayIdx?'var(--green)':'#9FE1CB'};border-radius:4px 4px 0 0;height:${Math.max(Math.round(r/maxR*100),r>0?4:0)}px" title="${revLabels[i]}: ₹${r}"></div>
  </div>`).join('');
  document.getElementById('revenue-labels').innerHTML = revLabels.map((l,i) => `<div style="flex:1;text-align:center;font-size:11px;color:${i===todayIdx?'var(--green)':'var(--muted)'};font-weight:${i===todayIdx?600:400}">${l}</div>`).join('');
}

// ── Admin Panel ───────────────────────────────────────────────
function renderAdmin() {
  const avCount = Object.values(avail).filter(Boolean).length;
  const ac = document.getElementById('admin-avail-count');
  if (ac) ac.textContent = avCount + ' of ' + MENU_DATA.length + ' available';

  document.getElementById('admin-menu-list').innerHTML = MENU_DATA.map(i => `<div class="admin-row">
    <div style="font-size:28px">${i.emoji}</div>
    <div class="admin-row-info">
      <div class="admin-row-name">${i.name}</div>
      <div class="admin-row-meta">₹${i.price} · ${i.cat}</div>
    </div>
    <button class="toggle-btn ${avail[i.id] ? 'toggle-on' : 'toggle-off'}" onclick="toggleAvail(${i.id})">${avail[i.id] ? '✓ Available' : '✕ Off menu'}</button>
  </div>`).join('');

  apiGet('/orders', true).then(res => {
    if (!res.success) return;
    document.getElementById('admin-orders-list').innerHTML = res.data.slice(0, 5).map(o => `<div class="admin-row">
      <div style="font-size:20px">🧾</div>
      <div class="admin-row-info">
        <div class="admin-row-name">${o.orderId} <span style="font-size:12px;color:var(--muted)">— ${o.userName || 'Student'}</span></div>
        <div class="admin-row-meta">${new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · ₹${o.total}</div>
      </div>
      <span class="tag ${o.status==='Order Received'?'tag-blue':o.status==='Preparing'?'tag-amber':o.status==='Ready for Pickup'?'tag-green':''}">${o.status}</span>
    </div>`).join('');
  });
}

async function toggleAvail(id) {
  avail[id] = !avail[id];
  await apiPut('/menu/' + id, { avail: avail[id] });
  // Socket.IO will broadcast the change to all users automatically
  renderAdmin();
}

function adminUpdateQueue(v) { activeOrders = parseInt(v); updateAllQueues(); }

// ── Auth ──────────────────────────────────────────────────────
let selectedRole = 'student';
function openLogin()  { document.getElementById('login-modal').classList.add('open'); }
function closeModal() { document.getElementById('login-modal').classList.remove('open'); }
function switchAuthTab(tab, el) {
  document.querySelectorAll('.tab-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
}
function setRole(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!email || !password) { showToast('Please fill in all fields', 'red'); return; }
  try {
    const res = await apiPost('/auth/login', { email, password });
    if (!res.success) { showToast(res.message || 'Login failed', 'red'); return; }
    if (res.user.role !== selectedRole) {
      showToast(`This account is a ${res.user.role}, not a ${selectedRole}`, 'red'); return;
    }
    setToken(res.token); setUser(res.user);
    closeModal(); applyRoleUI();
    // Load cart from DB after login
    await loadCartFromDB();
    showToast(`Welcome, ${res.user.name}! 🎉`, 'green');
  } catch (err) {
    showToast('Network error — is backend running on port 5001?', 'red');
  }
}

async function doSignup() {
  const name      = document.getElementById('signup-first').value.trim();
  const email     = document.getElementById('signup-email').value.trim();
  const password  = document.getElementById('signup-pass').value;
  if (!name || !email || !password) { showToast('Please fill in all fields', 'red'); return; }
  try {
    const res = await apiPost('/auth/register', { name, email, password });
    if (!res.success) { showToast(res.message || 'Signup failed', 'red'); return; }
    setToken(res.token); setUser(res.user);
    closeModal(); applyRoleUI();
    showToast(`Account created! Welcome, ${res.user.name} 🎉`, 'green');
  } catch (err) {
    showToast('Network error — is backend running on port 5001?', 'red');
  }
}

function doLogout() {
  clearToken(); clearUser();
  cart = {};
  updateCartBadge(); applyRoleUI();
  goPage('home');
  showToast('Signed out', 'green');
}

// Load cart from MongoDB after login
async function loadCartFromDB() {
  if (!isLoggedIn()) return;
  const res = await apiGet('/cart', true);
  if (res.success && res.data.items) {
    cart = {};
    res.data.items.forEach(i => { cart[i.menuItemId] = i.qty; });
    updateCartBadge();
  }
}

document.getElementById('login-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── Toast ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-' + (type || 'green') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  applyRoleUI();
  await loadMenu();
  if (isLoggedIn()) await loadCartFromDB();
  updateAllQueues();
  setInterval(() => {
    activeOrders = Math.max(0, activeOrders + (Math.random() > .5 ? 1 : -1) * Math.floor(Math.random() * 3));
    updateAllQueues();
  }, 8000);
})();