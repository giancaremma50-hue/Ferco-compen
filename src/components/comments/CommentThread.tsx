"use client";

import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useComments } from "@/hooks/useComments";
import { useAuth } from "@/context/AuthContext";
import { addComment } from "@/lib/firebase/firestore";
import { CommentBubble } from "./CommentBubble";
import { CommentInput } from "./CommentInput";
import { Skeleton } from "@/components/ui/skeleton";

interface CommentThreadProps {
  requestId: string;
  requestNumber: string;
  requestTitle: string;
  createdBy: string;
}

export function CommentThread({
  requestId,
  requestNumber,
  requestTitle,
  createdBy,
}: CommentThreadProps) {
  const { userProfile } = useAuth();
  const { roots, replies, loading } = useComments(requestId);

  async function handleComment(content: string) {
    if (!userProfile) return;
    await addComment(
      requestId,
      content,
      userProfile,
      { createdBy, requestNumber, detalleMovimiento: requestTitle },
      null
    );
  }

  async function handleReply(content: string, parentId: string) {
    if (!userProfile) return;
    const parentComment = roots.find((c) => c.id === parentId) ??
      replies(parentId)[0];
    await addComment(
      requestId,
      content,
      userProfile,
      { createdBy, requestNumber, detalleMovimiento: requestTitle },
      parentId,
      parentComment?.authorId
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comentarios ({roots.length})
      </h3>

      {roots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Sin comentarios aún</p>
          <p className="text-xs">Sé el primero en comentar</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5"
        >
          {roots.map((comment) => (
            <CommentBubble
              key={comment.id}
              comment={comment}
              replies={replies(comment.id)}
              onReply={handleReply}
              requestId={requestId}
              requestNumber={requestNumber}
              requestTitle={requestTitle}
              createdBy={createdBy}
            />
          ))}
        </motion.div>
      )}

      <div className="pt-2">
        <CommentInput onSubmit={handleComment} />
      </div>
    </div>
  );
}
