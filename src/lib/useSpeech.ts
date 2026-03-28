import { useState, useEffect, useCallback, useRef } from "react";

export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';

      recog.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setFinalTranscript(prev => prev + final);
        setInterimTranscript(interim);
      };

      recog.onerror = (event: any) => {
        if (event.error === 'no-speech') return; // Expected when user pauses talking
        console.error("Speech Recognition Error", event.error);
        setIsListening(false);
      };

      recog.onend = () => {
         // Auto-restart if we expected it to still be listening (quirk of continuous=true in some browsers)
         // For now, we just flip the state cleanly.
         setIsListening(false);
      };

      recognitionRef.current = recog;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
    
    // Cleanup voices cache bug in Chrome occasionally
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }, []);

  const listen = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setFinalTranscript("");
      setInterimTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Handle race conditions where start() is called when already started
        console.error("Already started", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback((callback?: (text: string) => void) => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      
      // Allow the final buffer to catch up
      setTimeout(() => {
         if (callback) {
           callback(finalTranscript + interimTranscript);
         }
      }, 500);
    }
  }, [isListening, finalTranscript, interimTranscript]);

  const speak = useCallback((text: string, onEnd?: () => void, onStart?: () => void) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      // Try to find a pleasant female voice
      const femaleVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google UK English Female'))) 
                          || voices.find(v => v.lang.includes('US') || v.lang.includes('UK'));
      
      if (femaleVoice) {
         utterance.voice = femaleVoice;
      }
      
      utterance.rate = 0.95; // Slightly slower for empathetic medical tone
      utterance.pitch = 1.0;
      
      utterance.onstart = () => {
         if (onStart) onStart();
      }

      utterance.onend = () => {
         if (onEnd) onEnd();
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Text-to-Speech not supported.");
      if (onEnd) onEnd();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
     if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
     }
  }, []);

  return { listen, stopListening, isListening, transcript: finalTranscript + interimTranscript, speak, stopSpeaking };
}
