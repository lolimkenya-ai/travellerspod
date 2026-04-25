import { supabase } from "@/integrations/supabase/client";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_IMAGES_PER_POST = 10;

/** Capture a single video poster frame at ~1s and return as a Blob. */
export async function captureVideoPoster(videoFile: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(videoFile);
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.crossOrigin = "anonymous";
    const cleanup = () => URL.revokeObjectURL(url);
    v.onloadedmetadata = () => {
      const target = Math.min(1, v.duration / 4);
      v.currentTime = target;
      v.onseeked = () => {
        const c = document.createElement("canvas");
        const w = v.videoWidth || 720;
        const h = v.videoHeight || 1280;
        const scale = Math.min(720 / w, 1);
        c.width = Math.round(w * scale);
        c.height = Math.round(h * scale);
        const ctx = c.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(
          (b) => {
            cleanup();
            resolve(b);
          },
          "image/jpeg",
          0.78,
        );
      };
    };
    v.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}

export async function uploadToBucket(
  bucket: string,
  userId: string,
  file: Blob,
  ext: string,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
