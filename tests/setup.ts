import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock Web Speech API SpeechRecognition
if (typeof window !== 'undefined') {
  // @ts-expect-error Mock speech recognition
  window.SpeechRecognition = window.SpeechRecognition || class {
    continuous = false;
    interimResults = false;
    lang = 'hi-IN';
    onstart = null;
    onresult = null;
    onerror = null;
    onend = null;
    start() {}
    stop() {}
    abort() {}
  };
  // @ts-expect-error Mock webkitSpeechRecognition
  window.webkitSpeechRecognition = window.SpeechRecognition;
}
