-- Additional Indexes for Performance

-- Slots: Faster availability checks
CREATE INDEX IF NOT EXISTS idx_slots_is_available ON slots(is_available);

-- Bookings: Faster recent bookings list for dashboard
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- Users: Faster lookup by phone and email
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Testimonials: Faster filtering by status (approved/pending)
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status);

-- Table Sessions: Critical for analytics and per-turf filtering
-- Note: Checking if table exists before indexing as it might have been added later
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'table_sessions') THEN
        CREATE INDEX IF NOT EXISTS idx_sessions_turf_id ON table_sessions(turf_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON table_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON table_sessions(start_time);
    END IF;
END $$;
