import { vi } from "vitest";

/**
 * Shared mock for next/navigation.
 * Use in vi.mock("next/navigation") factory functions.
 */
export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

export const useSearchParams = vi.fn(() => new URLSearchParams());

export const usePathname = vi.fn(() => "/");

export const useParams = vi.fn(() => ({}));

export const redirect = vi.fn();

export const notFound = vi.fn();
