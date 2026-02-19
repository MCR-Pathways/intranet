import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock strategy for upload actions:
 * - All actions use requireLDAdmin() → { supabase, user }
 * - supabase.storage.from(bucket).upload/getPublicUrl/remove for file ops
 * - supabase.from("lesson_images").select/insert/delete for DB ops
 *
 * We mock @/lib/auth to control the returned supabase + user objects.
 */

const mockFrom = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() => vi.fn());
const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockStorageGetPublicUrl = vi.hoisted(() => vi.fn());
const mockStorageRemove = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockLimit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireLDAdmin: vi.fn().mockResolvedValue({
    supabase: {
      from: mockFrom,
      storage: { from: mockStorageFrom },
    },
    user: { id: "admin-1", email: "admin@mcrpathways.org" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  uploadCourseVideo,
  uploadLessonImage,
  deleteLessonImage,
} from "@/app/(protected)/learning/admin/courses/actions";
import { requireLDAdmin } from "@/lib/auth";

function createFormData(entries: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(entries)) {
    fd.set(key, val);
  }
  return fd;
}

function createFile(
  name: string,
  type: string,
  sizeBytes: number
): File {
  // Create a file of the specified size
  const content = new Uint8Array(Math.min(sizeBytes, 100)); // Don't actually allocate huge buffers
  const file = new File([content], name, { type });
  // Override size for testing
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

describe("Upload Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Wire storage chain
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.test/file.mp4" },
    });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
      remove: mockStorageRemove,
    });

    // Wire DB chains for lesson_images
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ single: mockSingle, order: mockOrder });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    });
  });

  // ===========================================
  // uploadCourseVideo
  // ===========================================

  describe("uploadCourseVideo", () => {
    it("throws when requireLDAdmin rejects", async () => {
      vi.mocked(requireLDAdmin).mockRejectedValueOnce(
        new Error("Not authenticated")
      );

      const fd = createFormData({
        file: createFile("video.mp4", "video/mp4", 1000),
        courseId: "course-1",
      });

      await expect(uploadCourseVideo(fd)).rejects.toThrow("Not authenticated");
    });

    it("returns error when no file provided", async () => {
      const fd = createFormData({ courseId: "course-1" });

      const result = await uploadCourseVideo(fd);

      expect(result).toEqual({
        success: false,
        error: "No file provided",
        url: null,
        storagePath: null,
      });
    });

    it("returns error when no courseId provided", async () => {
      const fd = createFormData({
        file: createFile("video.mp4", "video/mp4", 1000),
      });

      const result = await uploadCourseVideo(fd);

      expect(result).toEqual({
        success: false,
        error: "No course ID provided",
        url: null,
        storagePath: null,
      });
    });

    it("rejects files larger than 50MB", async () => {
      const fd = createFormData({
        file: createFile("big.mp4", "video/mp4", 52428801),
        courseId: "course-1",
      });

      const result = await uploadCourseVideo(fd);

      expect(result.success).toBe(false);
      expect(result.error).toContain("50MB");
    });

    it("rejects invalid MIME types", async () => {
      const fd = createFormData({
        file: createFile("doc.txt", "text/plain", 1000),
        courseId: "course-1",
      });

      const result = await uploadCourseVideo(fd);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video type");
    });

    it("uploads valid mp4 and returns url and storagePath", async () => {
      const fd = createFormData({
        file: createFile("lecture.mp4", "video/mp4", 5000000),
        courseId: "course-1",
      });

      const result = await uploadCourseVideo(fd);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://storage.test/file.mp4");
      expect(result.storagePath).toMatch(/^admin-1\/.+\.mp4$/);
      expect(mockStorageFrom).toHaveBeenCalledWith("course-videos");
      expect(mockStorageUpload).toHaveBeenCalled();
    });

    it("accepts video/webm files", async () => {
      const fd = createFormData({
        file: createFile("screen.webm", "video/webm", 5000000),
        courseId: "course-1",
      });

      const result = await uploadCourseVideo(fd);

      expect(result.success).toBe(true);
    });

    it("returns error on storage upload failure", async () => {
      mockStorageUpload.mockResolvedValue({
        error: { message: "Storage quota exceeded" },
      });

      const fd = createFormData({
        file: createFile("video.mp4", "video/mp4", 1000),
        courseId: "course-1",
      });

      const result = await uploadCourseVideo(fd);

      expect(result).toEqual({
        success: false,
        error: "Storage quota exceeded",
        url: null,
        storagePath: null,
      });
    });
  });

  // ===========================================
  // uploadLessonImage
  // ===========================================

  describe("uploadLessonImage", () => {
    it("returns error when no file provided", async () => {
      const fd = createFormData({ lessonId: "l1", courseId: "c1" });

      const result = await uploadLessonImage(fd);

      expect(result).toEqual({
        success: false,
        error: "No file provided",
        image: null,
      });
    });

    it("returns error when missing IDs", async () => {
      const fd = createFormData({
        file: createFile("img.png", "image/png", 1000),
      });

      const result = await uploadLessonImage(fd);

      expect(result).toEqual({
        success: false,
        error: "Missing lesson or course ID",
        image: null,
      });
    });

    it("rejects files larger than 5MB", async () => {
      const fd = createFormData({
        file: createFile("big.png", "image/png", 5242881),
        lessonId: "l1",
        courseId: "c1",
      });

      const result = await uploadLessonImage(fd);

      expect(result.success).toBe(false);
      expect(result.error).toContain("5MB");
    });

    it("rejects invalid MIME types", async () => {
      const fd = createFormData({
        file: createFile("doc.pdf", "application/pdf", 1000),
        lessonId: "l1",
        courseId: "c1",
      });

      const result = await uploadLessonImage(fd);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid image type");
    });

    it("uploads valid png and returns image record", async () => {
      const imageRow = {
        id: "img-1",
        lesson_id: "l1",
        file_name: "diagram.png",
        file_url: "https://storage.test/file.mp4",
        storage_path: "c1/l1/abc.png",
        file_size: 2000,
        mime_type: "image/png",
        sort_order: 0,
        created_at: "2026-01-15T10:00:00Z",
      };

      // Wire insert chain for success
      mockSingle.mockResolvedValue({ data: imageRow, error: null });

      const fd = createFormData({
        file: createFile("diagram.png", "image/png", 2000),
        lessonId: "l1",
        courseId: "c1",
      });

      const result = await uploadLessonImage(fd);

      expect(result.success).toBe(true);
      expect(result.image).toEqual(imageRow);
      expect(mockStorageFrom).toHaveBeenCalledWith("lesson-images");
    });

    it("cleans up uploaded file when DB insert fails", async () => {
      // Make insert fail
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Insert failed" },
      });

      const fd = createFormData({
        file: createFile("img.png", "image/png", 1000),
        lessonId: "l1",
        courseId: "c1",
      });

      const result = await uploadLessonImage(fd);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insert failed");
      // Verify storage cleanup was called
      expect(mockStorageRemove).toHaveBeenCalled();
    });

    it("returns error on storage upload failure", async () => {
      mockStorageUpload.mockResolvedValue({
        error: { message: "Upload failed" },
      });

      const fd = createFormData({
        file: createFile("img.png", "image/png", 1000),
        lessonId: "l1",
        courseId: "c1",
      });

      const result = await uploadLessonImage(fd);

      expect(result).toEqual({
        success: false,
        error: "Upload failed",
        image: null,
      });
    });
  });

  // ===========================================
  // deleteLessonImage
  // ===========================================

  describe("deleteLessonImage", () => {
    it("returns error when image not found", async () => {
      // select().eq().single() returns null
      const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });
      mockFrom.mockReturnValue({ select: selectChain });

      const result = await deleteLessonImage("img-1", "c1");

      expect(result).toEqual({ success: false, error: "Image not found" });
    });

    it("deletes from DB then storage on success", async () => {
      // select().eq().single() returns storage path
      const selectSingle = vi.fn().mockResolvedValue({
        data: { storage_path: "c1/l1/abc.png" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

      // delete().eq() succeeds
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        return { delete: deleteChain };
      });

      const result = await deleteLessonImage("img-1", "c1");

      expect(result).toEqual({ success: true, error: null });
      expect(mockStorageRemove).toHaveBeenCalledWith(["c1/l1/abc.png"]);
    });

    it("returns error on DB delete failure without storage cleanup", async () => {
      // select().eq().single() returns storage path
      const selectSingle = vi.fn().mockResolvedValue({
        data: { storage_path: "c1/l1/abc.png" },
        error: null,
      });
      const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
      const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

      // delete().eq() fails
      const deleteEq = vi.fn().mockResolvedValue({
        error: { message: "Delete failed" },
      });
      const deleteChain = vi.fn().mockReturnValue({ eq: deleteEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: selectChain };
        return { delete: deleteChain };
      });

      const result = await deleteLessonImage("img-1", "c1");

      expect(result).toEqual({ success: false, error: "Delete failed" });
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });
  });
});
