"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/firebase/storage";
import { FileAttachment } from "@/types";
import { Timestamp } from "firebase/firestore";
import { nanoid } from "nanoid";

export function useFileUpload(requestId: string, userId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function uploadFiles(files: File[]): Promise<FileAttachment[]> {
    setUploading(true);
    const results: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round(((i + 1) / files.length) * 100));
      const { storageUrl } = await uploadFile(file, requestId, userId);
      results.push({
        id: nanoid(),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storageUrl,
        uploadedBy: userId,
        uploadedAt: Timestamp.now(),
      });
    }

    setUploading(false);
    setProgress(0);
    return results;
  }

  return { uploadFiles, uploading, progress };
}
