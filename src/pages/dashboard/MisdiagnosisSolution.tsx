import { useMemo, useState } from "react";
import { FileText, Fingerprint, Mic, Square } from "lucide-react";
import jsPDF from "jspdf";

export default function MisdiagnosisSolution() {
  const [isListening, setIsListening] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [mockHash, setMockHash] = useState("");
  const [status, setStatus] = useState("Idle");
  const [recognitionRef, setRecognitionRef] = useState<any>(null);

  const transcriptLength = useMemo(() => transcript.trim().length, [transcript]);

  async function sha256(text: string) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function startDiagnosisTranscription() {
    const AnyWindow = window as any;
    const SpeechRecognition = AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening...");
    };
    recognition.onend = () => {
      setIsListening(false);
      setLiveText("");
      setStatus("Stopped");
    };
    recognition.onerror = (event: any) => {
      setStatus(`Recognition error: ${event.error || "unknown"}`);
    };
    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (finalText) setTranscript((prev) => `${prev} ${finalText}`.trim());
      setLiveText(interim);
    };

    setRecognitionRef(recognition);
    recognition.start();
  }

  async function endDiagnosisAndGenerate() {
    if (recognitionRef) recognitionRef.stop();
    const normalized = transcript.trim();
    if (!normalized) {
      setStatus("No transcript captured yet.");
      return;
    }
    const hash = await sha256(normalized);
    setMockHash(hash);
    setStatus("Diagnosis ended. Mock blockchain hash generated.");
  }

  function downloadPrescriptionPdf() {
    if (!transcript.trim()) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 44;
    let y = 56;
    doc.setFontSize(18);
    doc.text("Doctor Prescription / Diagnosis Report", margin, y);
    y += 24;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 16;
    doc.text(`Blockchain Hash (simulation): ${mockHash || "Pending. End diagnosis first."}`, margin, y);
    y += 22;
    doc.setFontSize(12);
    doc.text("Transcription", margin, y);
    y += 14;
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(transcript.trim(), 520);
    doc.text(lines, margin, y);
    doc.save(`misdiagnosis-report-${Date.now()}.pdf`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tight">Misdiagnosis Solution</h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Frontend simulation: record diagnosis transcription, generate mock hash, export accountability PDF.
        </p>
      </div>

      <div className="bg-card border-2 border-border rounded-xl shadow-soft p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startDiagnosisTranscription}
            disabled={isListening}
            className="px-4 py-3 rounded-xl border-2 border-foreground bg-tertiary font-bold disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Mic className="w-4 h-4" /> Start Diagnosis Transcription
          </button>
          <button
            type="button"
            onClick={endDiagnosisAndGenerate}
            className="px-4 py-3 rounded-xl border-2 border-foreground bg-white font-bold inline-flex items-center gap-2"
          >
            <Square className="w-4 h-4" /> End Diagnosis
          </button>
          <button
            type="button"
            onClick={downloadPrescriptionPdf}
            className="px-4 py-3 rounded-xl border-2 border-foreground bg-quaternary text-white font-bold inline-flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Download Prescription PDF
          </button>
        </div>

        <p className="text-sm font-semibold text-muted-foreground">Status: {status}</p>
        {liveText && <p className="text-sm italic">Live: {liveText}</p>}

        <div className="border-2 border-border rounded-xl p-4 bg-background">
          <p className="text-xs uppercase font-black text-muted-foreground mb-2">Stored Multilingual Transcription</p>
          <p className="text-sm whitespace-pre-wrap min-h-[120px]">{transcript || "No transcription stored yet."}</p>
        </div>

        <div className="border-2 border-border rounded-xl p-4 bg-muted/30">
          <p className="text-xs uppercase font-black text-muted-foreground mb-2 inline-flex items-center gap-2">
            <Fingerprint className="w-4 h-4" /> Blockchain Hash (Simulation)
          </p>
          <p className="text-xs font-mono break-all">{mockHash || "Will be generated after ending diagnosis."}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Simulation note: blockchain write/send pipeline is intentionally mocked here and can be wired later.
        </p>
      </div>
    </div>
  );
}

