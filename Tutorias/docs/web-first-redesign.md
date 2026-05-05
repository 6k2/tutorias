# Rediseño web-first

## Diagnóstico UI

La interfaz anterior funcionaba, pero se sentía como una app móvil estirada: navegación inferior fija, pantallas de una sola columna, cards grandes con poca densidad informativa, formularios centrados y layouts oscuros inconsistentes entre módulos. En escritorio no existía una arquitectura visual clara para escanear materias, comparar docentes o entender el siguiente paso de una reserva.

## Nueva dirección visual

- Estética SaaS educativa: fondos claros, paneles blancos, acento índigo, badges de estado y cards con sombra suave.
- Navegación desktop con sidebar persistente y navegación inferior solo en pantallas pequeñas.
- Páginas con contenedores amplios, grids multicolumna y bloques de resumen.
- Formularios auth tipo workspace, con layout editorial y cards premium.
- Catálogo y detalle orientados a comparación rápida, cupos, precio, horario y acción primaria.

## Sistema visual creado

- `components/ui/tokens.js`: colores, radios, sombras y ancho máximo.
- `components/ui/Primitives.jsx`: `Page`, `PageHeader`, `Card`, `Button`, `Badge`, `Field`, `EmptyState`, `Metric`.
- `components/CustomTabBar.jsx`: sidebar web-first en desktop y bottom navigation responsive en móvil/tablet.

## Compatibilidad preservada

- Firebase Auth, Firestore y hooks existentes se mantienen.
- Las imágenes siguen renderizándose desde las mismas URLs/campos (`subject.image`, `offer.images[0]`) con mejor cropping y tamaños desktop.
- El flujo de pago mock y las validaciones agregadas siguen intactos.
