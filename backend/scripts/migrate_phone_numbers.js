const pool = require('../config/db');
const { normalizeTo10Digits } = require('../utils/phone');

async function migratePhoneNumbers() {
  console.log('[MIGRATION] Starting phone number standardization to 10 digits...');

  try {
    // 1. Fetch all users with phone numbers
    const usersRes = await pool.query('SELECT id, name, phone, role FROM users WHERE phone IS NOT NULL');
    console.log(`[MIGRATION] Found ${usersRes.rows.length} users with phone numbers.`);

    for (const u of usersRes.rows) {
      const p10 = normalizeTo10Digits(u.phone);
      if (!p10) continue;

      if (u.phone !== p10) {
        console.log(`[MIGRATION] User "${u.name}" (ID: ${u.id}) has non-10 digit phone: "${u.phone}". Target: "${p10}".`);

        // Check if another user already has this 10-digit phone
        const existing = await pool.query('SELECT id, name, role FROM users WHERE phone = $1 AND id != $2', [p10, u.id]);

        if (existing.rows.length > 0) {
          const targetUser = existing.rows[0];
          console.log(`[MIGRATION] Target phone ${p10} already belongs to user "${targetUser.name}" (${targetUser.id}). Merging...`);

          // Re-link bookings to the primary user
          const updateBookings = await pool.query(
            'UPDATE bookings SET user_id = $1 WHERE user_id = $2',
            [targetUser.id, u.id]
          );
          console.log(`[MIGRATION] Re-linked ${updateBookings.rowCount} bookings to user ${targetUser.id}.`);

          // Re-link table_sessions if any
          await pool.query('UPDATE table_sessions SET customer_phone = $1 WHERE customer_phone = $2', [p10, u.phone]).catch(() => {});

          // Delete the redundant duplicate user
          await pool.query('DELETE FROM users WHERE id = $1', [u.id]);
          console.log(`[MIGRATION] Deleted duplicate user ${u.id}.`);
        } else {
          // Simply update the phone to 10 digits
          await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [p10, u.id]);
          console.log(`[MIGRATION] Updated user ${u.id} phone to "${p10}".`);
        }
      }
    }

    // 2. Clean table_sessions customer_phone
    const sessionsRes = await pool.query('SELECT id, customer_phone FROM table_sessions WHERE customer_phone IS NOT NULL');
    for (const s of sessionsRes.rows) {
      const p10 = normalizeTo10Digits(s.customer_phone);
      if (p10 && s.customer_phone !== p10) {
        await pool.query('UPDATE table_sessions SET customer_phone = $1 WHERE id = $2', [p10, s.id]);
      }
    }

    // 3. Clean tournament_registrations phone
    const tournRes = await pool.query('SELECT id, phone FROM tournament_registrations WHERE phone IS NOT NULL');
    for (const tr of tournRes.rows) {
      const p10 = normalizeTo10Digits(tr.phone);
      if (p10 && tr.phone !== p10) {
        await pool.query('UPDATE tournament_registrations SET phone = $1 WHERE id = $2', [p10, tr.id]);
      }
    }

    // Verification
    const finalUsers = await pool.query('SELECT id, name, phone, role FROM users WHERE phone IS NOT NULL');
    console.log('[MIGRATION COMPLETED] Current users in DB:');
    console.table(finalUsers.rows);

    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION ERROR]', err);
    process.exit(1);
  }
}

migratePhoneNumbers();
