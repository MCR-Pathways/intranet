import { vi } from "vitest";

/**
 * Shared mock for next/cache.
 * Use in vi.mock("next/cache") factory functions.
 */
export const revalidatePath = vi.fn();
export const revalidateTag = vi.fn();
export const unstable_cache = vi.fn((fn: () => unknown) => fn);
