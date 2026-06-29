// ═══════════════════════════════════════════════════════════
//  models/Order.js
//  MVC Architecture: Model layer — Order schema
//  v4: Payment fields removed. Order is placed directly.
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  menuItemId: { type: Number, required: true },
  name:       { type: String, required: true },
  emoji:      { type: String, default: '🍽' },
  price:      { type: Number, required: true },
  qty:        { type: Number, required: true, min: 1 },
});

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type:   String,
      unique: true,   // e.g. SC-1001
    },
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    userName:  { type: String },
    items:     [OrderItemSchema],
    subtotal:  { type: Number, required: true },
    gst:       { type: Number, required: true },
    total:     { type: Number, required: true },
    status: {
      type:    String,
      enum:    ['Order Received', 'Preparing', 'Ready for Pickup', 'Completed'],
      default: 'Order Received',
    },
    estimatedWait: { type: Number, default: 10 },
    mlFeatures: {
      activeOrders: { type: Number },
      hourOfDay:    { type: Number },
      dayOfWeek:    { type: Number },
      itemCount:    { type: Number },
      isPeakHour:   { type: Boolean },
    },
  },
  { timestamps: true }
);

// Auto-generate orderId before first save
OrderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    const count  = await mongoose.model('Order').countDocuments();
    this.orderId = 'SC-' + (1000 + count + 1);
  }
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
