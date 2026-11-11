const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { loginLimiter } = require('../middleware/rateLimiter');
const { Resend } = require('resend');
const crypto = require('crypto');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const authMiddleware = require('../middleware/auth');

// Helper for audit logging
async function logAction(adminId, action, details) {
  try {
    await pool.query('INSERT INTO audit_logs (admin_id, action, details) VALUES ($1, $2, $3)', [adminId, action, details]);
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// GET /profiles - Public list of staff for PIN login selection
router.get('/staff-profiles', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM users WHERE role = $1 ORDER BY name ASC', ['staff']);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'admin', 'staff']);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, allowed_tabs: user.allowed_tabs || [], token_version: user.token_version }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, allowed_tabs: user.allowed_tabs || [] } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login-pin', loginLimiter, async (req, res) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) return res.status(400).json({ error: 'Email and PIN required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'admin', 'staff']);
    const user = result.rows[0];
    if (!user || !user.pin_hash) return res.status(401).json({ error: 'PIN login not set up or invalid credentials' });

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid PIN' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, allowed_tabs: user.allowed_tabs || [], token_version: user.token_version }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, allowed_tabs: user.allowed_tabs || [] } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3',
      [name, email || req.user.email, req.user.id]
    );

    await logAction(req.user.id, 'UPDATE_PROFILE', `Updated name to ${name}`);
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    await logAction(req.user.id, 'CHANGE_PASSWORD', 'Password updated successfully');
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout from all devices
router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
    await logAction(req.user.id, 'GLOBAL_LOGOUT', 'User logged out from all devices');
    res.json({ message: 'Logged out from all devices successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update PIN
router.put('/pin', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPin } = req.body;
    if (!currentPassword || !newPin) return res.status(400).json({ error: 'Both password and new PIN required' });
    if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const pinHash = await bcrypt.hash(newPin, 10);
    await pool.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [pinHash, req.user.id]);

    await logAction(req.user.id, 'CHANGE_PIN', '4-digit PIN updated successfully');
    res.json({ message: 'PIN updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Staff Login via PIN (Selection flow)
router.post('/login-staff-pin', loginLimiter, async (req, res) => {
  try {
    const { id, pin } = req.body;
    if (!id || !pin) return res.status(400).json({ error: 'Staff ID and PIN required' });

    const result = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [id, 'staff']);
    const user = result.rows[0];
    if (!user || !user.pin_hash) return res.status(401).json({ error: 'Invalid staff member or PIN not set' });

    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid PIN' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, allowed_tabs: user.allowed_tabs || [], token_version: user.token_version }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, allowed_tabs: user.allowed_tabs || [] } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password - Initiate Reset
router.post('/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Verify user exists and is admin/staff
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'admin', 'staff']);
    const user = result.rows[0];

    // Security: Even if user doesn't exist, we return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If this email exists, a reset link has been sent.' });
    }

    // Generate Token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Save to DB
    await pool.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, token, expiresAt]);

    // Send Email
    if (resend) {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      
      await resend.emails.send({
        from: 'SHRI TRIMURTI FITNESS CLUB <onboarding@resend.dev>',
        to: email,
        subject: 'Reset Your Admin Password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4CAF50; text-align: center;">Password Reset Request</h2>
            <p>Hi ${user.name},</p>
            <p>We received a request to reset your admin password for <strong>SHRI TRIMURTI FITNESS CLUB</strong>.</p>
            <p>Click the button below to set a new password. This link is valid for 1 hour.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email or contact the main administrator.</p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <p style="color: #999; font-size: 10px; text-align: center;">&copy; 2026 SHRI TRIMURTI FITNESS CLUB</p>
          </div>
        `
      });
    } else {
      console.warn('[AUTH] Resend API Key missing. Reset link:', `${process.env.FRONTEND_URL}/reset-password?token=${token}`);
    }

    await logAction(user.id, 'FORGOT_PASSWORD_REQUEST', `Reset link sent to ${email}`);
    res.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password - Finalize via Token
router.post('/reset-password', loginLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    // Validate token
    const result = await pool.query(
      'SELECT r.* FROM password_resets r WHERE r.token = $1 AND r.expires_at > NOW()',
      [token]
    );
    const resetRequest = result.rows[0];

    if (!resetRequest) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update Password
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, resetRequest.user_id]);

    // Update token version to logout from everywhere else
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [resetRequest.user_id]);

    // Clean up used token
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

    await logAction(resetRequest.user_id, 'PASSWORD_RESET_SUCCESS', 'User successfully reset password via email token');
    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
