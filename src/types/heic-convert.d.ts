declare module "heic-convert" {
  interface HeicConvertOptions {
    buffer: ArrayBufferLike | Uint8Array | Buffer;
    /** Output format. JPEG is universally supported; PNG is also available. */
    format: "JPEG" | "PNG";
    /** 0–1, only meaningful for JPEG. */
    quality?: number;
  }

  /**
   * Convert a HEIC/HEIF buffer to JPEG or PNG using a pure-JS HEVC decoder.
   * Returns an ArrayBuffer of the encoded output.
   *
   * Sharp can't decode HEIC — its prebuilt libheif lacks the HEVC plugin
   * (patent-encumbered). heic-convert handles the decode step in pure JS,
   * then Sharp takes over for post-processing (rotate, strip EXIF, etc.).
   */
  function heicConvert(options: HeicConvertOptions): Promise<ArrayBuffer>;

  export = heicConvert;
}
