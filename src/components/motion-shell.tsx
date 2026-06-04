"use client";

import { motion } from "framer-motion";

export function MotionShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
      {children}
    </motion.main>
  );
}
