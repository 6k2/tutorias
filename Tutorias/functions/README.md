# Firebase Functions (Chat helpers)

## Requisitos rápidos
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

## Flujo de trabajo
1. `cd functions`
2. Instala dependencias: `npm install`
3. Para usar el código TypeScript (`index.ts`) ejecuta `npx tsc index.ts --outDir lib` o configura un build real (TODO).
4. Emula con `firebase emulators:start --only functions`
5. Despliega con `npm run deploy`

> TODO: agregar build paso a paso cuando formalicemos el pipeline TS.
