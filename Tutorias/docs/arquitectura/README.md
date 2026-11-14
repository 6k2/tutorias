# Arquitectura y controles de TUTORÍAS

La aplicación Expo usa Firebase Authentication y accede a Firestore, Realtime Database y Storage mediante sus SDK. Las Cloud Functions reaccionan a eventos de Auth y Firestore y envían notificaciones por FCM. El repositorio contiene el código de esas integraciones y las reglas enlazadas por [firebase.json](../../firebase.json). El estado desplegado requeriría evidencia de la consola o de un inventario cloud.

## Diagramas

| Orden | Fuente Mermaid | Imagen | Qué exponer |
| --- | --- | --- | --- |
| 1 | [VPC base](diagramas/fig2_vpc_base.mmd) | [PNG](diagramas/fig2_vpc_base.png) | Aplicación, servicios administrados y cuatro subredes del diseño académico. El /16 es el espacio de referencia y cada subred tiene su propio CIDR regional. |
| 2 | [VPC con controles](diagramas/fig1_arquitectura.mmd) | [PNG](diagramas/fig1_arquitectura.png) | Identidad, HTTPS/TLS, Security Rules, IAM y controles de conectividad previstos. |

Azul identifica clientes, verde identifica servicios usados por el código y ámbar identifica componentes de la propuesta. Las líneas punteadas muestran relaciones previstas. Firebase Hosting es una opción de publicación web del diseño. El conector representa egreso hacia destinos privados y usa su propio rango. Cloud NAT se ilustra para la subred Aplicación. Su alcance en Terraform cubre esa subred, mientras que el conector tiene otro rango. Private Google Access se refiere a APIs compatibles. Firestore aparece fuera de la VPC y su ubicación en `firebase.json` es `nam5`.

Desde la raíz del repositorio, con Node.js y Python 3:

```powershell
npm install -g @mermaid-js/mermaid-cli@11.4.2
python Tutorias/docs/arquitectura/diagramas/render_diagramas.py
```

El script usa el Chromium de Puppeteer. Si la instalación omitió esa descarga, define `PUPPETEER_EXECUTABLE_PATH` con la ruta de Chrome antes de ejecutar el script.

## Evidencias para exponer

| Requisito | Política y código | Efecto comprobable |
| --- | --- | --- |
| Identidad y datos | [firestore.rules](../../firestore.rules), bloques `/users`, `/offers` y `/reservations` | Escritura de perfil propio y protección de campos de ofertas ajenas. Para reservas pendientes, la lectura normal se basa en el UID de los participantes. |
| Privacidad y rol previstos | [firestore-academico.rules](ejemplos/firestore-academico.rules) | Ejemplo aislado. Restringe también las reservas confirmadas a sus participantes y exige un claim docente para editar ofertas propias. |
| Archivos y presencia | [storage.rules](../../storage.rules), bloque `/materials`, y [database.rules.json](../../database.rules.json), bloque `status` | Materiales para participantes y carga a cargo del docente, con validación de tipo y tamaño. Escritura de presencia por el dueño del UID. |
| Seguridad de red y acceso administrativo | [main.tf](ejemplos/terraform/main.tf), recursos `google_compute_subnetwork.subredes` y `google_compute_firewall.fw_administracion_iap` | Ejemplo de segmentación, Flow Logs y restricción por rango IAP y etiqueta en destinos VPC. La autorización del túnel IAP se concede mediante IAM sobre destinos compatibles. |
| Identidad de servicio | [main.tf](ejemplos/terraform/main.tf), `google_project_iam_member.functions_firestore` y `google_org_policy_policy.sin_llaves_de_servicio` | Ejemplo de una identidad con acceso de lectura y escritura a Firestore a nivel de proyecto y una política contra la creación de llaves. El ejemplo no asigna la identidad al runtime de Functions. |
| Cifrado | HTTPS/TLS de los endpoints administrados y cifrado en reposo administrado por Google | El firewall ejemplifica restricciones de tráfico. La negociación TLS y el cifrado en reposo corresponden al proveedor. [Cifrado de Google Cloud](https://docs.cloud.google.com/docs/security/encryption/default-encryption) |
| FinOps | [main.tf](ejemplos/terraform/main.tf), `labels`, `lifecycle_rule`, `google_billing_budget.mensual` y canal de correo | Inform identifica el gasto y sus umbrales. Optimize ejemplifica el ciclo de vida de respaldos. Operate configura avisos de 50 %, 80 % y 100 % para la revisión del equipo. El presupuesto conserva USD 35 mensuales. |

La app consulta reservas confirmadas por oferta para calcular disponibilidad en web y móvil y para los contactos del chat. Las reglas actuales también permiten leer perfiles a usuarios autenticados y el registro usa un campo de perfil para el rol. La política académica estricta se prueba en un ejemplo separado. Para aplicarla a la app, harían falta una fuente de disponibilidad sin datos de reservas, una revisión de contactos y perfiles y una fuente administrada para el claim. Las lecturas de presencia y escritura en curso siguen disponibles para usuarios autenticados según las reglas actuales.

Terraform se incluye como demostración. Los ejemplos de firewall por etiqueta requieren destinos compatibles. La política de llaves depende de la organización. El presupuesto notifica al equipo y la decisión sobre despliegues permanece operativa. Las partidas por servicio del paquete previo se excluyeron del ejemplo porque sus montos difieren del documento unificado.

## Validación local

Con Terraform 1.5 o posterior, desde la raíz del repositorio:

```powershell
$ejemplo = 'Tutorias/docs/arquitectura/ejemplos/terraform'
terraform "-chdir=$ejemplo" fmt -check
terraform "-chdir=$ejemplo" init -backend=false
terraform "-chdir=$ejemplo" validate
```

Con Node.js y Java para los emuladores, instala las herramientas de validación en un directorio separado. El ejemplo usa PowerShell y el proyecto local ficticio `demo-tutorias`.

```powershell
$herramientas = Join-Path ([System.IO.Path]::GetTempPath()) 'tutorias-validacion'
npm install --prefix $herramientas firebase-tools@14.27.0 @firebase/rules-unit-testing@4.0.1 firebase@11.10.0
$env:NODE_PATH = Join-Path $herramientas 'node_modules'
$firebase = Join-Path $herramientas 'node_modules/.bin/firebase.cmd'
Push-Location Tutorias
try {
    & $firebase emulators:exec --only firestore,storage,database --project demo-tutorias 'node --test docs/arquitectura/validar-reglas.cjs'
} finally {
    Pop-Location
}
```

La suite lee las rutas de reglas configuradas en `firebase.json`. Luego carga el ejemplo académico solo en el emulador de Firestore. El entorno de pruebas usa datos ficticios.
