# SmartCanteen v3 — Upgrade Guide

## What's new in v3

### ✅ Upgrade 6 — Razorpay Payment Integration
- Two-step payment flow: create order → verify signature → place order
- Cryptographic signature verification on backend (prevents payment bypass)
- Orders only created in DB **after** payment is verified
- Payment details (razorpayOrderId, paymentId, signature, paidAt) stored in `Order` model
- Frontend uses official Razorpay Checkout.js SDK from CDN

**How to set up:**
1. Create a free account at https://dashboard.razorpay.com
2. Go to Settings → API Keys → Generate Test Key
3. Add to your `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxx
   RAZORPAY_KEY_SECRET=xxxx
   ```
4. For production: switch to Live keys and add your bank account

### ✅ Upgrade 7 — Deploy Full Project
**Backend → Render:**
1. Push this repo to GitHub
2. Go to https://render.com → New Web Service
3. Connect your repo → set Root Directory to `backend`
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Add all env vars from `.env` in Render dashboard
7. Copy your Render URL (e.g. `https://smartcanteen.onrender.com`)

**Frontend → Vercel:**
1. Go to https://vercel.com → New Project → Import your GitHub repo
2. Set Root Directory to `frontend`
3. No build command needed (plain HTML/JS)
4. In `frontend/app.js`, the API URL is already dynamic:
   - Local dev: uses process.env.REACT_APP_API_URL + "/api"
   - Production: uses `/api` (same origin — but for Vercel you'll need CORS)
5. ⚠️ For separate deployments: update `BACKEND_PORT` to your Render URL

**For resume:** Add the live Render URL and Vercel URL as project links.

### ✅ Upgrade 8 — MVC Architecture + Menu from API
- Project restructured into `controllers/`, `models/`, `routes/`, `config/`
- **Menu is 100% dynamic** — no hardcoded items in frontend
- Admin can add, edit, delete, and toggle menu items via API
- New routes: `POST /api/menu` (create), `DELETE /api/menu/:id` (delete)
- Menu changes broadcast live via Socket.IO to all connected users
- `MenuItem` model has `isVeg` and `sortOrder` fields for richer control

## API Reference

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/register | — | Register |
| POST | /api/auth/login | — | Login, get JWT |
| GET | /api/auth/me | Bearer | Get current user |

### Menu
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/menu | — | All items (optional ?cat=Meals&avail=true) |
| GET | /api/menu/:id | — | Single item |
| POST | /api/menu | Admin | Create item |
| PUT | /api/menu/:id | Admin | Update item |
| DELETE | /api/menu/:id | Admin | Delete item |
| POST | /api/menu/seed | Admin | Seed 12 items |

### Orders (Razorpay flow)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/orders/create-payment | Bearer | Step 1: Get Razorpay order |
| POST | /api/orders/verify-payment | Bearer | Step 2: Verify & place order |
| GET | /api/orders | Bearer | Own orders (admin: all) |
| PUT | /api/orders/:id | Admin | Advance status |
| GET | /api/orders/stats | Admin | Today's analytics |

### Cart
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/cart | Bearer | Get cart |
| POST | /api/cart | Bearer | Add/update item |
| DELETE | /api/cart/:menuItemId | Bearer | Remove item |
| DELETE | /api/cart | Bearer | Clear cart |

## Quick Start

```bash
cd backend
npm install
# Edit .env with your MongoDB URI and Razorpay test keys
npm run dev    # uses nodemon
```

Open process.env.REACT_APP_API_URL + "/api" in your browser.

**Seed the menu (first run only):**
```
POST /api/menu/seed   [Admin JWT required]
```

## MVC Folder Structure

```
backend/
├── config/
│   ├── db.js          # MongoDB connection
│   └── razorpay.js    # Razorpay singleton
├── controllers/
│   ├── authController.js
│   ├── cartController.js
│   ├── menuController.js
│   └── orderController.js
├── middleware/
│   ├── auth.js        # JWT protect + adminOnly
│   └── mlPredict.js   # ML wait time prediction
├── models/
│   ├── Cart.js
│   ├── MenuItem.js
│   ├── Order.js       # includes payment subdoc
│   └── User.js
├── routes/
│   ├── auth.js        # thin routes → controller
│   ├── cart.js
│   ├── menu.js
│   └── orders.js
├── .env
├── .gitignore
├── package.json
└── server.js

frontend/
├── index.html         # Razorpay CDN added
├── style.css
└── app.js             # Razorpay checkout + dynamic menu
```
