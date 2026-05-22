// Server Component — can export route segment config
export const dynamic = "force-dynamic";

import { PortalShell } from "@/components/layout/PortalShell";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
