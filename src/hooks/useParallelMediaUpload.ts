import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UploadProgress {
  fileIndex: number;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  url?: string;
}

interface UploadOptions {
  maxConcurrent?: number;
  bucket?: string;
}

/**
 * Hook for uploading multiple media files in parallel
 * Replaces sequential uploads with concurrent uploads for better performance
 */
export function useParallelMediaUpload(options: UploadOptions = {}) {
  const { maxConcurrent = 3, bucket = "post-media" } = options;
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<string[]> => {
      if (!user) throw new Error("Not authenticated");

      setIsUploading(true);
      const initialProgress: UploadProgress[] = files.map((file, index) => ({
        fileIndex: index,
        fileName: file.name,
        progress: 0,
        status: "pending",
      }));
      setUploadProgress(initialProgress);

      const uploadedUrls: (string | undefined)[] = new Array(files.length);
      const uploadQueue = files.map((file, index) => ({
        file,
        index,
      }));

      // Process uploads in batches based on maxConcurrent
      for (let i = 0; i < uploadQueue.length; i += maxConcurrent) {
        const batch = uploadQueue.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(({ file, index }) =>
          uploadSingleFile(file, index, user.id)
            .then((url) => {
              uploadedUrls[index] = url;
              setUploadProgress((prev) =>
                prev.map((p) =>
                  p.fileIndex === index
                    ? { ...p, status: "completed", progress: 100, url }
                    : p
                )
              );
            })
            .catch((error) => {
              setUploadProgress((prev) =>
                prev.map((p) =>
                  p.fileIndex === index
                    ? {
                        ...p,
                        status: "error",
                        error: error.message,
                      }
                    : p
                )
              );
            })
        );

        await Promise.all(batchPromises);
      }

      setIsUploading(false);

      // Filter out undefined values (failed uploads)
      const successfulUrls = uploadedUrls.filter(
        (url): url is string => url !== undefined
      );

      if (successfulUrls.length === 0) {
        throw new Error("All uploads failed");
      }

      return successfulUrls;
    },
    [user, maxConcurrent]
  );

  return {
    uploadFiles,
    uploadProgress,
    isUploading,
  };
}

/**
 * Helper function to upload a single file
 */
async function uploadSingleFile(
  file: File,
  index: number,
  userId: string
): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${userId}/${timestamp}-${index}-${file.name}`;

  const { data, error } = await supabase.storage
    .from("post-media")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("post-media")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Hook for uploading video with poster generation
 */
export function useVideoUploadWithPoster() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadVideo = useCallback(
    async (videoFile: File, posterFile?: File): Promise<{ videoUrl: string; posterUrl?: string }> => {
      if (!user) throw new Error("Not authenticated");

      setIsUploading(true);
      setProgress(0);

      try {
        // Upload video
        const timestamp = Date.now();
        const videoFileName = `${user.id}/${timestamp}-video-${videoFile.name}`;

        const { data: videoData, error: videoError } = await supabase.storage
          .from("post-media")
          .upload(videoFileName, videoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (videoError) throw videoError;

        setProgress(50);

        const { data: videoUrlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(videoData.path);

        const videoUrl = videoUrlData.publicUrl;

        // Upload poster if provided
        let posterUrl: string | undefined;
        if (posterFile) {
          const posterFileName = `${user.id}/${timestamp}-poster-${posterFile.name}`;

          const { data: posterData, error: posterError } = await supabase.storage
            .from("post-media")
            .upload(posterFileName, posterFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (posterError) throw posterError;

          const { data: posterUrlData } = supabase.storage
            .from("post-media")
            .getPublicUrl(posterData.path);

          posterUrl = posterUrlData.publicUrl;
        }

        setProgress(100);
        return { videoUrl, posterUrl };
      } finally {
        setIsUploading(false);
      }
    },
    [user]
  );

  return {
    uploadVideo,
    isUploading,
    progress,
  };
}
