"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, PlusCircle } from "lucide-react";
import { Request } from "@/types";
import { RequestCard } from "./RequestCard";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

interface RequestCardGridProps {
  requests: Request[];
  loading: boolean;
  showCreator?: boolean;
}

export function RequestCardGrid({
  requests,
  loading,
  showCreator = false,
}: RequestCardGridProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground"
      >
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-medium text-foreground">Sin solicitudes</p>
        <p className="text-sm mt-1">Aún no has creado ninguna solicitud.</p>
        <Link
          href={ROUTES.NUEVA_SOLICITUD}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva solicitud
        </Link>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            showCreator={showCreator}
          />
        ))}
      </div>
    </AnimatePresence>
  );
}
