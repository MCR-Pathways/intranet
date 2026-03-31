/** Convert YouTube/Vimeo URLs to embeddable format. Returns "" for invalid/unsupported URLs. */
export function getEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  } catch {
    return "";
  }

  // YouTube — handles watch, embed, shorts, live, and youtu.be
  // watch\?.*v= handles v= at any position in the query string (e.g. ?feature=shared&v=ID)
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (ytMatch) {
    // Use youtube-nocookie.com — privacy-enhanced mode, no tracking cookies until play
    let embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    // Preserve timestamp if present (?t= or &t=)
    const timeMatch = url.match(/[?&]t=(\d+)/);
    if (timeMatch) embedUrl += `?start=${timeMatch[1]}`;
    return embedUrl;
  }

  // Vimeo — captures optional private hash (e.g. vimeo.com/123456789/abcdef)
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (vimeoMatch) {
    let embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    if (vimeoMatch[2]) embedUrl += `?h=${vimeoMatch[2]}`;
    return embedUrl;
  }

  return "";
}
