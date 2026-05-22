"use client";

import { FileAttachment } from "@/types";
import { File as FileIcon, Download } from "lucide-react";

interface FileAttachmentListProps {
  attachments: FileAttachment[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentList({ attachments }: FileAttachmentListProps) {
  if (!attachments?.length) return null;

  return (
    <div className="space-y-2">
      {attachments.map((file) => (
        <a
          key={file.id}
          href={file.storageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors group"
        >
          <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.fileName}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.fileSize)}</p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
      ))}
    </div>
  );
}
