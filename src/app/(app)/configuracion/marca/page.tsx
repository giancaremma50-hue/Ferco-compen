import Image from "next/image";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getOrganization } from "@/lib/organizations/get-organization";
import { BrandingForm } from "@/components/configuracion/branding-form";
import { BrandImageField } from "@/components/configuracion/brand-image-field";

export default async function MarcaPage() {
  const [, organization] = await Promise.all([requireSuperAdmin(), getOrganization()]);

  const org = organization ?? {
    platform_name: "Atrio",
    accent_color: "#1f4d3d",
    logo_url: null,
    logo_dark_url: null,
    login_image_url: null,
    careers_headline: null,
    careers_intro: null,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[560px_1fr]">
      <section className="border border-border bg-card p-6">
        <h2 className="font-serif text-2xl">Identidad visual</h2>
        <p className="mt-1 mb-6 text-[13px] leading-relaxed text-muted-foreground">
          Los cambios se aplican de inmediato para todos al guardar.
        </p>

        <div className="flex flex-col gap-5">
          <BrandImageField
            field="logo_url"
            label="Logo para fondo claro"
            hint="PNG o WebP, mínimo 240 px de ancho"
            currentUrl={org.logo_url}
          />
          <BrandImageField
            field="logo_dark_url"
            label="Logo para fondo oscuro"
            hint="Se usa en el menú flotante y correos"
            currentUrl={org.logo_dark_url}
            dark
          />
          <BrandImageField
            field="login_image_url"
            label="Imagen del inicio de sesión"
            hint="Recomendado 1200 × 1600 px, vertical"
            currentUrl={org.login_image_url}
          />

          <div className="border-t border-border pt-5">
            <BrandingForm
              key={`${org.platform_name}-${org.accent_color}-${org.careers_headline}-${org.careers_intro}`}
              platformName={org.platform_name}
              accentColor={org.accent_color}
              careersHeadline={org.careers_headline}
              careersIntro={org.careers_intro}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Vista previa en vivo</p>
        <div className="grid grid-cols-2 overflow-hidden border border-border" style={{ height: 340 }}>
          <div className="flex flex-col justify-center bg-background p-7">
            <span className="font-serif text-lg">{org.platform_name}</span>
            <p className="mt-6 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Reclutamiento</p>
            <p className="font-serif mt-2 text-2xl leading-tight">Bienvenido de vuelta</p>
          </div>
          <div
            className="relative flex items-end p-7"
            style={{ backgroundColor: org.accent_color }}
          >
            {org.login_image_url && (
              <Image src={org.login_image_url} alt="" fill className="object-cover" />
            )}
            <p className="font-serif relative z-10 text-[19px] leading-snug text-white">
              Contratar bien es la decisión más cara que toma una empresa.
            </p>
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="mb-3.5 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
            Cómo se ven los componentes con este acento
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex h-[38px] items-center rounded-md px-4.5 text-[13px] font-medium text-white"
              style={{ backgroundColor: org.accent_color }}
            >
              Botón primario
            </span>
            <span className="inline-flex h-[38px] items-center rounded-md border border-border bg-background px-4.5 text-[13px]">
              Secundario
            </span>
            <span
              className="inline-flex h-[26px] items-center rounded-sm border px-2.5 text-xs"
              style={{ borderColor: org.accent_color, color: org.accent_color }}
            >
              Etiqueta activa
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
