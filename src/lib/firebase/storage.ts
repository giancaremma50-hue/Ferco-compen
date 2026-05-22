"use client";

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from "./config";
import { nanoid } from "nanoid";

// Lazy: same reasoning as auth.ts — only initialize in the browser.
export const storage = (typeof window !== "undefined" ? getStorage(app) : null) as ReturnType<typeof getStorage>;

export async function uploadFile(
  file: File,
  requestId: string,
  userId: string
): Promise<{ storageUrl: string; storagePath: string }> {
  const ext = file.name.split(".").pop();
  const fileName = `${nanoid()}.${ext}`;
  const storagePath = `requests/${requestId}/${userId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const storageUrl = await getDownloadURL(storageRef);

  return { storageUrl, storagePath };
}

export async function deleteFile(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}
