// ═══════════════════════════════════════════════════════════
//  models/MenuItem.js
//  MVC Architecture: Model layer — Menu item schema
//  UPGRADE 8: Menu items served from API, not hardcoded in frontend
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema(
  {
    id:    { type: Number, required: true, unique: true },
    name:  { type: String, required: true, trim: true },
    emoji: { type: String, default: '🍽' },
    cat:   { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    desc:  { type: String, default: '' },
    avail: { type: Boolean, default: true },
    // Added for richer admin control
    isVeg: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 99 },
  },
  { timestamps: true }
);

// Compound index for fast category queries
MenuItemSchema.index({ cat: 1, avail: 1 });

module.exports = mongoose.model('MenuItem', MenuItemSchema);
