// ═══════════════════════════════════════════════════════════
//  middleware/mlPredict.js
//  CHANGE 4: Heuristic-based ML prediction system
//
//  Inspired by Random Forest regression.
//  Uses multiple weighted features instead of a single formula.
//  In production: replace with a trained Python model via API.
// ═══════════════════════════════════════════════════════════

// ── Feature weights (tuned from canteen patterns) ───────────
// Each weight represents how much that feature affects wait time
const WEIGHTS = {
  BASE_TIME:      2.0,   // minimum wait (minutes)
  PER_ORDER:      0.45,  // each active order adds this many minutes
  PEAK_PENALTY:   1.35,  // multiplier during peak lunch hours
  LARGE_ORDER:    1.5,   // extra minutes if order has >3 items
  COMPLEX_ITEM:   0.8,   // extra per complex item (biryani, thali)
};

// Complex items that take longer to prepare
const COMPLEX_ITEMS = [1, 2, 7, 12]; // Veg Thali, Biryani, Fried Rice, Paneer Masala

// ── Main prediction function ────────────────────────────────
function predictWaitTime(features) {
  const {
    activeOrders = 0,
    hourOfDay    = new Date().getHours(),
    itemCount    = 1,
    items        = [],
  } = features;

  // Feature 1: Base load from active orders
  let wait = WEIGHTS.BASE_TIME + (activeOrders * WEIGHTS.PER_ORDER);

  // Feature 2: Peak hour multiplier (11am–2pm = lunch rush)
  const isPeakHour = hourOfDay >= 11 && hourOfDay <= 14;
  if (isPeakHour) wait *= WEIGHTS.PEAK_PENALTY;

  // Feature 3: Large order penalty (>3 items)
  if (itemCount > 3) wait += WEIGHTS.LARGE_ORDER;

  // Feature 4: Complex items take more time
  const complexCount = items.filter(i => COMPLEX_ITEMS.includes(i.menuItemId)).length;
  wait += complexCount * WEIGHTS.COMPLEX_ITEM;

  // Feature 5: Early morning / late evening — faster (less staff load)
  const isOffPeak = hourOfDay < 9 || hourOfDay > 16;
  if (isOffPeak) wait *= 0.8;

  return {
    estimatedWait: Math.max(2, Math.round(wait)),
    isPeakHour,
    confidence: isPeakHour ? 'High' : 'Medium',  // model confidence
    features: {                                    // log for analytics
      activeOrders,
      hourOfDay,
      itemCount,
      complexCount,
      isPeakHour,
    },
  };
}

module.exports = { predictWaitTime };
