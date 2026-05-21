# Firebase Storage CORS

El chat web sube adjuntos con Firebase Storage desde `localhost`, asi que el bucket necesita CORS para permitir el preflight del navegador.

1. Inicializa Storage en Firebase Console si el proyecto aun no lo tiene activo:
   `https://console.firebase.google.com/project/tutorias-7d6f0/storage`
2. Instala o abre Google Cloud SDK con una cuenta que tenga permisos sobre el bucket.
3. Aplica la configuracion del repo:

```bash
gcloud storage buckets update gs://tutorias-7d6f0.firebasestorage.app --cors-file=storage.cors.json
```

Para revisar la configuracion aplicada:

```bash
gcloud storage buckets describe gs://tutorias-7d6f0.firebasestorage.app --format="default(cors_config)"
```
