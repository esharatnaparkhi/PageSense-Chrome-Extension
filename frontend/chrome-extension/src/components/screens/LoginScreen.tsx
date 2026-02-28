import React from "react";
import { motion } from "framer-motion";
import { Zap, Loader2 } from "lucide-react";

interface LoginScreenProps {
  onLogin: () => void;
  loading: boolean;
  error: string;
}

export const LoginScreen = ({ onLogin, loading, error }: LoginScreenProps) => (
  <div className="flex flex-col h-full bg-ps-bg overflow-hidden">
    {/* Top zone */}
    <div className="relative flex items-center justify-center bg-ps-surface" style={{ height: "46%" }}>
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 180,
          height: 180,
          background: "radial-gradient(circle, rgba(247,199,31,0.12) 0%, transparent 70%)",
        }}
      />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
        className="relative flex flex-col items-center"
      >
        <div className="mb-4 text-ps-accent">
          <Zap size={42} fill="#F7C71F" strokeWidth={0} />
        </div>
        <span className="text-[11px] font-black tracking-[0.22em] uppercase text-ps-accent">
          PageSense
        </span>
      </motion.div>
      {/* Bottom fade to bg */}
      <div
        className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #0B0B0B)" }}
      />
    </div>

    {/* Bottom content zone */}
    <div className="flex flex-col flex-1 px-6 pt-6 pb-7">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h1 className="text-[22px] font-black text-white tracking-tight leading-tight mb-1">
          Your AI reading<br />assistant
        </h1>
        <p className="text-[12px] text-white/35 mb-6 font-medium">
          Summarize · Ask questions · Compare pages
        </p>
      </motion.div>

      {error && (
        <motion.div
          className="mb-4 px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-xs text-red-400">{error}</p>
        </motion.div>
      )}

      <motion.div
        className="mt-auto"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <button
          onClick={onLogin}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-ps-accent text-ps-bg font-bold text-sm flex items-center justify-center gap-2.5 transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path fill="#0B0B0B" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#0B0B0B" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#0B0B0B" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#0B0B0B" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </motion.div>
    </div>
  </div>
);
