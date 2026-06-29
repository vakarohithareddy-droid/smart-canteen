// routes/menu.js — MVC: thin route file, logic in controller
const express = require('express');
const {
  getMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem, seedMenu,
} = require('../controllers/menuController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/',          getMenu);                          // public
router.get('/:id',       getMenuItem);                      // public
router.post('/seed',     protect, adminOnly, seedMenu);     // admin
router.post('/',         protect, adminOnly, createMenuItem); // admin
router.put('/:id',       protect, adminOnly, updateMenuItem); // admin
router.delete('/:id',    protect, adminOnly, deleteMenuItem); // admin

module.exports = router;
