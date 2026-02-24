# Intervención de Abogado/a

Los abogados pueden participar en tres fases distintas de una operación. Cada fase es independiente — las partes pueden utilizar cualquier combinación (las tres, solo una, o ninguna).

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

Tras enviar sus selecciones, una parte puede contratar de forma independiente a un abogado/a para que revise su posición. Es una acción privada — la otra parte no recibe notificación y desconoce si la parte contraria tiene asesoramiento.

### Cuándo Ocurre

Desde el momento en que una parte envía sus selecciones. Disponible durante los siguientes estados de la parte:

- `SUBMITTED` — selecciones recién enviadas
- `REVIEWING` — revisión de compromiso en curso
- `ACCEPTED` — compromiso aceptado

### Cómo Funciona

1. La parte accede a `/deals/[id]/review`
2. Abre el diálogo de selección de abogado/a
3. Ve una lista de supervisores disponibles **filtrada por jurisdicción** (solo abogados colegiados en la legislación aplicable de la operación)
4. Selecciona un abogado/a — el número de colegiado/a aparece junto al nombre
5. El abogado/a seleccionado recibe una notificación por correo electrónico
6. El abogado/a revisa la posición de la parte desde `/supervise`
7. El abogado/a aprueba la revisión
8. La parte puede continuar

### Filtro por Jurisdicción

Los abogados deben tener un registro de `SupervisorBarAdmission` que coincida con el `governingLaw` de la operación para aparecer en la lista de selección. Por ejemplo:

| Legislación aplicable | El abogado/a debe estar colegiado/a en |
|----------------------|---------------------------------------|
| CALIFORNIA | California (State Bar) |
| ENGLAND_WALES | Inglaterra y Gales (SRA) |
| SPAIN | España (Colegio de Abogados) |

### Datos Clave

| Aspecto | Detalle |
|---------|---------|
| **Campos en la plataforma** | `DealRoomParty.attorneyReviewRequested`, `attorneySupervisorId`, `attorneyReviewApprovedAt` |
| **Bloqueo de firma** | Las revisiones pendientes (sin aprobar) bloquean la firma |
| **Cancelación** | Una parte puede cancelar una revisión pendiente antes de su aprobación |

### Procedimientos tRPC

| Router | Procedimiento | Descripción |
|--------|--------------|-------------|
| `attorneyReview` | `listAvailableAttorneys` | Lista filtrada por jurisdicción con marcas de conflicto de interés |
| `attorneyReview` | `requestReview` | Asignar supervisor + enviar correo |
| `attorneyReview` | `cancelReview` | Cancelar revisión pendiente |
| `attorneyReview` | `getReviewStatus` | Estado de revisión de ambas partes |

---

## Fase B — Asesor de Cierre Conjunto

### Qué Es

Un abogado/a neutral que ayuda a ambas partes a cerrar la operación una vez acordadas todas las cláusulas. A diferencia de la Fase A (que es privada por parte), la Fase B es un recurso compartido visible para ambas partes.

### Cuándo Ocurre

Solo después de que todas las cláusulas alcancen el estado `AGREED` (acordado).

### Cómo Funciona

1. El **promotor** accede a `/deals/[id]/review`
2. Pulsa "Solicitar Asesor de Cierre Conjunto"
3. Ve una lista de supervisores disponibles:
   - Filtrada por jurisdicción (igual que la Fase A)
   - **Excluye** cualquier abogado/a ya involucrado en la Fase A de cualquier parte (prevención de conflictos)
4. Selecciona un abogado/a
5. Se envían dos correos electrónicos:
   - Al **abogado/a**: notificación de asignación
   - A la **otra parte**: notificación para confirmar o rechazar
6. La **otra parte** revisa la solicitud y:
   - **Confirma** — el asesor conjunto procede; se puede iniciar la firma
   - **Rechaza** — se cancela el asesor conjunto; se puede firmar sin asesoramiento

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
| **Prevención de conflictos** | Los abogados de la Fase A de cualquier parte quedan excluidos de la lista de candidatos de la Fase B |

### Procedimientos tRPC

| Router | Procedimiento | Descripción |
|--------|--------------|-------------|
| `jointCounsel` | `listAvailable` | Lista filtrada por jurisdicción, excluidos abogados de Fase A |
| `jointCounsel` | `request` | El promotor solicita asesor conjunto |
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
   - Fase A descrita como disponible tras el envío de selecciones
   - Fase B descrita como disponible tras el acuerdo

### Cierre del Aviso

El botón "Entendido" llama a `deal.dismissLawyerWarning`, que establece `DealRoomParty.lawyerWarningDismissedAt`. El aviso no volverá a aparecer para esa parte en esa operación.

### Páginas

El aviso se muestra en:
- `/deals/[id]` — página de detalle de la operación
- `/deals/[id]/negotiate` — página de negociación

---

## Colegiaciones

### Resumen

Los supervisores (abogados) deben tener colegiaciones registradas en la plataforma para aparecer en las listas de selección de abogado/a. Las colegiaciones son específicas de cada jurisdicción y las gestionan los Administradores de Plataforma.

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

| Fase | Regla de filtrado |
|------|------------------|
| **Fase A** | Solo supervisores con colegiación en la `governingLaw` de la operación |
| **Fase B** | Mismo filtro de jurisdicción + excluye abogados de la Fase A de cualquier parte |

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
