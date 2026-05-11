-- W5 cleanup — retire the Tool Shed module.
--
-- Tool Shed entries (Postcard / 3-2-1 / Takeover) were originally stored
-- in their own table and surfaced at /learning/tool-shed. W5's original
-- plan was to merge them into the main news feed via path (b) — a backfill
-- into `posts` using the three reserved `post_type` slots from 00095.
--
-- Pre-launch row check on 2026-05-11 found 5 entries, all test fixtures.
-- With zero real data, the substantive merge work (composer + schema
-- column + render branches + notification source kind) moves into W7's
-- broader composer + feed-layout audit. W5 ships as pure cleanup.
--
-- The three reserved `post_type` slots (tool_shed_postcard /
-- tool_shed_three_two_one / tool_shed_takeover) stay in 00095's CHECK
-- whitelist — harmless to leave dormant, will be populated by W7.

DROP TABLE IF EXISTS public.tool_shed_entries CASCADE;
