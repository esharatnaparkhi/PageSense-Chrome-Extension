import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

const schema = z.object({
  question: z.string().min(1).max(2000),
});

type FormData = z.infer<typeof schema>;

interface MessageInputProps {
  onSend: (question: string) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSend, disabled }: MessageInputProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { question: "" },
  });

  const onSubmit = (data: FormData) => {
    onSend(data.question.trim());
    reset();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-white shrink-0"
    >
      <input
        {...register("question")}
        onKeyDown={handleKeyDown}
        placeholder="Ask about this page..."
        disabled={disabled}
        autoComplete="off"
        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all duration-150 disabled:opacity-50"
      />
      <Button
        type="submit"
        variant="primary"
        size="icon"
        disabled={disabled || !isValid}
        className="shrink-0"
      >
        <Send size={14} />
      </Button>
    </form>
  );
};
