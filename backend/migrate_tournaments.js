const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateTournaments() {
  const query = `
    CREATE TABLE IF NOT EXISTS tournaments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      sport_type VARCHAR(50) DEFAULT 'football',
      description TEXT,
      rules TEXT,
      entry_fee DECIMAL(10,2) DEFAULT 0.00,
      prize TEXT,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP NOT NULL,
      max_teams INT DEFAULT 16,
      banner_image TEXT,
      is_featured BOOLEAN DEFAULT false,
      show_on_homepage BOOLEAN DEFAULT false,
      display_priority INT DEFAULT 0,
      display_start_date TIMESTAMP,
      display_end_date TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tournament_registrations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
      team_name VARCHAR(255) NOT NULL,
      captain_name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      payment_status VARCHAR(50) DEFAULT 'pending',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(query);
    console.log("Migration successful: tournament tables created!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

migrateTournaments();
