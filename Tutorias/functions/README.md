# Firebase Functions (Opcional)

El proyecto queda soportado en Firebase Spark/free sin depender de Cloud Functions.
El chat escribe mensajes y resumen de conversacion desde el cliente con `writeBatch`.

Esta carpeta se conserva solo como codigo opcional para proyectos en Blaze:
- `onMessageCreate` puede duplicar la actualizacion de resumen/unread si algun dia se habilitan Functions.
- `onTutoringMaterialCreate` sirve para notificaciones push si el proyecto sube a Blaze.

## Scripts utiles sin Blaze
1. `cd functions`
2. `npm install`
3. `npm run build`
4. `npm run migrate:chat:dry-run`
5. `npm run migrate:chat:apply`

La migracion usa Admin SDK y requiere credenciales locales, por ejemplo `GOOGLE_APPLICATION_CREDENTIALS`.
