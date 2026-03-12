-- Migration: Remove SVG from lesson-images bucket allowed MIME types
-- SVGs can contain embedded <script> tags, making them an XSS vector.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
WHERE id = 'lesson-images';
