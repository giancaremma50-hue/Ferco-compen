"use client";

import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  compact?: boolean;
}

export function CommentInput({
  onSubmit,
  placeholder = "Escribe un comentario... (Enter para enviar, Shift+Enter para nueva línea)",
  compact = false,
}: CommentInputProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await onSubmit(trimmed);
      setValue("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PromptInput
      value={value}
      onValueChange={setValue}
      onSubmit={handleSubmit}
      isLoading={loading}
      maxHeight={compact ? 120 : 200}
      className={compact ? "rounded-xl" : ""}
    >
      <PromptInputTextarea placeholder={placeholder} />
      <PromptInputActions className="justify-end pt-1.5 px-1">
        <PromptInputAction tooltip="Enviar comentario">
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSubmit}
            disabled={!value.trim() || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}
