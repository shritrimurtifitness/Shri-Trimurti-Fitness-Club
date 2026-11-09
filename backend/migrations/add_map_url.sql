-- Add map_embed_url to site_settings for the public Contact section
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS map_embed_url TEXT DEFAULT '';
