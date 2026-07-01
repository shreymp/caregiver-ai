/**
 * Minimal ambient typing for the Web Speech API's SpeechRecognition — not
 * shipped in TypeScript's lib.dom.d.ts (only its result sub-interfaces are),
 * and browser support is still vendor-prefixed in places, so we declare only
 * the surface this adapter actually uses.
 */
interface MinimalSpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * CLAUDE.md tech stack note: Web Speech API chosen over an in-browser
 * Whisper model for voice capture (M9) — no extra model download, works
 * immediately. Documented limitation: on iOS Safari, Web Speech may route
 * audio through Apple's servers rather than staying fully on-device; see
 * DECISIONS.md.
 */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== undefined;
}

export interface VoiceCaptureAdapter {
  start(onResult: (transcript: string) => void, onError?: (message: string) => void): void;
  stop(): void;
}

export class WebSpeechVoiceCaptureAdapter implements VoiceCaptureAdapter {
  private recognition: MinimalSpeechRecognition | undefined;

  start(onResult: (transcript: string) => void, onError?: (message: string) => void): void {
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new RecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      onResult(transcript);
    };
    recognition.onerror = (event) => {
      onError?.(event.error);
    };
    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }
}
