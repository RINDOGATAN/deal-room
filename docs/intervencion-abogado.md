# Intervención de Abogado/a

Los abogados pueden participar en tres fases distintas de una operación. Cada fase es independiente — las partes pueden utilizar cualquier combinación (las tres, solo una, o ninguna).

**Solo tu propio abogado o abogada (decisión del propietario, 6 de octubre de 2026).** Dealroom no ofrece a las partes ninguna lista de abogados ni indica tarifas de revisión legal. Una empresa tecnológica que lista abogados e indica sus honorarios parece un servicio de derivación a abogados, que Dealroom no presta (EE. UU.) y que los colegios de abogados europeos restringen. Cada parte trae siempre a su propio abogado o abogada: en la Fase A lo invita por correo y en la Fase B el promotor lo propone por correo. El abogado o la abogada trabaja para su cliente y le factura directamente; Dealroom no cobra nada por ello ni hace recomendaciones. La invitación dentro de la aplicación funciona con independencia del indicador `startupCoverage` (que solo controla las herramientas para agentes y su descubrimiento).

---

## Resumen General

```
           ┌──────────────────────────────────────────────────────────────────┐
           │                    CRONOLOGÍA DE LA OPERACIÓN                    │
           │                                                                  │
  BORRADOR ┤  Fase 0          NEGOCIANDO ───┤ Fase A        ACORDADO ─┤ Fase B │
           │  Pre-Revisión                  │ Asesor de               │ Asesor │
           │  El abogado/a                  │ Parte                   │ de     │
           │  invita al                     │ Cada parte              │ Cierre │
           │  cliente                       │ contrata el suyo        │ Conjunto│
           └──────────────────────────────────────────────────────────────────┘
```

| Fase | Cuándo | Quién solicita | Rol del abogado/a | Independencia |
|------|--------|---------------|-------------------|---------------|
| **0 — Pre-Revisión** | Antes de crear la operación | El abogado/a invita al cliente | Asesoramiento durante la negociación | Unilateral |
| **A — Asesor de Parte** | Tras enviar las selecciones | Cada parte de forma independiente | Revisa la posición de esa parte | Unilateral |
| **B — Asesor de Cierre Conjunto** | Tras acordar todas las cláusulas | El promotor (la otra parte debe confirmar) | Ayuda a ambas partes a cerrar | Bilateral |

---

## Fase 0 — Pre-Revisión

### Qué Es

Un abogado/a con acceso a la plataforma invita a su cliente a una operación que ha preconfigurado. El abogado/a guía al cliente durante la creación de la operación, establece posiciones recomendadas y monitoriza la negociación desde el portal de supervisión.

### Cuándo Ocurre

Antes de la creación de la operación. El abogado/a configura el marco de la operación y después envía una invitación al cliente.

### Cómo Funciona

1. El abogado/a crea o configura la operación en la plataforma
2. El abogado/a invita al cliente por correo electrónico
3. El cliente se une y negocia con la orientación del abogado/a
4. El abogado/a monitoriza el progreso desde `/supervise`

### Datos Clave

| Aspecto | Detalle |
|---------|---------|
| **Campo en la plataforma** | `DealRoom.lawyerVettingId` |
| **Visibilidad** | La otra parte no conoce la participación del abogado/a |
| **Impacto en la UI** | Las operaciones con abogado/a pre-revisor **no** muestran el aviso de abogado/a |

---

## Fase A — Asesor de Parte

### Qué Es

Tras enviar sus selecciones, una parte puede invitar por correo a su propio abogado o abogada para que revise su posición. Es una acción privada — la otra parte no recibe notificación y desconoce si la parte contraria tiene asesoramiento.

### Cuándo Ocurre

Desde el momento en que una parte envía sus selecciones. Disponible durante los siguientes estados de la parte:

- `SUBMITTED` — selecciones recién enviadas
- `REVIEWING` — revisión de compromiso en curso
- `ACCEPTED` — compromiso aceptado

### Cómo Funciona

1. La parte accede a `/deals/[id]/review`
2. Pulsa "Invita a tu propio abogado o abogada"
3. Introduce el correo del abogado o abogada (y, si quiere, su nombre). El diálogo dice: "El abogado o la abogada que invites trabaja para ti y te factura directamente; Dealroom no cobra nada por ello ni hace recomendaciones."
4. El abogado o la abogada pasa a ser supervisor de esa operación (se reutiliza la cuenta si ya existe; una cuenta nueva no tiene colegiación registrada) y recibe un correo con un enlace al portal de revisión
5. Inicia sesión en `/supervise` con esa dirección (la primera vez configura la verificación en dos pasos) y revisa la posición de la parte
6. Aprueba la revisión
7. La parte puede continuar

No hay lista de abogados ni filtro por jurisdicción: la parte elige a su abogado o abogada. Controles: se rechaza la dirección de la otra parte; se rechaza a quien ya revisa para la otra parte; no se puede invitar a una cuenta desactivada; cinco invitaciones por operación cada 24 horas. Los agentes disponen de la misma invitación (`share_with_attorney`, `POST /api/v1/agent/deals/{id}/attorney`) mientras `startupCoverage` está activado.

### Datos Clave

| Aspecto | Detalle |
|---------|---------|
| **Campos en la plataforma** | `DealRoomParty.attorneyReviewRequested`, `attorneySupervisorId`, `attorneyReviewApprovedAt` |
| **Bloqueo de firma** | Las revisiones pendientes (sin aprobar) bloquean la firma |
| **Cancelación** | Una parte puede cancelar una revisión pendiente antes de su aprobación |

### Procedimientos tRPC

| Router | Procedimiento | Descripción |
|--------|--------------|-------------|
| `attorneyReview` | `inviteOwnLawyer` | Invitar por correo al abogado o abogada que elija la parte (abrir la revisión + enviar correo) |
| `attorneyReview` | `cancelReview` | Cancelar revisión pendiente |
| `attorneyReview` | `getReviewStatus` | Estado de revisión de ambas partes |

---

## Fase B — Asesor de Cierre Conjunto

### Qué Es

Un abogado o una abogada que el promotor propone por correo y que ayuda a ambas partes a cerrar la operación una vez acordadas todas las cláusulas. A diferencia de la Fase A (que es privada por parte), la Fase B es un recurso compartido visible para ambas partes.

### Cuándo Ocurre

Solo después de que todas las cláusulas alcancen el estado `AGREED` (acordado).

### Cómo Funciona

1. El **promotor** accede a `/deals/[id]/review`
2. Pulsa "Solicitar Abogado/a de Cierre Conjunto"
3. Introduce el correo del abogado o abogada (y, si quiere, su nombre). El diálogo dice: "El abogado o la abogada que propongas trabaja para ambas partes y os factura directamente; Dealroom no cobra nada por ello ni hace recomendaciones."
   - Se rechaza la dirección de cualquiera de las partes
   - Se rechaza a quien ya intervino en la Fase A de cualquiera de las partes (prevención de conflictos)
4. Se envían dos correos electrónicos:
   - Al **abogado o abogada**: invitación al portal de revisión
   - A la **otra parte**: notificación para confirmar o rechazar
5. La **otra parte** revisa la solicitud y:
   - **Confirma** — el asesor conjunto procede; se puede iniciar la firma
   - **Rechaza** — se cancela el asesor conjunto; se puede firmar sin asesoramiento

Una sola solicitud por operación: tras un rechazo, las partes firman sin asesor conjunto.

### Máquina de Estados

```
                    ┌───────────────┐
                    │ Sin solicitud │
                    └───────┬───────┘
                            │ El promotor solicita
                            ▼
                    ┌───────────────┐
                    │   Pendiente   │──── Firma bloqueada
                    └───────┬───────┘
                   ┌────────┴────────┐
                   │                 │
                   ▼                 ▼
          ┌──────────────┐  ┌──────────────┐
          │  Confirmado  │  │  Rechazado   │
          │              │  │              │
          │ Asesor       │  │ Sin asesor   │
          │ conjunto     │  │ asignado     │
          │ activo       │  │              │
          └──────────────┘  └──────────────┘
                   │                 │
                   └────────┬────────┘
                            ▼
                   Firma desbloqueada
```

### Estados en la UI

| Estado | El promotor ve | La otra parte ve |
|--------|---------------|-----------------|
| Sin solicitud | Botón "Solicitar Asesor de Cierre Conjunto" | Nada |
| Solicitado, pendiente | Estado "Pendiente de confirmación" | Botones "Confirmar / Rechazar" + texto de renuncia |
| Confirmado | "Asesor conjunto activo: [Nombre]" | "Asesor conjunto activo: [Nombre]" |
| Rechazado (vista del promotor) | "Rechazado por la otra parte" | — |
| Rechazado (vista de la otra parte) | — | "Ha rechazado el asesor conjunto" |

### Texto de Renuncia Adaptativo

Al confirmar el asesor conjunto, cada parte ve un texto de renuncia adaptado a su situación en la Fase A:

| Estado en la Fase A | Texto de renuncia |
|---------------------|-------------------|
| Tuvo asesor propio (Fase A) | "He contado con asesoramiento independiente para revisar mi posición y consiento la designación de asesor de cierre conjunto." |
| No tuvo asesor propio | "He declinado contar con asesoramiento independiente y consiento la designación de asesor de cierre conjunto." |

### Datos Clave

| Aspecto | Detalle |
|---------|---------|
| **Campos en la plataforma** | `DealRoom.jointCounselSupervisorId`, `jointCounselRequestedAt`, `jointCounselRequestedBy`, `jointCounselAcknowledgedAt`, `jointCounselDeclinedAt` |
| **Bloqueo de firma** | Las solicitudes pendientes bloquean la firma para ambas partes |
| **Prevención de conflictos** | No se puede proponer como asesor conjunto a quien intervino en la Fase A de cualquiera de las partes |

### Procedimientos tRPC

| Router | Procedimiento | Descripción |
|--------|--------------|-------------|
| `jointCounsel` | `request` | El promotor propone por correo al asesor conjunto |
| `jointCounsel` | `acknowledge` | La otra parte confirma |
| `jointCounsel` | `decline` | La otra parte rechaza |
| `jointCounsel` | `getStatus` | Estado actual + texto de renuncia adaptativo |

---

## Aviso de Abogado/a

### Finalidad

En las operaciones en las que no ha intervenido un abogado/a desde el inicio (sin Fase 0 de pre-revisión), un aviso emergente informa a la parte sobre los riesgos de continuar sin asesoramiento legal y resume las opciones disponibles de intervención de abogado/a.

### Cuándo Aparece

| Condición | Resultado |
|-----------|-----------|
| La operación tiene abogado/a de pre-revisión (`lawyerVettingId` definido) | **Nunca** se muestra |
| La parte ya ha descartado el aviso | **Nunca** se muestra |
| Estado de la operación: `DRAFT`, `AWAITING_RESPONSE` o `NEGOTIATING` | Se **muestra** |
| Estado de la operación: `AGREED`, `SIGNING` o `COMPLETED` | **No** se muestra |

### Contenido

El aviso muestra:

1. **Advertencia de riesgo** — declaración breve sobre continuar sin asesoramiento legal
2. **Cronología de fases** — resumen visual de las tres fases de intervención de abogado/a:
   - Fase 0 mostrada como "omitida" (al no tener abogado/a de pre-revisión)
   - Fase A descrita como disponible tras el envío de selecciones (invita a tu propio abogado o abogada)
   - Fase B descrita como disponible tras el acuerdo (el promotor propone por correo un abogado o una abogada común)

### Cierre del Aviso

El botón "Entendido" llama a `deal.dismissLawyerWarning`, que establece `DealRoomParty.lawyerWarningDismissedAt`. El aviso no volverá a aparecer para esa parte en esa operación.

### Páginas

El aviso se muestra en:
- `/deals/[id]` — página de detalle de la operación
- `/deals/[id]/negotiate` — página de negociación

---

## Colegiaciones

### Resumen

Los Administradores de Plataforma pueden registrar las colegiaciones de los supervisores (abogados). Desde el 6 de octubre de 2026 ya no determinan ninguna lista que vean las partes, que eligen a sus propios abogados; se mantienen como registro de administración y para las asignaciones que hace el administrador.

### Gestión

Los Administradores de Plataforma gestionan las colegiaciones en `/admin/supervisors`:

1. Cada fila de supervisor muestra insignias de jurisdicción con número de colegiado/a
2. Pulsar `+` para añadir una nueva colegiación (seleccionar jurisdicción + introducir número de colegiado/a)
3. Pulsar `×` en una insignia para eliminar una colegiación

### Esquema

```prisma
model SupervisorBarAdmission {
  id             String       @id @default(cuid())
  supervisorId   String
  jurisdiction   GoverningLaw   // CALIFORNIA, ENGLAND_WALES, SPAIN
  barNumber      String

  supervisor Supervisor @relation(...)

  @@unique([supervisorId, jurisdiction])
}
```

### Impacto en la Selección de Abogado/a

Ninguno para las partes: no hay lista de selección de abogados (decisión del propietario, 6 de octubre de 2026). Los supervisores existentes y sus colegiaciones se conservan intactos y siguen visibles en las vistas de administración.

---

## Vista en el Portal de Supervisión

Los supervisores ven sus operaciones asignadas en `/supervise` y pueden ver los detalles en `/supervise/deals/[id]`.

### Indicadores de Fase A

Cuando un supervisor está asignado como asesor de parte (Fase A):
- Banner: **"Revisión de Asesor de Parte Solicitada"** con rol de la parte y fecha
- Tras la aprobación: **"Revisión de Asesor de Parte Aprobada"** con fecha de aprobación

### Indicadores de Fase B

Cuando un supervisor está asignado como asesor de cierre conjunto (Fase B):
- Banner pendiente: **"Asesor de Cierre Conjunto — Pendiente"** con ambas partes listadas, a la espera de confirmación
- Banner activo: **"Asesor de Cierre Conjunto — Activo"** con ambas partes listadas y fecha de confirmación

---

## Resumen de Campos en la Base de Datos

### En `DealRoom`

| Campo | Tipo | Fase | Finalidad |
|-------|------|------|-----------|
| `lawyerVettingId` | `String?` | 0 | Referencia al abogado/a de pre-revisión |
| `jointCounselSupervisorId` | `String?` | B | Asesor de cierre conjunto asignado |
| `jointCounselRequestedAt` | `DateTime?` | B | Cuándo se realizó la solicitud |
| `jointCounselRequestedBy` | `String?` | B | ID de la parte promotora |
| `jointCounselAcknowledgedAt` | `DateTime?` | B | Cuándo la otra parte confirmó |
| `jointCounselDeclinedAt` | `DateTime?` | B | Cuándo la otra parte rechazó |

### En `DealRoomParty`

| Campo | Tipo | Fase | Finalidad |
|-------|------|------|-----------|
| `attorneyReviewRequested` | `Boolean` | A | Si la parte solicitó revisión |
| `attorneySupervisorId` | `String?` | A | Asesor de parte asignado |
| `attorneyReviewApprovedAt` | `DateTime?` | A | Cuándo se aprobó la revisión |
| `lawyerWarningDismissedAt` | `DateTime?` | — | Cuándo se descartó el aviso |

### En `Supervisor`

| Campo | Tipo | Finalidad |
|-------|------|-----------|
| `barAdmissions` | `SupervisorBarAdmission[]` | Jurisdicciones donde está colegiado/a |
| `jointCounselDeals` | `DealRoom[]` | Operaciones donde está asignado como asesor conjunto |
