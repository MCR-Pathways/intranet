import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processUploadedImage } from "./image-pipeline";

/**
 * Generate a tiny valid PNG buffer.
 * 1x1 pixel red, no metadata.
 */
async function makePng(): Promise<Buffer> {
  return await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(opts?: { width?: number; height?: number }): Promise<Buffer> {
  return await sharp({
    create: {
      width: opts?.width ?? 200,
      height: opts?.height ?? 100,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function makeGif(): Promise<Buffer> {
  return await sharp({
    create: {
      width: 50,
      height: 50,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 1 },
    },
  })
    .gif()
    .toBuffer();
}

describe("processUploadedImage", () => {
  describe("standard images", () => {
    it("processes a JPEG and returns dimensions", async () => {
      const buf = await makeJpeg({ width: 300, height: 200 });
      const result = await processUploadedImage(buf, "image/jpeg", "photo.jpg");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("image/jpeg");
        expect(result.width).toBe(300);
        expect(result.height).toBe(200);
      }
    });

    it("processes a PNG and returns dimensions", async () => {
      const buf = await makePng();
      const result = await processUploadedImage(buf, "image/png", "img.png");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("image/png");
        expect(result.width).toBe(10);
        expect(result.height).toBe(10);
      }
    });

    it("strips EXIF metadata from JPEG", async () => {
      // Create a JPEG with fake EXIF data
      const buf = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .withMetadata({ exif: { IFD0: { Copyright: "TEST_COPYRIGHT" } } })
        .jpeg()
        .toBuffer();

      const inMeta = await sharp(buf).metadata();
      expect(inMeta.exif).toBeDefined();

      const result = await processUploadedImage(buf, "image/jpeg", "tagged.jpg");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const outMeta = await sharp(result.buffer).metadata();
        expect(outMeta.exif).toBeUndefined();
      }
    });
  });

  describe("animated images", () => {
    it("preserves animated GIF mime type", async () => {
      const buf = await makeGif();
      const result = await processUploadedImage(buf, "image/gif", "anim.gif");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("image/gif");
      }
    });

    it("routes WebP through the animated pipeline (preserves frames)", async () => {
      // We can't easily synthesise an animated WebP in-memory via Sharp's
      // create API — animated WebP requires a real multi-frame source.
      // Instead, verify the routing: a WebP input produces a WebP output via
      // the animated path. Per Sharp docs, `sharp(buf, { animated: true })`
      // on a static WebP is a no-op (pages: 1), so this works for both.
      const webp = await sharp({
        create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 0, b: 255 } },
      })
        .webp()
        .toBuffer();

      const result = await processUploadedImage(webp, "image/webp", "img.webp");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("image/webp");
        const outMeta = await sharp(result.buffer, { animated: true }).metadata();
        expect(outMeta.format).toBe("webp");
      }
    });

    it("treats static WebP correctly (degenerate animated case)", async () => {
      const webp = await sharp({
        create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 0, b: 255 } },
      })
        .webp()
        .toBuffer();

      const result = await processUploadedImage(webp, "image/webp", "static.webp");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("image/webp");
        expect(result.width).toBe(100);
      }
    });
  });

  describe("camera RAW rejection", () => {
    it.each(["photo.cr2", "photo.cr3", "photo.nef", "photo.arw", "photo.raf"])(
      "rejects %s with friendly error",
      async (fileName) => {
        const buf = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
        const result = await processUploadedImage(
          buf,
          "application/octet-stream",
          fileName,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toMatch(/Camera RAW/);
          expect(result.error).toMatch(/JPEG/);
        }
      },
    );

    it("rejects RAW regardless of MIME type sent by browser", async () => {
      const buf = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
      const result = await processUploadedImage(
        buf,
        "image/jpeg", // browser claims JPEG but extension says CR2
        "shot.cr2",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Camera RAW/);
    });
  });

  describe("magic byte validation", () => {
    it("rejects HTML masquerading as PNG", async () => {
      const buf = Buffer.from("<html><body>nope</body></html>");
      const result = await processUploadedImage(buf, "image/png", "evil.png");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/doesn't match/);
      }
    });

    it("rejects mismatched JPEG magic bytes", async () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
      const result = await processUploadedImage(buf, "image/jpeg", "fake.jpg");
      expect(result.ok).toBe(false);
    });
  });

  describe("documents", () => {
    it("passes PDF through unchanged", async () => {
      const buf = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(50)]);
      const result = await processUploadedImage(buf, "application/pdf", "doc.pdf");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("application/pdf");
        expect(result.buffer).toBe(buf);
        expect(result.width).toBeNull();
        expect(result.height).toBeNull();
      }
    });

    it("passes DOCX through unchanged (no magic-byte check for ZIP archives)", async () => {
      const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP signature
      const result = await processUploadedImage(
        buf,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc.docx",
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("unsupported types", () => {
    it("rejects unknown MIME types", async () => {
      const buf = Buffer.from("anything");
      const result = await processUploadedImage(buf, "video/mp4", "movie.mp4");
      expect(result.ok).toBe(false);
    });
  });
});
