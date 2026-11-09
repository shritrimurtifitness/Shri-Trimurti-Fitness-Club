const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    if (!cache.shouldBypass(req)) {
      const cached = await cache.get('admin:stats');
      if (cached) return res.json(cached);
    }

    const today = new Date().toISOString().split('T')[0];
    const [total, todayBookings, todayRevenue, todaySessionRevenue, totalRevenue, totalSessionRevenue, upcoming] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM bookings WHERE status != 'cancelled'"),
      pool.query("SELECT COUNT(*) FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE s.date = $1 AND b.status != 'cancelled'", [today]),
      pool.query("SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN bookings b ON b.id = p.booking_id JOIN slots s ON s.id = b.slot_id WHERE s.date = $1 AND b.status != 'cancelled'", [today]),
      pool.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM table_sessions WHERE status = 'completed' AND end_time::date = $1", [today]),
      pool.query("SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.status != 'cancelled'"),
      pool.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM table_sessions WHERE status = 'completed'"),
      pool.query("SELECT COUNT(*) FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.status = 'confirmed' AND (s.date > $1 OR (s.date = $1 AND s.end_time > $2))", [today, new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })]),
    ]);

    const data = {
      totalBookings: parseInt(total.rows[0].count),
      todayBookings: parseInt(todayBookings.rows[0].count),
      todayRevenue: parseInt(todayRevenue.rows[0].total) + parseInt(todaySessionRevenue.rows[0].total),
      totalRevenue: parseInt(totalRevenue.rows[0].total) + parseInt(totalSessionRevenue.rows[0].total),
      upcomingBookings: parseInt(upcoming.rows[0].count),
    };

    await cache.set('admin:stats', data, 120); // 2 min
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
// Get audit logs (paginated)
router.get('/audit-logs', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const [logs, countResult] = await Promise.all([
      pool.query(
        `SELECT a.id, a.action, a.details, a.created_at, u.name as admin_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.admin_id
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM audit_logs')
    ]);

    res.json({
      logs: logs.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Live Occupancy Pulse
router.get('/live-pulse', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    
    // Calculate 30 mins from now for 'booked_soon' status
    const nowObj = new Date(`1970-01-01T${nowIST}Z`);
    const in30MinsObj = new Date(nowObj.getTime() + 30 * 60000);
    const in30MinsIST = in30MinsObj.toISOString().split('T')[1].substring(0, 8);

    const [turfsResult, bookingsResult, sessionsResult] = await Promise.all([
      pool.query('SELECT id, name, facility_type, COALESCE(table_count, 1) as table_count FROM turfs WHERE is_active = true ORDER BY created_at ASC'),
      pool.query(`
        SELECT b.id as booking_id, u.name as customer_name, u.phone as customer_phone, s.turf_id, s.start_time, s.end_time, s.table_number
        FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        JOIN users u ON u.id = b.user_id
        JOIN turfs t ON t.id = s.turf_id
        WHERE s.date = $1 AND b.status = 'confirmed' AND t.is_active = true
      `, [today]),
      pool.query(`
        SELECT ts.id as session_id, ts.customer_name, ts.turf_id, ts.table_number, ts.start_time
        FROM table_sessions ts
        JOIN turfs t ON t.id = ts.turf_id
        WHERE ts.status = 'running' AND t.is_active = true
      `)
    ]);

    const turfs = turfsResult.rows;
    const bookings = bookingsResult.rows;
    const sessions = sessionsResult.rows;

    const resources = [];

    // Map each table/turf into a single uniform state resource
    for (const turf of turfs) {
      const isTableGame = ['snooker', 'pool'].includes(turf.facility_type.toLowerCase());
      const count = isTableGame ? turf.table_count : 1;

      for (let i = 1; i <= count; i++) {
        // Find active uncompleted sessions (if this is a table game walk-in)
        const activeSession = sessions.find(s => s.turf_id === turf.id && s.table_number === i);
        
        // Find bookings specific to this resource
        const resourceBookings = bookings.filter(b => b.turf_id === turf.id && (!isTableGame || b.table_number === i));
        
        const activeBooking = resourceBookings.find(b => b.start_time <= nowIST && b.end_time > nowIST);
        const upcomingBooking = resourceBookings.find(b => b.start_time > nowIST && b.start_time <= in30MinsIST);

        let status = 'available';
        let currentBooking = null;

        if (activeSession) {
          status = 'in_use';
          currentBooking = {
            id: activeSession.session_id,
            customerName: activeSession.customer_name || 'Walk-in',
            type: 'session'
          };
        } else if (activeBooking) {
          status = 'in_use';
          
          let tracingEndTime = activeBooking.end_time;
          let nextSegment = resourceBookings.find(b => b.start_time === tracingEndTime && b.customer_phone === activeBooking.customer_phone);
          while (nextSegment) {
            tracingEndTime = nextSegment.end_time;
            nextSegment = resourceBookings.find(b => b.start_time === tracingEndTime && b.customer_phone === activeBooking.customer_phone);
          }

          currentBooking = {
            id: activeBooking.booking_id,
            customerName: activeBooking.customer_name,
            endTime: tracingEndTime.substring(0, 5), // Format HH:MM
            type: 'booking'
          };
        } else if (upcomingBooking) {
          status = 'booked_soon';
          currentBooking = {
            id: upcomingBooking.booking_id,
            customerName: upcomingBooking.customer_name,
            startTime: upcomingBooking.start_time.substring(0, 5),
            type: 'booking'
          };
        }

        resources.push({
          id: `${turf.id}-${i}`,
          turfId: turf.id,
          name: isTableGame ? `${turf.name} (T${i})` : turf.name,
          facilityType: turf.facility_type,
          tableNumber: isTableGame ? i : null,
          status,
          currentBooking
        });
      }
    }

    res.json(resources);
  } catch (err) {
    console.error('Live pulse error:', err);
    res.status(500).json({ error: 'Server error fetching live pulse' });
  }
});

module.exports = router;
