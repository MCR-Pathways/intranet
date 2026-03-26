# Testing Patterns

Vitest 4 + React Testing Library + jsdom. See root `CLAUDE.md` for basic setup.

## Mocking Strategy

**Mock auth helpers, not the Supabase client, in server action tests.** Mocking `requireHRAdmin()` / `getCurrentUser()` from `@/lib/auth` is far simpler than mocking the low-level Supabase fluent chain. The fluent API shares `mockEq` across select and update chains, causing fragile test state.

**Use `vi.hoisted()`** when mock variables need to be available inside `vi.mock()` factory functions (which are hoisted above all imports).

**For proxy tests** — mock `@/lib/supabase/middleware` (`updateSession`) to control auth state, then mock the `.from().select().eq().single()` chain for profile fetching.

## Reference Files

- `src/__mocks__/supabase.ts` — mock factory documenting the full Supabase mocking strategy
- `src/app/(protected)/hr/users/actions.test.ts` — server action test reference
- `src/proxy.test.ts` — proxy test reference
