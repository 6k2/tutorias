import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const soundAssets = {
  send: require('../../../assets/sounds/chat-send.wav'),
  receive: require('../../../assets/sounds/chat-receive.wav'),
};

export function useChatSounds() {
  const sendSoundRef = useRef(null);
  const receiveSoundRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadSounds = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const [sendResult, receiveResult] = await Promise.all([
          Audio.Sound.createAsync(soundAssets.send, { volume: 0.4 }),
          Audio.Sound.createAsync(soundAssets.receive, { volume: 0.45 }),
        ]);
        if (!mounted) {
          await Promise.all([
            sendResult.sound.unloadAsync(),
            receiveResult.sound.unloadAsync(),
          ]);
          return;
        }
        sendSoundRef.current = sendResult.sound;
        receiveSoundRef.current = receiveResult.sound;
      } catch (error) {
        console.warn('chat: failed to preload sounds', error);
      }
    };
    loadSounds();
    return () => {
      mounted = false;
      Promise.all([
        sendSoundRef.current?.unloadAsync() ?? Promise.resolve(),
        receiveSoundRef.current?.unloadAsync() ?? Promise.resolve(),
      ]).catch(() => {});
    };
  }, []);

  const playSend = useCallback(async () => {
    try {
      await sendSoundRef.current?.replayAsync();
    } catch (error) {
      console.debug('chat: send sound skipped', error?.message);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const playReceive = useCallback(async () => {
    try {
      await receiveSoundRef.current?.replayAsync();
    } catch (error) {
      console.debug('chat: receive sound skipped', error?.message);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return { playSend, playReceive };
}
