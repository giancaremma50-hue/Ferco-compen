"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/firestore";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, CheckCircle2, LogIn, Users, GitBranch } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Role } from "@/types";
import Image from "next/image";
import { ROUTES } from "@/constants/routes";

interface CreatedUser {
  uid: string;           // needed so children can reference this as managerId
  displayName: string;
  email: string;
  role: Role;
}

export default function SetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("colaborador");
  const [area, setArea] = useState("");
  const [cargo, setCargo] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedUser[]>([]);

  async function handleCreate() {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      toast.error("Nombre, correo y contraseña son obligatorios");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });

      const selectedManager = managerId
        ? created.find((u) => u.uid === managerId)
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

      // Sign out so next user can be created with a fresh auth state
      await signOut(auth);

      setCreated((prev) => [
        ...prev,
        { uid: cred.user.uid, displayName: displayName.trim(), email: email.trim(), role },
      ]);

      // Reset form
      setDisplayName("");
      setEmail("");
      setPassword("");
      setRole("colaborador");
      setArea("");
      setCargo("");
      setManagerId("");

      toast.success(`Usuario "${displayName.trim()}" creado exitosamente`);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        toast.error("Ese correo ya está registrado");
      } else if (code === "auth/weak-password") {
        toast.error("La contraseña debe tener al menos 6 caracteres");
      } else {
        toast.error("Error al crear el usuario. Intenta de nuevo.");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-12 px-4">
      {/* Logo */}
      <div className="mb-8">
        <Image src="/logo-negro.png" alt="Ferco Cerámica" width={160} height={48} className="object-contain dark:hidden" priority />
        <Image src="/logo-blanca.png" alt="Ferco Cerámica" width={160} height={48} className="object-contain hidden dark:block" priority />
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Configuración inicial</h1>
          <p className="text-sm text-muted-foreground">
            Crea los usuarios del portal. Puedes agregar tantos como necesites antes de iniciar sesión.
          </p>
        </div>

        {/* Created users list */}
        <AnimatePresence>
          {created.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                Usuarios creados ({created.length})
              </div>
              {created.map((u, i) => (
                <motion.div
                  key={u.uid}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <Badge
                    variant={u.role === "administrador" ? "default" : "secondary"}
                    style={u.role === "administrador" ? { backgroundColor: "var(--gold)", color: "white", border: "none" } : {}}
                  >
                    {u.role === "administrador" ? "Admin" : "Colaborador"}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">
            Nuevo usuario
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Nombre completo *</Label>
              <Input placeholder="Ana García" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Correo electrónico *</Label>
              <Input type="email" placeholder="ana@ferco.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Contraseña *</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Área</Label>
              <Input placeholder="Recursos Humanos" value={area} onChange={(e) => setArea(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Cargo</Label>
              <Input placeholder="Gerente de RR.HH." value={cargo} onChange={(e) => setCargo(e.target.value)} disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Rol *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador — puede mover solicitudes y ver todo</SelectItem>
                  <SelectItem value="colaborador">Colaborador — puede crear solicitudes y comentar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Jefe directo — populated from already-created users */}
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Jefe directo
              </Label>
              <Select
                value={managerId}
                onValueChange={(v) => setManagerId(!v || v === "none" ? "" : v)}
                disabled={loading || created.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={created.length === 0 ? "Crea más usuarios primero" : "Sin jefe directo"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin jefe directo</SelectItem>
                  {created.map((u) => (
                    <SelectItem key={u.uid} value={u.uid}>
                      {u.displayName} · {u.role === "administrador" ? "Admin" : "Colaborador"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full" onClick={handleCreate} disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creando usuario...</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" />Crear usuario</>
            )}
          </Button>
        </div>

        {/* Go to login */}
        {created.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button variant="outline" className="w-full" onClick={() => router.push(ROUTES.LOGIN)}>
              <LogIn className="h-4 w-4 mr-2" />
              Listo — ir al login
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Inicia sesión con cualquiera de los usuarios que acabas de crear.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
