import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUp } from "lucide-react";

const schema = z.object({
  question: z.string().min(1).max(2000),
});
type FormData = z.infer<typeof schema>;

interface MessageInputProps {
  onSend: (question: string) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSend, disabled }: MessageInputProps) => {
  const { register, handleSubmit, reset, formState: { isValid } } = useForm<FormData>({
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
      className="flex items-center gap-2.5 px-4 py-3 border-t border-white/[0.06] bg-ps-bg shrink-0"
    >
      <input
        {...register("question")}
        onKeyDown={handleKeyDown}
        placeholder="Ask about this page…"
        disabled={disabled}
        autoComplete="off"
        className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none disabled:opacity-40 caret-ps-accent"
      />
      <button
        type="submit"
        disabled={disabled || !isValid}
        className="h-7 w-7 rounded-full bg-ps-accent flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
      >
        <ArrowUp size={13} className="text-ps-bg" strokeWidth={2.5} />
      </button>
    </form>
  );
};
