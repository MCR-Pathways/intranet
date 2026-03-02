import dns from "node:dns/promises";

/** Checks whether a dotted-decimal IPv4 address is in a private/reserved range. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;
  if (parts[0] === 10) return true; // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
  if (parts[0] === 127) return true; // 127.0.0.0/8
  if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
  if (parts[0] === 0) return true; // 0.0.0.0/8
  return false;
}

/**
 * Checks whether an IP address belongs to a private/reserved range.
 * Used to prevent SSRF attacks in fetchLinkPreview and the OG image proxy.
 * Handles IPv4, IPv6, and IPv4-mapped IPv6 in both dotted-decimal
 * (::ffff:127.0.0.1) and hex (::ffff:7f00:0001) forms.
 */
export function isPrivateIP(ip: string): boolean {
  // Handle IPv4-mapped IPv6 in dotted-decimal (e.g. ::ffff:127.0.0.1)
  const v4MappedDotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4MappedDotted) return isPrivateIPv4(v4MappedDotted[1]);

  // Handle IPv4-mapped IPv6 in hex (e.g. ::ffff:7f00:0001 → 127.0.0.1)
  const v4MappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (v4MappedHex) {
    const high = parseInt(v4MappedHex[1], 16);
    const low = parseInt(v4MappedHex[2], 16);
    const a = (high >> 8) & 0xff;
    const b = high & 0xff;
    const c = (low >> 8) & 0xff;
    const d = low & 0xff;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }

  // Plain IPv4
  if (ip.includes(".")) return isPrivateIPv4(ip);

  // Native IPv6 private/reserved ranges
  if (ip === "::1") return true; // ::1/128 loopback
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7 ULA
  if (ip.startsWith("fe80")) return true; // fe80::/10 link-local
  return false;
}

/**
 * Validates that a URL does not resolve to a private/internal IP address.
 * Resolves the hostname once and returns the resolved IP if external,
 * null if private/failed. Prevents DNS rebinding TOCTOU attacks.
 */
export async function resolveExternalUrl(
  url: string
): Promise<string | null> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  if (isPrivateIP(hostname)) return null;

  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateIP(address)) return null;
    return address;
  } catch {
    return null;
  }
}
