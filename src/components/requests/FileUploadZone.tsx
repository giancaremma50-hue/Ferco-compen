"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, File as FileIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadZone({
  files,
  onFilesChange,
  maxFiles = 10,
  maxSizeMB = 20,
}: FileUploadZoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const combined = [...files, ...accepted].slice(0, maxFiles);
      onFilesChange(combined);
    },
    [files, maxFiles, onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: maxFiles - files.length,
    maxSize: maxSizeMB * 1024 * 1024,
  });

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors duration-200",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload
          className={cn(
            "h-8 w-8 mb-2 transition-colors",
            isDragActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? (
            "Suelta los archivos aquí"
          ) : (
            <>
              <span className="font-medium text-foreground">Haz clic</span> o
              arrastra archivos aquí
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Máximo {maxFiles} archivos · {maxSizeMB} MB cada uno
        </p>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
