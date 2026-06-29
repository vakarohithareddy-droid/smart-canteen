// ═══════════════════════════════════════════════════════════
//  controllers/orderController.js
//  MVC Architecture: Controller layer — Order business logic
// ═══════════════════════════════════════════════════════════

const Order = require('../models/Order');
const { predictWaitTime } = require('../middleware/mlPredict');

// @desc  Place order directly
// @route POST /api/orders
const placeOrder = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const gst      = Math.round(subtotal * 0.05);
    const total    = subtotal + gst;

    const activeOrders = await Order.countDocuments({
      status: { $in: ['Order Received', 'Preparing'] },
    });

    const prediction = predictWaitTime({
      activeOrders,
      hourOfDay: new Date().getHours(),
      itemCount: items.reduce((s, i) => s + i.qty, 0),
      items,
    });

    const order = await Order.create({
      user:          req.user._id,
      userName:      req.user.name,
      items,
      subtotal,
      gst,
      total,
      status:        'Order Received',
      estimatedWait: prediction.estimatedWait,
      mlFeatures:    prediction.features,
    });

    const io = req.app.get('io');
    io.to('admin_room').emit('new_order', {
      orderId:  order.orderId,
      userName: req.user.name,
      total,
      status:   order.status,
      time:     new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    });

    res.status(201).json({
      success:       true,
      data:          order,
      estimatedWait: prediction.estimatedWait,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get orders (student = own, admin = all)
// @route GET /api/orders
const getOrders = async (req, res) => {
  try {
    const query  = req.user.role !== 'admin' ? { user: req.user._id } : {};
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email');
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Advance order status (admin)
// @route PUT /api/orders/:id
const updateOrderStatus = async (req, res) => {
  try {
    const STEPS = ['Order Received', 'Preparing', 'Ready for Pickup', 'Completed'];
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const idx = STEPS.indexOf(order.status);
    if (idx < STEPS.length - 1) {
      order.status = STEPS[idx + 1];
      await order.save();
    }

    const io = req.app.get('io');
    io.to('user_' + order.user.toString()).emit('order_status_updated', {
      orderId: order.orderId,
      status:  order.status,
    });
    io.to('admin_room').emit('order_status_updated', {
      orderId: order.orderId,
      status:  order.status,
    });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Full analytics for dashboard (admin)
// @route GET /api/orders/stats
const getStats = async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    // ── Today & yesterday orders ────────────────────────────
    const todayOrders     = await Order.find({ createdAt: { $gte: today } });
    const yesterdayOrders = await Order.find({
      createdAt: { $gte: yesterday, $lt: today },
    });

    const todayRevenue     = todayOrders.reduce((s, o) => s + o.total, 0);
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + o.total, 0);

    const revenueChange = yesterdayRevenue > 0
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
      : null;
    const ordersChange = yesterdayOrders.length > 0
      ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100)
      : null;

    // ── Active orders & ML wait ─────────────────────────────
    const activeOrders = await Order.countDocuments({
      status: { $in: ['Order Received', 'Preparing'] },
    });
    const prediction = predictWaitTime({ activeOrders });

    // ── Popular items from today's orders ───────────────────
    const itemMap = {};
    todayOrders.forEach(order => {
      order.items.forEach(item => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = { name: item.name, emoji: item.emoji || '🍽', count: 0 };
        }
        itemMap[item.name].count += item.qty;
      });
    });
    const popularItems = Object.values(itemMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ── Orders by hour (today, 8am–8pm) ────────────────────
    const hourlyBuckets = Array(12).fill(0); // index 0 = 8am, 11 = 7pm
    todayOrders.forEach(order => {
      const h = new Date(order.createdAt).getHours();
      if (h >= 8 && h <= 19) hourlyBuckets[h - 8]++;
    });

    // ── Revenue last 7 days ─────────────────────────────────
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const recentOrders = await Order.find({ createdAt: { $gte: sevenDaysAgo } });

    const revByDay = Array(7).fill(0);
    recentOrders.forEach(order => {
      const d = new Date(order.createdAt);
      d.setHours(0,0,0,0);
      const diffDays = Math.round((d - sevenDaysAgo) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) revByDay[diffDays] += order.total;
    });

    // Build day labels (Mon, Tue …)
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const revLabels = Array(7).fill(0).map((_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      return dayNames[d.getDay()];
    });

    res.json({
      success: true,
      data: {
        todayRevenue,
        todayOrderCount:  todayOrders.length,
        activeOrders,
        estimatedWait:    prediction.estimatedWait,
        isPeakHour:       prediction.isPeakHour,
        revenueChange,
        ordersChange,
        popularItems,
        hourlyBuckets,
        revByDay,
        revLabels,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { placeOrder, getOrders, updateOrderStatus, getStats };
