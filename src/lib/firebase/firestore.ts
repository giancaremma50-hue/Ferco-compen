"use client";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { app } from "./config";
import { Stage, NotificationType, UserProfile } from "@/types";
import { nanoid } from "nanoid";

// Lazy: same reasoning as auth.ts — only initialize in the browser.
export const db = (typeof window !== "undefined" ? getFirestore(app) : null) as ReturnType<typeof getFirestore>;

// Collection refs
export const usersCol = () => collection(db, "users");
export const requestsCol = () => collection(db, "requests");
export const commentsCol = (requestId: string) =>
  collection(db, "requests", requestId, "comments");
export const notificationsCol = () => collection(db, "notifications");

// Helper: get all admin UIDs dynamically
export async function getAdminUids(): Promise<string[]> {
  const q = query(usersCol(), where("role", "==", "administrador"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}

// Generate request number
export function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const code = nanoid(6).toUpperCase();
  return `COMP-${year}-${code}`;
}

// Fan-out: create notifications atomically with the triggering write
export async function createNotifications(
  batch: ReturnType<typeof writeBatch>,
  recipientIds: string[],
  payload: {
    type: NotificationType;
    requestId: string;
    requestNumber: string;
    requestTitle: string;
    fromUserId: string;
    fromUserName: string;
    newStage?: Stage;
    commentPreview?: string;
  }
) {
  for (const recipientId of recipientIds) {
    const notifRef = doc(notificationsCol());
    batch.set(notifRef, {
      ...payload,
      recipientId,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
}

// Mark notification as read
export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(notificationsCol(), notificationId), { read: true });
}

// Mark all notifications as read for a user
export async function markAllNotificationsRead(userId: string) {
  const q = query(
    notificationsCol(),
    where("recipientId", "==", userId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// Update request stage with notification fan-out
export async function updateRequestStage(
  requestId: string,
  newStage: Stage,
  request: { createdBy: string; requestNumber: string; detalleMovimiento: string },
  changedBy: { uid: string; displayName: string }
) {
  const batch = writeBatch(db);
  const requestRef = doc(requestsCol(), requestId);

  batch.update(requestRef, {
    stage: newStage,
    stageChangedAt: serverTimestamp(),
    stageChangedBy: changedBy.uid,
    updatedAt: serverTimestamp(),
  });

  await createNotifications(batch, [request.createdBy], {
    type: "stage_changed",
    requestId,
    requestNumber: request.requestNumber,
    requestTitle: request.detalleMovimiento,
    fromUserId: changedBy.uid,
    fromUserName: changedBy.displayName,
    newStage,
  });

  await batch.commit();
}

// Add comment with counter increment and notification
export async function addComment(
  requestId: string,
  content: string,
  author: UserProfile,
  request: { createdBy: string; requestNumber: string; detalleMovimiento: string },
  parentId: string | null = null,
  parentAuthorId?: string
) {
  const batch = writeBatch(db);
  const commentRef = doc(commentsCol(requestId));
  const requestRef = doc(requestsCol(), requestId);

  batch.set(commentRef, {
    requestId,
    content,
    authorId: author.uid,
    authorName: author.displayName,
    authorRole: author.role,
    parentId,
    createdAt: serverTimestamp(),
  });

  batch.update(requestRef, {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  const adminUids = await getAdminUids();
  const preview = content.slice(0, 120);

  if (parentId && parentAuthorId && parentAuthorId !== author.uid) {
    await createNotifications(batch, [parentAuthorId], {
      type: "comment_replied",
      requestId,
      requestNumber: request.requestNumber,
      requestTitle: request.detalleMovimiento,
      fromUserId: author.uid,
      fromUserName: author.displayName,
      commentPreview: preview,
    });
  } else if (author.role === "colaborador") {
    const recipients = adminUids.filter((uid) => uid !== author.uid);
    await createNotifications(batch, recipients, {
      type: "new_comment",
      requestId,
      requestNumber: request.requestNumber,
      requestTitle: request.detalleMovimiento,
      fromUserId: author.uid,
      fromUserName: author.displayName,
      commentPreview: preview,
    });
  } else {
    const recipients = [request.createdBy].filter((uid) => uid !== author.uid);
    await createNotifications(batch, recipients, {
      type: "new_comment",
      requestId,
      requestNumber: request.requestNumber,
      requestTitle: request.detalleMovimiento,
      fromUserId: author.uid,
      fromUserName: author.displayName,
      commentPreview: preview,
    });
  }

  await batch.commit();
}

export { writeBatch, serverTimestamp, doc, collection, query, where, orderBy, getDoc, addDoc, updateDoc, increment };
