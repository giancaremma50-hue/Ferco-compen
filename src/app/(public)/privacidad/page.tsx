import type { Metadata } from "next";
import Link from "next/link";
import { getOrganization } from "@/lib/organizations/get-organization";
import {
  ENCARGADOS,
  POLITICA_ES_BORRADOR,
  POLITICA_VERSION,
  POLITICA_VIGENCIA,
  RESPONSABLE,
} from "@/lib/legal/policy";

export const metadata: Metadata = {
  title: "Política de privacidad y tratamiento de datos",
  // Un borrador no debería indexarse en buscadores. Cuando deje de serlo,
  // este robots desaparece solo — misma lógica que el aviso de la página.
  robots: POLITICA_ES_BORRADOR ? { index: false, follow: false } : undefined,
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif mt-10 text-[22px] leading-tight">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-foreground/90">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="mt-1.5 text-sm leading-relaxed text-foreground/90">{children}</li>;
}

/** Un dato que el cliente todavía no entregó, marcado para que no pase inadvertido. */
function Falta({ children }: { children: string }) {
  return <span className="bg-destructive/10 px-1 font-medium text-destructive">{children}</span>;
}

/** Imprime un valor del responsable, resaltado si sigue siendo un marcador. */
function Dato({ valor }: { valor: string }) {
  return valor.startsWith("[PENDIENTE:") ? <Falta>{valor}</Falta> : <>{valor}</>;
}

export default async function PrivacidadPage() {
  const organization = await getOrganization();
  const plataforma = organization?.platform_name ?? "esta plataforma";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Documento legal</p>
      <h1 className="font-serif mt-2.5 text-[34px] leading-[1.1]">Política de privacidad y tratamiento de datos</h1>
      <p className="mt-3 text-xs tabular-nums text-muted-foreground">
        Versión {POLITICA_VERSION} · vigente desde {POLITICA_VIGENCIA}
      </p>

      {POLITICA_ES_BORRADOR && (
        <div className="mt-7 border border-destructive bg-destructive/5 p-4">
          <p className="text-[11px] tracking-[0.13em] text-destructive uppercase">Borrador — no publicado</p>
          <p className="mt-2 text-sm leading-relaxed">
            Este texto es un borrador técnico. Todavía le faltan los datos marcados en rojo y no ha pasado por revisión
            legal, así que <strong>no debe considerarse vigente</strong>. Este aviso desaparece por sí solo cuando se
            completen esos datos.
          </p>
        </div>
      )}

      <P>
        Esta política explica qué datos personales recoge {plataforma}, para qué los usa, con quién los comparte,
        cuánto tiempo los conserva y cómo puedes ejercer tus derechos sobre ellos. Aplica a cualquier persona que
        postule a una vacante, sea o no empleada de la empresa.
      </P>

      <H2>1. Quién es responsable de tus datos</H2>
      <P>
        El responsable del tratamiento es <Dato valor={RESPONSABLE.razonSocial} />, NIT{" "}
        <Dato valor={RESPONSABLE.nit} />, con domicilio en <Dato valor={RESPONSABLE.domicilio} />.
      </P>

      <H2>2. Qué datos recogemos</H2>
      <P>Cuando postulas a una vacante desde el portal público, según lo que pida esa vacante en particular:</P>
      <ul className="mt-2 list-disc pl-5">
        <Li>Correo electrónico. Siempre obligatorio, es lo que identifica tu candidatura.</Li>
        <Li>Nombre completo, teléfono y dirección.</Li>
        <Li>Carta de motivación, puesto actual y años de experiencia.</Li>
        <Li>Tu currículum en PDF y los archivos adicionales que adjuntes.</Li>
        <Li>Las respuestas a las preguntas propias de esa vacante.</Li>
      </ul>
      <P>
        <strong>Sobre tu currículum:</strong> no te pedimos documento de identidad, fecha de nacimiento, fotografía,
        estado civil ni historial salarial. Pero un currículum suele incluir varios de esos datos, y al adjuntarlo nos
        los entregas. Solo incluye lo que quieras compartir.
      </P>
      <P>
        No recogemos datos de salud, origen étnico, afiliación sindical, creencias religiosas, opiniones políticas ni
        vida sexual, y no debes incluirlos. Si llegan dentro de un archivo que adjuntaste, no los usamos para decidir.
      </P>
      <P>
        <strong>Si alguien te refirió:</strong> una persona que trabaja en la empresa puede haber registrado tu nombre,
        correo y teléfono para proponerte a una vacante. En ese caso los datos no los diste tú directamente, y puedes
        pedir su eliminación en cualquier momento por el canal del punto 7.
      </P>

      <H2>3. Para qué los usamos</H2>
      <ul className="mt-2 list-disc pl-5">
        <Li>Evaluar tu candidatura para la vacante a la que postulaste.</Li>
        <Li>Comunicarnos contigo durante el proceso: avisarte de tu avance, agendar entrevistas, escribirte.</Li>
        <Li>Considerarte para otras vacantes que encajen con tu perfil, mientras conservemos tus datos.</Li>
      </ul>
      <P>
        No usamos tus datos para publicidad, no los vendemos, y no tomamos decisiones automatizadas sobre tu
        candidatura: cada avance, rechazo o contratación la decide una persona.
      </P>

      <H2>4. Con qué base los tratamos</H2>
      <P>
        Con tu consentimiento, que das marcando la casilla correspondiente antes de enviar tu postulación. Registramos
        la versión de esta política que aceptaste y el momento en que lo hiciste. Puedes retirar ese consentimiento
        cuando quieras, por el canal del punto 7; retirarlo implica que dejamos de considerar tu candidatura.
      </P>

      <H2>5. Con quién los compartimos</H2>
      <P>
        No vendemos ni cedemos tus datos. Dentro de la empresa, acceden únicamente las personas asignadas al proceso de
        esa vacante. Fuera de la empresa, usamos estos proveedores que procesan datos por cuenta nuestra y bajo nuestras
        instrucciones:
      </P>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Proveedor</th>
              <th className="py-2 pr-4 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Para qué</th>
              <th className="py-2 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Dónde</th>
            </tr>
          </thead>
          <tbody>
            {ENCARGADOS.map((e) => (
              <tr key={e.nombre} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{e.nombre}</td>
                <td className="py-2 pr-4 text-foreground/90">{e.servicio}</td>
                <td className="py-2 text-muted-foreground">{e.ubicacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        Como se ve en la tabla, tus datos se almacenan y procesan en Estados Unidos. Al aceptar esta política aceptas
        esa transferencia internacional.
      </P>

      <H2>6. Cuánto tiempo los conservamos</H2>
      <P>
        Si no resultas contratado, conservamos tu candidatura por <Dato valor={RESPONSABLE.retencion} /> desde la última
        actividad en tu proceso, para poder considerarte en vacantes futuras. Cumplido ese plazo se elimina. Si resultas
        contratado, tus datos pasan a tu expediente laboral y se rigen por la normativa laboral aplicable, no por esta
        política.
      </P>

      <H2>7. Tus derechos y cómo ejercerlos</H2>
      <P>Puedes pedirnos en cualquier momento:</P>
      <ul className="mt-2 list-disc pl-5">
        <Li>Acceder a los datos que tenemos sobre ti.</Li>
        <Li>Rectificarlos si están equivocados o incompletos.</Li>
        <Li>Eliminarlos, o pedir que dejemos de tratarlos.</Li>
        <Li>Retirar el consentimiento que diste al postular.</Li>
        <Li>Recibir una copia de lo que nos entregaste.</Li>
      </ul>
      <P>
        Escribe a <Dato valor={RESPONSABLE.correoDerechos} /> desde el mismo correo con el que postulaste. Es la forma
        más rápida de que podamos confirmar que eres tú.
      </P>

      <H2>8. Cómo protegemos tus archivos</H2>
      <P>
        Tu currículum y tus adjuntos se guardan en almacenamiento privado, nunca en una dirección pública. Cuando una
        persona autorizada necesita abrirlos, se genera un enlace temporal que caduca en 60 segundos. El acceso a tu
        candidatura está restringido en la propia base de datos a las personas asignadas a esa vacante. Todo el tráfico
        va cifrado.
      </P>

      <H2>9. Cookies</H2>
      <P>
        <strong>El portal público de empleos no usa cookies.</strong> Puedes ver las vacantes y enviar tu postulación
        sin que se guarde nada en tu navegador. No usamos analítica, ni publicidad, ni rastreadores de terceros, ni
        cargamos tipografías o recursos desde servidores externos.
      </P>
      <P>
        Las únicas cookies de la plataforma aparecen cuando una persona del equipo interno inicia sesión: son cookies de
        sesión, estrictamente necesarias para mantener la autenticación, no accesibles desde JavaScript y sin ninguna
        finalidad publicitaria ni estadística. Si en el futuro se incorporara cualquier herramienta de analítica o
        publicidad, se pedirá tu consentimiento antes de instalarla y esta sección se actualizará.
      </P>

      <H2>10. Menores de edad</H2>
      <P>
        La plataforma está dirigida a personas con edad legal para trabajar. No solicitamos ni buscamos datos de
        menores. Si detectamos una candidatura de un menor sin la autorización que exija la ley, la eliminamos.
      </P>

      <H2>11. Cambios a esta política</H2>
      <P>
        Cada versión lleva número y fecha de vigencia, visibles al inicio de esta página. Ante un cambio sustantivo
        publicamos una versión nueva; tu postulación queda vinculada a la versión que aceptaste cuando la enviaste. Si
        el cambio afecta el uso de datos que ya nos diste, te lo comunicamos al correo con el que postulaste.
      </P>

      <div className="mt-12 border-t border-border pt-6">
        <Link href="/empleos" className="text-sm font-medium text-accent underline">
          Volver a las vacantes
        </Link>
      </div>
    </main>
  );
}
