# tutorias

Aplicación móvil para conectar tutores y estudiantes.

## Configuración rápida

1. Ve a `Tutorias/src/services/firebase.js` y reemplaza los valores `REPLACE_ME` con las credenciales de tu proyecto Firebase.
2. Instala dependencias y ejecuta la app:
   ```bash
   cd Tutorias
   npm install
   npx expo start
   ```
3. Crea una cuenta de estudiante y otra de tutor para probar.
4. Sube un avatar en el perfil y verifica que se actualiza.
5. Usa el buscador en la lista de tutores para filtrar por nombre o materia.

## Notas
- Solo se usan Firebase Auth, Firestore y Storage.
- Todo el código está en JavaScript dentro de `Tutorias/src`.
- Revisa `docs/security-rules-notes.md` para reglas recomendadas.
