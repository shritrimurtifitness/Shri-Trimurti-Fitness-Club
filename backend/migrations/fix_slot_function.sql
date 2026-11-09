CREATE OR REPLACE FUNCTION generate_daily_slots(target_date DATE, target_turf_id UUID)
RETURNS void AS $$
DECLARE
  hour_val INT;
  table_idx INT;
  t_count INT;
  p_wday_d DECIMAL;
  p_wday_n DECIMAL;
  p_wend_d DECIMAL;
  p_wend_n DECIMAL;
  is_weekend BOOLEAN;
  o_hour INT;
  c_hour INT;
BEGIN
  -- Get turf config with tiered pricing AND hours
  SELECT 
    weekday_day_price, weekday_night_price, 
    weekend_day_price, weekend_night_price, 
    COALESCE(table_count, 1),
    COALESCE(opening_hour, 6),
    COALESCE(closing_hour, 23)
  INTO 
    p_wday_d, p_wday_n, 
    p_wend_d, p_wend_n, 
    t_count,
    o_hour,
    c_hour
  FROM turfs WHERE id = target_turf_id;

  is_weekend := EXTRACT(DOW FROM target_date) IN (0, 6);

  -- Loop through hours dynamically
  FOR hour_val IN o_hour..(c_hour - 1) LOOP
    -- Loop through tables (if any)
    FOR table_idx IN 1..t_count LOOP
      INSERT INTO slots (turf_id, date, start_time, end_time, price, table_number)
      VALUES (
        target_turf_id, 
        target_date, 
        make_time(hour_val, 0, 0), 
        make_time(hour_val + 1, 0, 0), 
        CASE 
          WHEN is_weekend THEN (CASE WHEN hour_val >= 18 THEN p_wend_n ELSE p_wend_d END)
          ELSE (CASE WHEN hour_val >= 18 THEN p_wday_n ELSE p_wday_d END)
        END,
        table_idx
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
