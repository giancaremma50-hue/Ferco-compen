"use client";

import { useEffect, useState } from "react";
import { getDocs, query, orderBy } from "firebase/firestore";
import { usersCol } from "@/lib/firebase/firestore";
import { UserProfile } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

export default function AdminUsuariosPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== "administrador") {
      router.replace(ROUTES.DASHBOARD);
      return;
    }

    getDocs(query(usersCol(), orderBy("displayName"))).then((snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    });
  }, [userProfile, router]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de acceso al portal
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Correo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Área / Cargo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Rol
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{
                          backgroundColor:
                            user.role === "administrador"
                              ? "var(--gold)"
                              : "var(--muted-foreground)",
                        }}
                      >
                        {user.displayName
                          ?.split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <span className="font-medium">{user.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.area}</p>
                    <p className="text-xs text-muted-foreground">{user.cargo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.role === "administrador" ? "default" : "secondary"}
                      className={
                        user.role === "administrador"
                          ? "text-white border-transparent"
                          : ""
                      }
                      style={
                        user.role === "administrador"
                          ? { backgroundColor: "var(--gold)" }
                          : {}
                      }
                    >
                      {user.role === "administrador" ? "Administrador" : "Colaborador"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Sin usuarios registrados</p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Los usuarios se crean desde Firebase Console. Crea una cuenta con email/contraseña y agrega el documento en{" "}
        <code className="bg-muted px-1 rounded">users/&#123;uid&#125;</code> con el campo{" "}
        <code className="bg-muted px-1 rounded">role</code>.
      </p>
    </div>
  );
}
