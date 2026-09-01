import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { SEVERITY_LABEL, STATUS_LABEL } from "@/lib/errors/status-labels";
import type { Database } from "@/lib/supabase/database.types";

type Item = {
  id: string;
  code: string;
  title: string;
  status: Database["public"]["Enums"]["error_status"];
  createdAt: string;
  severity?: Database["public"]["Enums"]["error_severity"];
};

export function ErrorReportListItem({ item, href }: { item: Item; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 text-sm last:border-b-0 hover:bg-background"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {item.code} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {item.severity && (
          <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
            {SEVERITY_LABEL[item.severity]}
          </span>
        )}
        <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
          {STATUS_LABEL[item.status]}
        </span>
      </div>
    </Link>
  );
}
