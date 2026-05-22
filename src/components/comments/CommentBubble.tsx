"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { Comment } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { CommentInput } from "./CommentInput";

interface CommentBubbleProps {
  comment: Comment;
  replies: Comment[];
  onReply: (content: string, parentId: string) => Promise<void>;
  requestId: string;
  requestNumber: string;
  requestTitle: string;
  createdBy: string;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "Hace un momento";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function CommentBubble({
  comment,
  replies,
  onReply,
  requestId,
  requestNumber,
  requestTitle,
  createdBy,
}: CommentBubbleProps) {
  const { userProfile } = useAuth();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const isOwn = userProfile?.uid === comment.authorId;

  const date = comment.createdAt?.toDate?.();

  return (
    <div className="space-y-2">
      {/* Main comment */}
      <div className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
        {/* Avatar */}
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
            comment.authorRole === "administrador"
              ? "text-white"
              : "bg-muted text-muted-foreground"
          )}
          style={
            comment.authorRole === "administrador"
              ? { backgroundColor: "var(--gold)" }
              : {}
          }
        >
          {comment.authorName
            ?.split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </div>

        {/* Bubble */}
        <div className={cn("flex flex-col gap-1 max-w-[75%]", isOwn && "items-end")}>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-foreground">
              {comment.authorName}
            </span>
            {comment.authorRole === "administrador" && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ color: "var(--gold)", backgroundColor: "color-mix(in srgb, var(--gold) 10%, transparent)" }}
              >
                Admin
              </span>
            )}
            {date && (
              <span className="text-xs text-muted-foreground">{timeAgo(date)}</span>
            )}
          </div>

          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              isOwn
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted text-foreground rounded-tl-sm"
            )}
          >
            {comment.content}
          </div>

          {/* Reply button */}
          <button
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <MessageSquare className="h-3 w-3" />
            Responder
          </button>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 space-y-2 border-l-2 border-muted pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  reply.authorRole === "administrador"
                    ? "text-white"
                    : "bg-muted text-muted-foreground"
                )}
                style={
                  reply.authorRole === "administrador"
                    ? { backgroundColor: "var(--gold)" }
                    : {}
                }
              >
                {reply.authorName
                  ?.split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{reply.authorName}</span>
                  {reply.createdAt?.toDate?.() && (
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(reply.createdAt.toDate())}
                    </span>
                  )}
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
                  {reply.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <AnimatePresence>
        {showReplyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-11 overflow-hidden"
          >
            <CommentInput
              placeholder={`Responder a ${comment.authorName}...`}
              onSubmit={async (content) => {
                await onReply(content, comment.id);
                setShowReplyInput(false);
              }}
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
