/**
 * Browser Web Speech API Integration for Hindi/English Rate Search
 */

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

export class VoiceSearchEngine {
  private recognition: any = null;
  private state: SpeechState = 'idle';
  private onStateChange: (state: SpeechState, errorMessage?: string) => void;
  private onResult: (transcript: string) => void;
  private currentLang: 'hi-IN' | 'en-IN' = 'hi-IN';

  constructor(
    onStateChange: (state: SpeechState, errorMessage?: string) => void,
    onResult: (transcript: string) => void
  ) {
    this.onStateChange = onStateChange;
    this.onResult = onResult;

    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.currentLang;

        this.recognition.onstart = () => {
          this.state = 'listening';
          this.onStateChange('listening');
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          const text = (finalTranscript || interimTranscript).trim();
          if (text) {
            this.onResult(text);
          }
        };

        this.recognition.onerror = (event: any) => {
          let err = 'माइक से आवाज़ नहीं मिली';
          if (event.error === 'not-allowed') {
            err = 'माइक की अनुमति नहीं मिली';
          } else if (event.error === 'no-speech') {
            err = 'कोई आवाज़ सुनाई नहीं दी';
          }
          this.state = 'error';
          this.onStateChange('error', err);
        };

        this.recognition.onend = () => {
          this.state = 'idle';
          this.onStateChange('idle');
        };
      } else {
        this.state = 'unsupported';
        this.onStateChange('unsupported');
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public startListening(lang: 'hi-IN' | 'en-IN' = 'hi-IN') {
    if (!this.recognition) {
      this.onStateChange('unsupported');
      return;
    }

    try {
      this.currentLang = lang;
      this.recognition.lang = lang;
      this.recognition.start();
    } catch {
      // If already started or aborting
      this.recognition.stop();
      setTimeout(() => {
        try {
          this.recognition.start();
        } catch {
          this.onStateChange('error');
        }
      }, 100);
    }
  }

  public stopListening() {
    if (this.recognition && this.state === 'listening') {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
  }
}
