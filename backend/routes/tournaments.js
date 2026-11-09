const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');
const mailer = require('../utils/mailer');

const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'shri-trimurti-sports-arena/tournaments',
    allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
  },
});
const upload = multer({ storage: storage });

// Admin: Upload Banner Image
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    res.json({ secure_url: req.file.path });
  } catch (err) {
    res.status(500).json({ error: 'Image upload failed' });
  }
});

// Admin: Create Tournament
router.post('/', authMiddleware, async (req, res) => {
  const { name, sport_type, description, rules, entry_fee, prize, start_date, end_date, max_teams, banner_image, is_featured, show_on_homepage, display_priority, display_start_date, display_end_date, is_active } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tournaments (name, sport_type, description, rules, entry_fee, prize, start_date, end_date, max_teams, banner_image, is_featured, show_on_homepage, display_priority, display_start_date, display_end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [name, sport_type, description, rules, entry_fee, prize, start_date, end_date, max_teams, banner_image, is_featured, show_on_homepage, display_priority, display_start_date, display_end_date, is_active]
    );
    await cache.delPattern('tournaments:*');
    
    if (is_active) {
      const io = req.app.get('io');
      if (io) io.emit('tournament_update', { action: 'created', data: result.rows[0] });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all tournaments
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournaments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update Tournament
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, sport_type, description, rules, entry_fee, prize, start_date, end_date, max_teams, banner_image, is_featured, show_on_homepage, display_priority, display_start_date, display_end_date, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tournaments SET name=$1, sport_type=$2, description=$3, rules=$4, entry_fee=$5, prize=$6, start_date=$7, end_date=$8, max_teams=$9, banner_image=$10, is_featured=$11, show_on_homepage=$12, display_priority=$13, display_start_date=$14, display_end_date=$15, is_active=$16 
       WHERE id=$17 RETURNING *`,
      [name, sport_type, description, rules, entry_fee, prize, start_date, end_date, max_teams, banner_image, is_featured, show_on_homepage, display_priority, display_start_date, display_end_date, is_active, id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    await cache.delPattern('tournaments:*');
    const io = req.app.get('io');
    if (io) io.emit('tournament_update', { action: 'updated', data: result.rows[0] });
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete Tournament
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM tournaments WHERE id=$1', [req.params.id]);
    await cache.delPattern('tournaments:*');
    const io = req.app.get('io');
    if (io) io.emit('tournament_update', { action: 'deleted', id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get specific tournament registrations
router.get('/:id/registrations', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tournament_registrations WHERE tournament_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: Get featured tournaments (for homepage banners)
router.get('/featured', async (req, res) => {
  try {
    const cached = await cache.get('tournaments:featured');
    if (cached) return res.json(cached);

    const result = await pool.query(`
      SELECT * FROM tournaments 
      WHERE is_active = true 
      AND show_on_homepage = true 
      AND (display_start_date IS NULL OR display_start_date <= NOW())
      AND (display_end_date IS NULL OR display_end_date >= NOW())
      ORDER BY display_priority DESC, created_at DESC
    `);
    
    for (let t of result.rows) {
      const regObj = await pool.query("SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id=$1 AND payment_status IN ('paid', 'completed', 'pending_verification')", [t.id]);
      t.registered_teams = parseInt(regObj.rows[0].count);
    }

    await cache.set('tournaments:featured', result.rows, 300); // 5 mins
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: Get all active tournaments
router.get('/', async (req, res) => {
  try {
    const cached = await cache.get('tournaments:active');
    if (cached) return res.json(cached);

    const result = await pool.query(`
      SELECT * FROM tournaments 
      WHERE is_active = true 
      AND end_date >= NOW()
      ORDER BY start_date ASC
    `);
    
    for (let t of result.rows) {
      const regObj = await pool.query("SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id=$1 AND payment_status IN ('paid', 'completed', 'pending_verification')", [t.id]);
      t.registered_teams = parseInt(regObj.rows[0].count);
    }

    await cache.set('tournaments:active', result.rows, 60); // 1 min
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: Get tournament detail
router.get('/:id', async (req, res) => {
  try {
    const cached = await cache.get(`tournaments:detail:${req.params.id}`);
    if (cached) return res.json(cached);

    const result = await pool.query('SELECT * FROM tournaments WHERE id=$1 AND is_active=true', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const regObj = await pool.query("SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id=$1 AND payment_status IN ('paid', 'completed', 'pending_verification')", [req.params.id]);
    const detail = { ...result.rows[0], registered_teams: parseInt(regObj.rows[0].count) };

    await cache.set(`tournaments:detail:${req.params.id}`, detail, 30); // 30s
    res.json(detail);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: Send OTP to Captain's Email
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name, tournament_id } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    let tournamentName = 'Shri Trimurti Tournament';
    if (tournament_id) {
      const tRes = await pool.query('SELECT name FROM tournaments WHERE id=$1', [tournament_id]);
      if (tRes.rows.length > 0) tournamentName = tRes.rows[0].name;
    }

    const cleanEmail = email.toLowerCase().trim();
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await pool.query('DELETE FROM otp_verifications WHERE email = $1 AND verified = false', [cleanEmail]);
    await pool.query(
      'INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES ($1, $2, $3)',
      [cleanEmail, otp, expiresAt]
    );

    await cache.set(`otp:${cleanEmail}`, otp, 300);

    const mailRes = await mailer.sendTournamentOTP({
      email: cleanEmail,
      name,
      otp,
      tournamentName
    });

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      provider: mailRes?.provider || 'default',
    });
  } catch (err) {
    console.error('[TOURNAMENT SEND OTP ERROR]', err);
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// Public: Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const result = await pool.query(
      'SELECT id FROM otp_verifications WHERE email = $1 AND otp_code = $2 AND verified = false AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail, cleanOtp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new code.' });
    }

    await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [result.rows[0].id]);
    await cache.set(`otp_verified:${cleanEmail}`, 'true', 900); // 15 mins window

    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (err) {
    console.error('[TOURNAMENT VERIFY OTP ERROR]', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Public: Register Team (Direct UPI Flow with Brevo OTP Verified Email)
router.post('/:id/register', async (req, res) => {
  const { team_name, captain_name, phone, email, utr_number } = req.body;
  try {
    // Basic validation
    if (!team_name || !captain_name || !phone) {
      return res.status(400).json({ error: 'Team name, Captain name, and Phone are required' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid captain email address is required' });
    }

    // Verify email was OTP verified
    const otpCheck = await pool.query(
      "SELECT id FROM otp_verifications WHERE email = $1 AND verified = true AND expires_at > NOW() - INTERVAL '30 minutes' ORDER BY id DESC LIMIT 1",
      [cleanEmail]
    );
    if (otpCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Please verify your email address with the OTP code first' });
    }

    if (!utr_number || utr_number.trim().length < 6) {
      return res.status(400).json({ error: 'Please enter a valid 12-digit UPI Transaction Ref / UTR number' });
    }

    // Verify slots left
    const tournamentRes = await pool.query('SELECT max_teams, is_active, entry_fee, name, sport_type FROM tournaments WHERE id=$1', [req.params.id]);
    if (tournamentRes.rows.length === 0 || !tournamentRes.rows[0].is_active) {
       return res.status(400).json({ error: 'Tournament not available' });
    }
    const max_teams = tournamentRes.rows[0].max_teams;

    const regObj = await pool.query(
      "SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id=$1 AND payment_status NOT IN ('cancelled', 'rejected')", 
      [req.params.id]
    );
    const registered_teams = parseInt(regObj.rows[0].count);

    if (registered_teams >= max_teams) {
       return res.status(400).json({ error: 'Tournament is already full' });
    }

    // Check duplicate UTR
    const dupUtr = await pool.query(
      "SELECT id FROM tournament_registrations WHERE utr_number = $1 AND payment_status NOT IN ('cancelled', 'rejected')",
      [utr_number.trim()]
    );
    if (dupUtr.rows.length > 0) {
      return res.status(400).json({ error: 'This UPI UTR / Reference number has already been submitted for a registration' });
    }

    // Create registration with pending_verification and verified email
    const insertRes = await pool.query(
      `INSERT INTO tournament_registrations (tournament_id, team_name, captain_name, phone, email, utr_number, payment_mode, payment_status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'upi', 'pending_verification') RETURNING *`,
      [req.params.id, team_name.trim(), captain_name.trim(), phone.trim(), cleanEmail, utr_number.trim()]
    );

    // Send confirmation receipt email
    mailer.sendTournamentRegistrationReceived({
      email: cleanEmail,
      captainName: captain_name.trim(),
      teamName: team_name.trim(),
      tournamentName: tournamentRes.rows[0].name,
      entryFee: tournamentRes.rows[0].entry_fee,
      utrNumber: utr_number.trim(),
      registrationId: insertRes.rows[0].id
    }).catch(err => console.error('[TOURNAMENT RECEIPT EMAIL ERROR]', err));

    await cache.delPattern('tournaments:*');
    const io = req.app.get('io');
    if (io) {
      io.emit('tournament_registration_success', { 
        tournament_id: req.params.id, 
        registration_id: insertRes.rows[0].id 
      });
    }

    res.status(201).json({ 
      success: true, 
      id: insertRes.rows[0].id, 
      registration: insertRes.rows[0],
      message: 'Registration submitted successfully! A confirmation receipt has been sent to your email.'
    });
  } catch (err) {
    console.error("Registration initiation error:", err);
    res.status(500).json({ error: 'Failed to initiate registration: ' + err.message });
  }
});

// Admin: Verify UPI Registration (Approve or Reject with Email Notifications)
router.post('/registrations/:id/verify-upi', authMiddleware, async (req, res) => {
  const { action, rejection_reason } = req.body;
  const { id } = req.params;

  try {
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "Action must be either 'approve' or 'reject'" });
    }

    let query, params;
    if (action === 'approve') {
      query = `UPDATE tournament_registrations 
               SET payment_status = 'paid' 
               WHERE id = $1 
               RETURNING *`;
      params = [id];
    } else {
      query = `UPDATE tournament_registrations 
               SET payment_status = 'rejected', rejection_reason = $2 
               WHERE id = $1 
               RETURNING *`;
      params = [id, rejection_reason || 'Payment UTR could not be verified'];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const reg = result.rows[0];

    // Fetch tournament data for email
    const tRes = await pool.query('SELECT name, sport_type, entry_fee FROM tournaments WHERE id = $1', [reg.tournament_id]);
    const tData = tRes.rows[0];

    // Dispatch automated status email
    if (reg.email) {
      if (action === 'approve') {
        mailer.sendTournamentRegistrationConfirmed({
          email: reg.email,
          captainName: reg.captain_name,
          teamName: reg.team_name,
          tournamentName: tData?.name || 'Tournament',
          entryFee: tData?.entry_fee || '0',
          registrationId: reg.id,
          sportType: tData?.sport_type
        }).catch(err => console.error('[TOURNAMENT CONFIRMATION EMAIL ERROR]', err));
      } else {
        mailer.sendTournamentRegistrationRejected({
          email: reg.email,
          captainName: reg.captain_name,
          teamName: reg.team_name,
          tournamentName: tData?.name || 'Tournament',
          registrationId: reg.id,
          reason: rejection_reason
        }).catch(err => console.error('[TOURNAMENT REJECTION EMAIL ERROR]', err));
      }
    }

    await cache.delPattern('tournaments:*');
    const io = req.app.get('io');
    if (io) {
      io.emit('tournament_registration_success', { 
        tournament_id: reg.tournament_id, 
        registration_id: id,
        action 
      });
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Team registration approved & official match pass emailed!' : 'Team registration rejected and captain notified',
      registration: reg
    });
  } catch (err) {
    console.error("Verify UPI error:", err);
    res.status(500).json({ error: 'Failed to verify registration: ' + err.message });
  }
});

// Admin: Delete/Cancel Registration
router.delete('/registrations/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM tournament_registrations WHERE id=$1', [req.params.id]);
    await cache.delPattern('tournaments:*');
    const io = req.app.get('io');
    if (io) io.emit('tournament_registration_success');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

// Public: Cancel pending tournament registration
router.patch('/registrations/:id/cancel-pending', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE tournament_registrations SET payment_status = 'cancelled' WHERE id = $1 AND payment_status IN ('pending', 'pending_verification') RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Registration cannot be cancelled' });
    }

    await cache.delPattern('tournaments:*');
    const io = req.app.get('io');
    if (io) io.emit('tournament_registration_success');
    
    res.json({ success: true, message: 'Pending registration cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
