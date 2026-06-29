// ═══════════════════════════════════════════════════════════
//  controllers/menuController.js
//  MVC Architecture: Controller layer — Menu business logic
//  UPGRADE 8: Menu items always from MongoDB, zero hardcoding
//             Admin can add/edit/delete items via API
// ═══════════════════════════════════════════════════════════

const MenuItem = require('../models/MenuItem');

// Seed data — only used once via POST /api/menu/seed
// After seeding, admin manages items through the API
const INITIAL_MENU = [
  { id: 1,  name: 'Veg Thali',             emoji: '🍱', cat: 'Meals',     price: 80,  desc: 'Rice, dal, sabzi, roti & pickle',              avail: true,  isVeg: true,  sortOrder: 1  },
  { id: 2,  name: 'Chicken Biryani',        emoji: '🍛', cat: 'Meals',     price: 120, desc: 'Fragrant basmati with spiced chicken',           avail: true,  isVeg: false, sortOrder: 2  },
  { id: 3,  name: 'Masala Dosa',            emoji: '🫓', cat: 'Breakfast', price: 50,  desc: 'Crispy dosa with sambar & chutney',              avail: true,  isVeg: true,  sortOrder: 1  },
  { id: 4,  name: 'Paneer Sandwich',        emoji: '🥪', cat: 'Snacks',    price: 40,  desc: 'Grilled paneer with fresh veggies',              avail: true,  isVeg: true,  sortOrder: 1  },
  { id: 5,  name: 'Cold Coffee',            emoji: '☕', cat: 'Drinks',    price: 35,  desc: 'Blended coffee with ice cream',                  avail: true,  isVeg: true,  sortOrder: 1  },
  { id: 6,  name: 'Fruit Bowl',             emoji: '🍉', cat: 'Snacks',    price: 45,  desc: 'Seasonal fresh fruits',                          avail: false, isVeg: true,  sortOrder: 2  },
  { id: 7,  name: 'Egg Fried Rice',         emoji: '🍳', cat: 'Meals',     price: 70,  desc: 'Wok-tossed rice with eggs & soy',                avail: true,  isVeg: false, sortOrder: 3  },
  { id: 8,  name: 'Lemon Juice',            emoji: '🍋', cat: 'Drinks',    price: 25,  desc: 'Fresh squeezed with salt or sugar',              avail: true,  isVeg: true,  sortOrder: 2  },
  { id: 9,  name: 'Samosa',                 emoji: '🥟', cat: 'Snacks',    price: 20,  desc: 'Crispy pastry with spiced potato filling',       avail: true,  isVeg: true,  sortOrder: 3  },
  { id: 10, name: 'Upma',                   emoji: '🥣', cat: 'Breakfast', price: 35,  desc: 'Semolina with vegetables & mustard seeds',       avail: true,  isVeg: true,  sortOrder: 2  },
  { id: 11, name: 'Mango Lassi',            emoji: '🥛', cat: 'Drinks',    price: 40,  desc: 'Chilled yogurt blended with Alphonso mango',     avail: true,  isVeg: true,  sortOrder: 3  },
  { id: 12, name: 'Paneer Butter Masala',   emoji: '🍲', cat: 'Meals',     price: 110, desc: 'Rich tomato-butter gravy with cottage cheese',   avail: true,  isVeg: true,  sortOrder: 4  },
];

// @desc  Get all menu items (optionally filter by category)
// @route GET /api/menu
// @route GET /api/menu?cat=Meals&avail=true
const getMenu = async (req, res) => {
  try {
    const filter = {};
    if (req.query.cat)   filter.cat   = req.query.cat;
    if (req.query.avail) filter.avail = req.query.avail === 'true';

    const items = await MenuItem.find(filter).sort({ cat: 1, sortOrder: 1, id: 1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get single menu item
// @route GET /api/menu/:id
const getMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findOne({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Create a new menu item (admin)
// @route POST /api/menu
const createMenuItem = async (req, res) => {
  try {
    const { name, emoji, cat, price, desc, avail, isVeg, sortOrder } = req.body;
    if (!name || !cat || price == null) {
      return res.status(400).json({ success: false, message: 'name, cat and price are required' });
    }

    // Auto-increment numeric ID
    const last = await MenuItem.findOne().sort({ id: -1 });
    const id   = last ? last.id + 1 : 1;

    const item = await MenuItem.create({ id, name, emoji, cat, price, desc, avail, isVeg, sortOrder });

    const io = req.app.get('io');
    io.emit('menu_item_added', item);

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update a menu item (admin) — toggle avail, change price, etc.
// @route PUT /api/menu/:id
const updateMenuItem = async (req, res) => {
  try {
    const allowedFields = ['name', 'emoji', 'cat', 'price', 'desc', 'avail', 'isVeg', 'sortOrder'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const item = await MenuItem.findOneAndUpdate(
      { id: req.params.id },
      updates,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const io = req.app.get('io');
    io.emit('menu_updated', { itemId: item.id, avail: item.avail, name: item.name });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Delete a menu item (admin)
// @route DELETE /api/menu/:id
const deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const io = req.app.get('io');
    io.emit('menu_item_deleted', { itemId: item.id });

    res.json({ success: true, message: `${item.name} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Seed initial menu (run once, admin only)
// @route POST /api/menu/seed
const seedMenu = async (req, res) => {
  try {
    await MenuItem.deleteMany({});
    const items = await MenuItem.insertMany(INITIAL_MENU);
    res.json({ success: true, message: `Seeded ${items.length} menu items` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem, seedMenu };
