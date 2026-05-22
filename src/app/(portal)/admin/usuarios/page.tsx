"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDocs,
  query,
  orderBy,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  getAuth,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { usersCol, db } from "@/lib/firebase/firestore";
import { UserProfile, Role } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, UserPlus, Loader2, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function AdminUsuariosPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("colaborador");
  const [area, setArea] = useState("");
  const [cargo, setCargo] = useState("");
  const [managerId, setManagerId] = useState<string>("");

  const loadUsers = useCallback(async () => {
    const snap = await getDocs(query(usersCol(), orderBy("displayName")));
    setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role !== "administrador") {
      router.replace(ROUTES.DASHBOARD);
      return;
    }
    loadUsers();
  }, [userProfile, router, loadUsers]);

  function resetForm() {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setRole("colaborador");
    setArea("");
    setCargo("");
    setManagerId("");
  }

  async function handleCreateUser() {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      toast.error("Nombre, correo y contraseña son obligatorios");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setCreating(true);

    // Secondary Firebase app so the admin stays signed in
    const secondaryApp = initializeApp(
      {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      },
      `secondary-${Date.now()}`
    );
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password
      );
      await updateProfile(cred.user, { displayName: displayName.trim() });

      // Resolve manager name from selected UID
      const selectedManager = managerId
        ? users.find((u) => u.uid === managerId)
        : null;

      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role,
        area: area.trim(),
        cargo: cargo.trim(),
        managerId: selectedManager?.uid ?? null,
        managerName: selectedManager?.displayName ?? null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      toast.success(`Usuario "${displayName.trim()}" creado`);
      setOpen(false);
      resetForm();
      loadUsers();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        toast.error("Ese correo ya está registrado");
      } else {
        toast.error("Error al crear el usuario");
        console.error(err);
      }
    } finally {
      await firebaseSignOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de acceso al portal
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Crear usuario
        </Button>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
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
                  Jefe directo
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
                              : "hsl(var(--muted-foreground))",
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
                    <p className="font-medium">{user.area || "—"}</p>
                    <p className="text-xs text-muted-foreground">{user.cargo || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {user.managerName ? (
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm">{user.managerName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.role === "administrador" ? "default" : "secondary"}
                      style={
                        user.role === "administrador"
                          ? { backgroundColor: "var(--gold)", color: "white", border: "none" }
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
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Sin usuarios registrados</p>
              <p className="text-xs mt-1">Haz clic en &quot;Crear usuario&quot; para agregar el primero.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Create user dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>
              El usuario podrá iniciar sesión inmediatamente con las credenciales que definas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre completo *</Label>
              <Input
                placeholder="Ana García"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Correo *</Label>
                <Input
                  type="email"
                  placeholder="ana@ferco.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Contraseña *</Label>
                <Input
                  type="password"
                  placeholder="Mín. 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Área</Label>
                <Input
                  placeholder="Recursos Humanos"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Cargo</Label>
                <Input
                  placeholder="Gerente"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Rol *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={creating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Jefe directo</Label>
                <Select
                  value={managerId}
                  onValueChange={(v) => setManagerId(!v || v === "none" ? "" : v)}
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin jefe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin jefe directo</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.uid} value={u.uid}>
                        {u.displayName}
                        {u.cargo ? ` · ${u.cargo}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setOpen(false); resetForm(); }}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" />Crear</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
