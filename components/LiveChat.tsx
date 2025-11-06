import React, { useRef, useState } from 'react';
import { TranscriptEntry } from '../types';
import { chatVoice } from '../utils/serverApi';
import { MicIcon, StopIcon } from './icons/ActionIcons';

const LiveChat: React.FC = () => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [recording, setRecording] = useState(false);
  const [instruction, setInstruction] = useState('Responda de forma breve em português.');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setTranscript(prev => [...prev, { user: 'user', text: '🎙️ Áudio enviado' }]);
      const { text, error } = await chatVoice(blob, instruction);
      setTranscript(prev => [...prev, { user: 'model', text: text || error || 'Sem resposta' }]);
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setRecording(true);
  }

  function stop() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="p-4 bg-gray-900/40 rounded-lg border border-gray-700">
      <div className="mb-3">
        <input
          className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-gray-200"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="Instrução opcional para a IA"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {!recording ? (
          <button onClick={start} className="px-4 py-2 rounded bg-emerald-600 text-white flex items-center gap-2">
            <MicIcon /> Gravar
          </button>
        ) : (
          <button onClick={stop} className="px-4 py-2 rounded bg-red-600 text-white flex items-center gap-2">
            <StopIcon /> Parar
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-auto">
        {transcript.map((t, i) => (
          <div key={i} className={t.user === 'user' ? 'text-right' : 'text-left'}>
            <span className="inline-block px-3 py-2 rounded bg-gray-800 text-gray-100">
              <strong>{t.user === 'user' ? 'Você' : 'IA'}:</strong> {t.text}
            </span>
          </div>
        ))}
        {transcript.length === 0 && <p className="text-gray-400 text-sm">Grave uma mensagem para começar.</p>}
      </div>
    </div>
  );
};

export default LiveChat;
