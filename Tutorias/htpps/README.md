# Tutorias HTTPS Functions

Este paquete contiene funciones HTTPS independientes para el proyecto Tutorias. Actualmente expone la función `createUserHttp`, que crea usuarios en Firebase Authentication.

## Requisitos previos

- Tener [Firebase CLI](https://firebase.google.com/docs/cli) instalado y autenticado (`firebase login`).
- Contar con un proyecto de Firebase configurado y con permisos para desplegar funciones.
- Configurar las credenciales necesarias para que `firebase-admin` pueda acceder a Firebase Authentication (por ejemplo, variables de entorno o credenciales por defecto de Google).

## Instalación y compilación

```bash
cd Tutorias/htpps
npm install
npm run build
```

El comando `npm run build` compila `index.ts` en la carpeta `lib/` mediante TypeScript. También puedes ejecutar la función en tiempo de desarrollo usando `ts-node/register`:

```bash
node -r ts-node/register index.ts
```

## Despliegue

Para desplegar únicamente la función HTTPS `createUserHttp` utiliza:

```bash
firebase deploy --only functions:createUserHttp
```

## Invocación de la función

Tras el despliegue, Firebase CLI mostrará la URL pública de la función (por ejemplo, `https://us-central1-tu-proyecto.cloudfunctions.net/createUserHttp`). Puedes llamarla con Postman o `curl` enviando una petición `POST` con un cuerpo JSON que incluya `email`, `password` y opcionalmente `displayName`.

### Ejemplo con `curl`

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@example.com","password":"ContraseñaSegura123","displayName":"Usuario Ejemplo"}' \
  https://us-central1-tu-proyecto.cloudfunctions.net/createUserHttp
```

### Ejemplo con Postman

1. Selecciona el método `POST` y pega la URL de la función desplegada.
2. En la pestaña **Headers**, agrega `Content-Type: application/json`.
3. En la pestaña **Body**, selecciona **raw** y elige `JSON`.
4. Ingresa un cuerpo como:

```json
{
  "email": "usuario@example.com",
  "password": "ContraseñaSegura123",
  "displayName": "Usuario Ejemplo"
}
```

5. Envía la petición y revisa la respuesta con los datos del usuario creado.
