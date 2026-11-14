const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

const proyecto = 'demo-tutorias';
const app = join(__dirname, '../..');
const leer = (ruta) => readFileSync(ruta, 'utf8');
const reserva = { studentId: 'est1', teacherId: 'doc1', status: 'pending' };

async function prepararFirestore(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('reservations/oferta1_est1').set(reserva);
    await db.doc('offers/oferta1').set({ uid: 'doc1', price: 10 });
  });
}

test('reglas referenciadas por Tutorias/firebase.json', async (t) => {
  const config = JSON.parse(leer(join(app, 'firebase.json')));
  const env = await initializeTestEnvironment({
    projectId: proyecto,
    firestore: { rules: leer(join(app, config.firestore.rules)) },
    storage: { rules: leer(join(app, config.storage.rules)) },
    database: { rules: leer(join(app, config.database.rules)) },
  });
  t.after(() => env.cleanup());
  await prepararFirestore(env);

  const estudiante = env.authenticatedContext('est1');
  const docente = env.authenticatedContext('doc1');
  const ajeno = env.authenticatedContext('doc2');
  const anonimo = env.unauthenticatedContext();

  await t.test('Firestore limita la lectura de una reserva pendiente', async () => {
    const ruta = 'reservations/oferta1_est1';
    await assertSucceeds(estudiante.firestore().doc(ruta).get());
    await assertSucceeds(docente.firestore().doc(ruta).get());
    await assertFails(ajeno.firestore().doc(ruta).get());
  });

  await t.test('Firestore limita el catálogo a usuarios autenticados y protege el precio', async () => {
    const ruta = 'offers/oferta1';
    await assertSucceeds(estudiante.firestore().doc(ruta).get());
    await assertFails(anonimo.firestore().doc(ruta).get());
    await assertFails(ajeno.firestore().doc(ruta).update({ price: 20 }));
  });

  await t.test('Storage protege la carga y la lectura de materiales', async () => {
    const ruta = 'materials/oferta1_est1/guia.pdf';
    const archivo = new Uint8Array([37, 80, 68, 70]);
    const metadata = { contentType: 'application/pdf' };
    await assertFails(estudiante.storage().ref(ruta).put(archivo, metadata));
    await assertSucceeds(docente.storage().ref(ruta).put(archivo, metadata));
    await assertSucceeds(estudiante.storage().ref(ruta).getMetadata());
    await assertFails(ajeno.storage().ref(ruta).getMetadata());
  });

  await t.test('Realtime Database limita la escritura de presencia al dueño', async () => {
    const ruta = 'status/est1';
    const now = Date.now();
    const presencia = { online: true, lastSeen: now, expiresAt: now + 30_000 };
    await assertSucceeds(estudiante.database().ref(ruta).set(presencia));
    await assertFails(ajeno.database().ref(ruta).set(presencia));
    await assertFails(anonimo.database().ref(ruta).once('value'));
  });
});

test('ejemplo académico de reservas y rol docente', async (t) => {
  const env = await initializeTestEnvironment({
    projectId: proyecto,
    firestore: { rules: leer(join(__dirname, 'ejemplos/firestore-academico.rules')) },
  });
  t.after(() => env.cleanup());
  await prepararFirestore(env);
  const estudiante = env.authenticatedContext('est1', { rol: 'estudiante' }).firestore();
  const docente = env.authenticatedContext('doc1', { rol: 'docente' }).firestore();
  const ajeno = env.authenticatedContext('doc2', { rol: 'docente' }).firestore();
  const sinClaim = env.authenticatedContext('doc1').firestore();

  await t.test('solo los participantes leen incluso una reserva confirmada', async () => {
    const ruta = 'reservations/oferta1_est1';
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc(ruta).update({ status: 'confirmed' }),
    );
    await assertSucceeds(estudiante.doc(ruta).get());
    await assertSucceeds(docente.doc(ruta).get());
    await assertFails(ajeno.doc(ruta).get());
  });

  await t.test('la edición exige el claim y ser dueño de la oferta', async () => {
    const ruta = 'offers/oferta1';
    await assertSucceeds(docente.doc(ruta).update({ price: 20 }));
    await assertFails(ajeno.doc(ruta).update({ price: 20 }));
    await assertFails(sinClaim.doc(ruta).update({ price: 20 }));
    await assertFails(docente.doc(ruta).update({ uid: 'doc2' }));
  });
});
