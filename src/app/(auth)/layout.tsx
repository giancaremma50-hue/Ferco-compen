// Server Component — forces dynamic rendering so Firebase never runs during build
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
