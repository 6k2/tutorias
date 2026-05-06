import { useRouter } from 'expo-router';
import React from 'react';
import { EmptyState, WebButton, WebShell } from '../components/web/WebUI';

export default function NotFoundWebScreen() {
  const router = useRouter();
  return (
    <WebShell title="Ruta no encontrada" subtitle="Esta página no existe en la experiencia web." active="">
      <EmptyState
        icon="travel-explore"
        title="No encontramos esta ruta"
        text="Vuelve al inicio para seguir explorando materias, reservas y chats."
        action={<WebButton label="Ir al inicio" icon="home" onPress={() => router.replace('/')} />}
      />
    </WebShell>
  );
}
