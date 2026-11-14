# Auditoría técnica de TUTORÍAS

**Base revisada.** `6k2/tutorias`, rama `master`, commit `bfa9af651634259fe9ad84fd806260a519a7b031`. Era la punta con la fecha de commit más reciente entre las ramas publicadas del remoto y también su rama predeterminada. [Commit base](https://github.com/6k2/tutorias/commit/bfa9af651634259fe9ad84fd806260a519a7b031)

**Fuentes académicas.** Se contrastaron el árbol versionado, el documento unificado de Computación en la Nube, los anexos y el paquete de código localizado en Descargas. El documento unificado sirvió de referencia para el presupuesto y la VPC. Los ejemplos del paquete se contrastaron con las colecciones y rutas de la rama vigente.

## A. Auditoría inicial

| Requisito | Estado inicial | Evidencia y brecha |
| --- | --- | --- |
| Diagrama VPC base reproducible | PARCIAL | El paquete externo incluía `diagramas/fig2_vpc_base.mmd` y un generador. La rama carecía de ambos y la fuente dibujaba la subred Web como punto de entrada de la app. |
| Diagrama con seguridad | PARCIAL | `diagramas/fig1_arquitectura.mmd` del paquete ilustraba la VPC, pero agrupaba el tráfico del cliente hacia los servicios administrados y hacia la red propuesta. Faltaba distinguir Security Rules, IAM y firewall. |
| Firebase y backend | CUMPLE | `Tutorias/firebase.json:2` enlazaba las tres reglas y Functions. `Tutorias/app/config/firebase.js:35` inicializaba Auth. `Tutorias/functions/src/index.ts:47` implementaba eventos de Auth y Firestore y los handlers de mensajes y materiales enviaban FCM. Hosting y la conexión a VPC figuraban en el diseño académico. |
| Acceso a perfiles, ofertas y reservas | PARCIAL | `Tutorias/firestore.rules:294`, `:317` y `:329` tenían controles por UID y propiedad. Usuarios autenticados podían leer perfiles y reservas confirmadas. El rol se guardaba como campo editable del perfil y el registro web y móvil lo asignaba desde el cliente. |
| Protección de archivos | PARCIAL | `Tutorias/storage.rules:67` autorizaba la lectura a participantes y la escritura al docente de la reserva. El límite implementado era 25 MiB, frente al tope académico de 20 MB. El flujo existente de carga y los metadatos de Firestore admiten el límite actual. |
| Realtime Database | PARCIAL | `Tutorias/database.rules.json:3` y `:9` delimitaban la escritura al UID para presencia y escritura en curso. El emulador rechazó la anotación textual `_todo`. Las lecturas permanecen abiertas a usuarios autenticados. |
| IAM, segmentación y gobernanza | PARCIAL | La rama carecía de IaC e IAM versionados. `terraform/main.tf` del paquete ya ejemplificaba VPC, IAP, NAT, cuenta de servicio y política de llaves. Functions inicializaba Admin SDK sin fijar una cuenta de servicio en el código. |
| Cifrado | PARCIAL | El uso de endpoints administrados da evidencia del diseño HTTPS/TLS y del cifrado en reposo por defecto. La persistencia nativa de Auth usa AsyncStorage en `Tutorias/app/config/firebase.js:38`, distinta de Keychain/Keystore planteados en el documento. |
| FinOps | PARCIAL | El documento y el paquete externo tenían etiquetas, ciclo de vida, presupuesto y alertas. La rama carecía de esos ejemplos. El presupuesto mensual coincidía y las partidas por servicio diferían. |
| Instrucciones y pruebas entregables | FALTA | La rama tenía instrucciones para Expo, Functions y CORS. Los scripts del paquete externo probaban su propio esquema en español y quedaban fuera de la rama. |
| Despliegue de la VPC, rediseño de escalado y nuevos recursos facturables | NO APLICA | El alcance es código, diagramas y validación local de evidencias. |

## B. Cambios realizados

| Archivo | Motivo |
| --- | --- |
| `Tutorias/database.rules.json` | Retirar la anotación `_todo` que Firebase interpretaba como una ruta mal definida. Se conservaron las condiciones de lectura y escritura. |
| `Tutorias/docs/arquitectura/diagramas/fig2_vpc_base.mmd` y `fig1_arquitectura.mmd` | Adaptar las dos fuentes del paquete para mostrar los flujos reales del código y la VPC propuesta con sus cuatro subredes. |
| `Tutorias/docs/arquitectura/diagramas/render_diagramas.py`, `mermaid.json` y dos PNG | Reutilizar Mermaid y producir las imágenes con un comando compatible con PowerShell. |
| `Tutorias/docs/arquitectura/ejemplos/firestore-academico.rules` | Demostrar el acceso estricto a reservas y el rol docente sobre las rutas de esta rama. El ejemplo se carga solo en la suite local. |
| `Tutorias/docs/arquitectura/ejemplos/terraform/main.tf`, `variables.tf` y `.terraform.lock.hcl` | Reutilizar los ejemplos principales de red, IAM, respaldo y presupuesto. Se acotó el firewall al ejemplo IAP, se usó el número de proyecto en la política de organización y se fijó la versión del proveedor validado. |
| `Tutorias/docs/arquitectura/validar-reglas.cjs` | Probar las reglas enlazadas desde `firebase.json` y la política académica con datos del esquema vigente. |
| `Tutorias/docs/arquitectura/README.md` | Dejar comandos y una relación entre políticas, fragmentos de código y efectos observables. |

## C. Diagramas

| Diagrama | Fuente | Imagen |
| --- | --- | --- |
| A. VPC base | `Tutorias/docs/arquitectura/diagramas/fig2_vpc_base.mmd` | [fig2_vpc_base.png](diagramas/fig2_vpc_base.png) |
| B. VPC con controles | `Tutorias/docs/arquitectura/diagramas/fig1_arquitectura.mmd` | [fig1_arquitectura.png](diagramas/fig1_arquitectura.png) |

```powershell
npm install -g @mermaid-js/mermaid-cli@11.4.2
python Tutorias/docs/arquitectura/diagramas/render_diagramas.py
```

El comando se ejecuta desde la raíz del repositorio. Ambas imágenes sitúan los servicios de Firebase fuera de las subredes. El ámbar indica componentes propuestos y las líneas punteadas muestran conectividad prevista. La VPC tiene alcance global en Google Cloud. `us-central1` identifica la región de las subredes y `10.20.0.0/16` el rango de referencia del diseño.

## D. Fragmentos para exponer

| Tema | Fragmento | Explicación |
| --- | --- | --- |
| VPC y segmentación | `diagramas/fig2_vpc_base.mmd`, `subgraph VPC`. En `ejemplos/terraform/main.tf`, `local.subredes` y los recursos `google_compute_network` y `google_compute_subnetwork`. | VPC de modo personalizado, CIDR por subred y servicios Firebase externos. |
| Acceso a ofertas y reservas | `Tutorias/firestore.rules:180` y `:329`, `validOfferOwnerUpdate` y `/reservations`. `ejemplos/firestore-academico.rules:6` para el ejemplo estricto. | Propiedad de la oferta y lectura de reservas. La excepción de confirmadas es parte de la regla real. El ejemplo académico exige pertenencia a la reserva y claim para editar ofertas. |
| Archivos y presencia | `Tutorias/storage.rules:67` y `Tutorias/database.rules.json:3`. | El docente de la reserva controla la carga de materiales. Los participantes pueden leerlos. Cada usuario escribe su presencia. |
| IAM y red | `ejemplos/terraform/main.tf`, `fw_administracion_iap`, `functions_firestore` y `sin_llaves_de_servicio`. | Regla de red por etiqueta y origen IAP. Identidad de servicio con un rol de datos a nivel de proyecto y política de llaves. IAM del túnel y cuenta de runtime dependen de la infraestructura real. [IAM de Firestore](https://firebase.google.com/docs/firestore/security/iam) |
| Cifrado | `diagramas/fig1_arquitectura.mmd`, nodo `SDK` y acceso web propuesto. | TLS en tránsito y cifrado administrado en reposo son controles del proveedor. La regla de firewall controla tráfico y no negocia TLS. [Cifrado en reposo de Google Cloud](https://docs.cloud.google.com/docs/security/encryption/default-encryption) |
| FinOps | `ejemplos/terraform/main.tf`, `labels`, `lifecycle_rule`, `correo` y `mensual`. | Inform con etiquetas y presupuesto. Optimize con ciclo de vida de respaldos. Operate con correo y umbrales de 50 %, 80 % y 100 % sobre USD 35 mensuales. La respuesta a los avisos sigue siendo operativa. |

Las rutas abreviadas de la tabla parten de `Tutorias/docs/arquitectura`.

## E. Validaciones

| Comando o control | Resultado |
| --- | --- |
| `python Tutorias/docs/arquitectura/diagramas/render_diagramas.py` | Mermaid CLI 11.4.2 generó los dos PNG. Se inspeccionaron visualmente títulos, etiquetas, flechas y límites de la VPC. |
| `terraform fmt -check`, `terraform init -backend=false` y `terraform validate` en el ejemplo | Configuración válida con Terraform 1.12.2 y proveedor Google 6.50.0. |
| `firebase emulators:exec --only firestore,storage,database --project demo-tutorias "node --test docs/arquitectura/validar-reglas.cjs"` desde `Tutorias` | Primer intento rechazado por el `_todo` de RTDB. Tras retirarlo, seis casos y dos grupos pasaron con Firebase CLI 14.27.0. Java 25 emitió una advertencia de deprecación del runtime de Storage. |
| `python pruebas/validar_cobertura.py` y `node pruebas/reglas.test.js` bajo emuladores, usando los archivos del paquete externo | 25/25 comprobaciones estáticas y 36/36 casos de emulador. Esos resultados corresponden al esquema del paquete. |
| `npm ci --prefix Tutorias/functions` y `npm run build --prefix Tutorias/functions` | TypeScript compiló. La instalación advirtió que el paquete declara Node 20 y el equipo ejecutaba Node 24. Se restauró la copia versionada generada por la compilación. |
| Revisión de diff y búsqueda de secretos | Único cambio en archivos versionados de la app: retirada de la anotación inválida. Los ejemplos usan variables para el proyecto, la cuenta de facturación y el correo. |
| `git apply --cached --check` en un índice temporal cargado con el commit base | El parche de entrega, incluidos los PNG, se puede aplicar al commit auditado. |

La validación se hizo localmente. Quedaron sin verificar los recursos desplegados, las cuentas de servicio efectivas, los permisos de administración, la conectividad real de la VPC, la entrega de alertas y los flujos completos de la aplicación.

## F. Estado final

| Requisito | Estado final | Alcance verificado |
| --- | --- | --- |
| VPC base y VPC con seguridad como código | CUMPLE | Dos fuentes, dos PNG y regeneración local. |
| Entregable de código e instrucciones | CUMPLE | Archivos junto al proyecto, README y pruebas reproducibles. |
| Seguridad y gobernanza para exposición | CUMPLE | Ejemplos locales comprobables de reglas, segmentación, IAM y política de llaves. |
| Política estricta en la aplicación | CUMPLE PARCIALMENTE | Firestore y Storage tienen controles por propiedad y participación. Las reservas confirmadas se consultan por oferta para disponibilidad en web y móvil y para contactos de chat. El rol del perfil, la visibilidad de perfiles, las lecturas de presencia y el tope real de archivos conservan el comportamiento vigente. El ejemplo aislado demuestra el claim y la lectura estricta de reservas. |
| Realtime Database compilable | CUMPLE | El emulador acepta el archivo y verifica escritura propia y denegaciones pertinentes. |
| Cifrado | CUMPLE PARCIALMENTE | Evidencia del control administrado. Keychain/Keystore para persistencia de Auth queda pendiente en la aplicación. |
| FinOps como código | CUMPLE PARCIALMENTE | Presupuesto global, alertas, etiquetas y ciclo de vida demostrados. Las partidas por servicio requieren conciliar los montos entre las fuentes. El tope de instancias por función y el etiquetado global quedan como políticas del diseño. |
| Estado real de infraestructura y controles operativos | PENDIENTE | Requiere un inventario y evidencia del proyecto cloud. La entrega valida código y ejemplos en local. |
