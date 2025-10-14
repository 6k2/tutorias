# Tutorias

App sencilla para reservar clases y gestionar perfil. Tiene inicio con materias, login/signup, perfil con especialidades y pantalla para que docentes creen su oferta (matrícula). Usa Expo y Firebase.

## Qué incluye
- Home con hero y lista de materias
- Login y Signup (Firebase Auth)
- Perfil: foto, descripción, especialidades
- Inspect: lista de docentes por materia
- Matricular (solo docentes)
- Alertas superiores y tab bar custom

## Offline Mode
- Firestore nativo usa `persistentLocalCache` con fallback a memoria en dispositivos sin soporte.
- Toolkit en `tools/offline` expone `ensureOfflineReady`, `useConnectivity`, `enqueueSyncAction` y `useOfflineSync` para reusar lógica offline.
- Agenda sincroniza aceptaciones/rechazos en segundo plano y marca "Pendiente por sincronizar" mientras espera conexión.
- Inspect y Matricula cargan datos guardados y mantienen borradores locales para seguir trabajando sin internet.

## Falta por hacer
- Chats (pantalla pendiente)
- Agenda (pantalla pendiente)
- Subida real de imágenes a Storage
- Más validaciones/errores y textos pulidos

## Cómo correrlo (rápido)
1. Instalar Node.js
2. Abrir terminal y entrar al path del proyecto
3. `cd Tutorias`
4. `npm install`
5. `npm install expo`
6. `npx expo start`

Firebase está configurado en `app/config/firebase.js`. Si quieres usar otro proyecto, cambia esas keys.
