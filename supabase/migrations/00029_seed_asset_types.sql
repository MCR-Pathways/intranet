-- Seed default asset types for HR asset tracking
-- These are common IT and office equipment categories

INSERT INTO public.asset_types (name, description, is_active)
VALUES
  ('Laptop', 'Portable computer', true),
  ('Desktop', 'Desktop computer or workstation', true),
  ('Monitor', 'Display monitor', true),
  ('Phone', 'Mobile phone or desk phone', true),
  ('Headset', 'Audio headset or headphones', true),
  ('Keyboard', 'Keyboard or input device', true),
  ('Mouse', 'Mouse or pointing device', true),
  ('Webcam', 'Web camera', true),
  ('Docking Station', 'Laptop docking station or hub', true),
  ('Tablet', 'Tablet device', true),
  ('Printer', 'Printer or scanner', true),
  ('Other', 'Other equipment', true)
ON CONFLICT (name) DO NOTHING;
