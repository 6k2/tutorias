# Flujo de uso — Tutorias

```mermaid
flowchart LR
  A[Inicio] --> B{Sesión activa?}
  B -- No --> C[Login / Registro]
  C --> D[Explorar materias]
  B -- Sí --> D
  D --> E[Ver ofertas por materia]
  E --> F[Detalle de tutoría]
  F --> G[Seleccionar horario]
  G --> H[Pantalla de pago mock]
  H --> I{Validación correcta?}
  I -- No --> H
  I -- Sí --> J[Pago mock aprobado]
  J --> K[Reserva pendiente]
  K --> L[Mis reservas / Agenda]
```

```mermaid
flowchart LR
  A[Inicio] --> B[Login docente]
  B --> C[Dashboard / Home]
  C --> D[Publicar oferta]
  C --> E[Agenda docente]
  E --> F[Solicitudes pendientes]
  F --> G[Aceptar o rechazar]
  G --> H[Reservas confirmadas]
  H --> I[Subir materiales]
  I --> J[Chat y seguimiento]
```

## Reglas principales

- Las rutas privadas usan una sesión centralizada para evitar validaciones dispersas y parpadeos.
- La reserva de estudiante ya no crea una solicitud antes del pago: primero valida horario, luego abre el pago mock y después crea la reserva con `paymentStatus: paid_mock`.
- El modo offline conserva caché local, cola de sincronización y avisos visuales. Las operaciones que requieren pago se bloquean con un mensaje claro cuando no hay conexión.
- El pago mock no almacena datos sensibles completos: solo conserva metadatos simulados y los últimos cuatro dígitos.
