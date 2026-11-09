const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// GET /api/expenses - List all expenses
router.get('/', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let query = 'SELECT * FROM expenses';
    let params = [];

    if (startDate && endDate) {
      query += ' WHERE expense_date BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }
    
    query += ' ORDER BY expense_date DESC, created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch expenses error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses - Add new expense
router.post('/', authMiddleware, async (req, res) => {
  const { category, amount, description, expense_date } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ error: 'Category and amount are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO expenses (category, amount, description, expense_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [category, amount, description, expense_date || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
