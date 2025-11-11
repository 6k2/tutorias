import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ChatLayout } from '../../features/chat/ChatLayout';
import { ChatSidebar } from '../../features/chat/ChatSidebar';
import { ChatThread } from '../../features/chat/ChatThread';
import { useAuthUser } from '../../features/chat/hooks/useAuthUser';
import { useSelfPresence } from '../../features/chat/hooks/usePresence';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function ChatsScreen() {
  const currentUser = useAuthUser();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);

  useSelfPresence(currentUser?.uid);

  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const threadProps = useMemo(() => {
    if (!selectedConversation) return { conversation: null, partner: null };
    if (selectedPartner) {
      return { conversation: selectedConversation, partner: selectedPartner };
    }
    const partner = selectedConversation.participants?.find(
      (participant) => participant.uid !== currentUser?.uid
    );
    return { conversation: selectedConversation, partner: partner || null };
  }, [selectedConversation, selectedPartner, currentUser?.uid]);

  const handleSelectConversation = (conversation, partner) => {
    setSelectedConversation(conversation);
    setSelectedPartner(partner || null);
  };

  if (currentUser === undefined) {
    return (
      <View style={styles.centered}> 
        <ActivityIndicator color={tintColor} />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.centered}> 
        <Text style={[styles.infoText, { color: textColor }]}>Inicia sesión para usar los chats.</Text>
      </View>
    );
  }

  return (
    <ChatLayout
      sidebar={
        <ChatSidebar
          currentUid={currentUser.uid}
          onSelectConversation={handleSelectConversation}
          activeConversationId={selectedConversation?.id || null}
        />
      }
      thread={
        <ChatThread
          conversation={threadProps.conversation}
          currentUser={currentUser}
          partner={threadProps.partner}
        />
      }
      isThreadOpen={Boolean(selectedConversation)}
      onBack={() => {
        setSelectedConversation(null);
        setSelectedPartner(null);
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
