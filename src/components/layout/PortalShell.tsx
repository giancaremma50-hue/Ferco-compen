"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Shell } from "./Shell";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGuard>
      <Shell>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </Shell>
    </AuthGuard>
  );
}
