import { useCallback, useRef } from 'react';

export interface VoiceAnnouncementSettings {
  enabled: boolean;
  volume: number; // 0-1
  rate: number; // 0.1-10, default ~1
  pitch: number; // 0-2, default 1
  voice?: string; // voice URI or name
}

const defaultSettings: VoiceAnnouncementSettings = {
  enabled: true,
  volume: 1,
  rate: 1,
  pitch: 1,
};

/**
 * Hook for text-to-speech announcements
 * Uses the Web Speech API (SpeechSynthesis)
 */
export function useTextToSpeech(settings?: Partial<VoiceAnnouncementSettings>) {
  const mergedSettings = { ...defaultSettings, ...settings };
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string, options?: Partial<VoiceAnnouncementSettings>) => {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported in this browser');
        return;
      }

      const finalSettings = { ...mergedSettings, ...options };
      
      if (!finalSettings.enabled) {
        return;
      }

      // Cancel any ongoing speech
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = Math.max(0, Math.min(1, finalSettings.volume));
      utterance.rate = Math.max(0.1, Math.min(10, finalSettings.rate));
      utterance.pitch = Math.max(0, Math.min(2, finalSettings.pitch));

      // Try to set voice if specified
      if (finalSettings.voice) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(
          (v) => v.name === finalSettings.voice
        );
        if (voice) {
          utterance.voice = voice;
        }
      }

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);

      // Clean up ref when done
      utterance.onend = () => {
        utteranceRef.current = null;
      };

      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        utteranceRef.current = null;
      };
    },
    [mergedSettings]
  );

  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
  }, []);

  const isSpeaking = useCallback(() => {
    return window.speechSynthesis.speaking;
  }, []);

  return { speak, cancel, isSpeaking };
}

export default useTextToSpeech;

