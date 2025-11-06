import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import type { LiveSession } from '@google/genai';
import { TranscriptEntry } from '../types';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { MicIcon, StopIcon } from './icons/ActionIcons';

const LiveChat: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const cleanup = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        setIsSessionActive(false);
        setStatus('idle');
    }, []);

    const endSession = useCallback(async () => {
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing session:", e);
            } finally {
                sessionPromiseRef.current = null;
            }
        }
        cleanup();
    }, [cleanup]);

    const startSession = useCallback(async () => {
        setError(null);
        setTranscripts([]);
        setStatus('connecting');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // FIX: Cast window to any to support webkitAudioContext for older browsers without TypeScript errors.
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                },
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        
                        setStatus('connected');
                        setIsSessionActive(true);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }

                        // FIX: Correctly type the new transcript entries to match the TranscriptEntry interface.
                        if (message.serverContent?.turnComplete) {
                            const userText = currentInputTranscriptionRef.current.trim();
                            const modelText = currentOutputTranscriptionRef.current.trim();
                            
                            setTranscripts(prev => {
                                const newEntries: TranscriptEntry[] = [];
                                if (userText) {
                                    newEntries.push({ user: 'user', text: userText });
                                }
                                if (modelText) {
                                    newEntries.push({ user: 'model', text: modelText });
                                }
                                return [...prev, ...newEntries];
                            });

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            const outputContext = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputContext.currentTime);
                            
                            const audioBuffer = await decodeAudioData(decode(audioData), outputContext, 24000, 1);
                            const source = outputContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputContext.destination);
                            
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setError(`Session error: ${e.message}`);
                        setStatus('error');
                        cleanup();
                    },
                    onclose: () => {
                        cleanup();
                    },
                },
            });

        } catch (e) {
            console.error('Failed to start session:', e);
            setError(e instanceof Error ? e.message : "An unknown error occurred. Check microphone permissions.");
            setStatus('error');
            cleanup();
        }
    }, [cleanup]);
    
    useEffect(() => {
        return () => {
            endSession();
        };
    }, [endSession]);

    const handleToggleSession = () => {
        if (isSessionActive) {
            endSession();
        } else {
            startSession();
        }
    };
    
    return (
        <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-full h-80 bg-gray-900/70 rounded-lg p-4 overflow-y-auto flex flex-col space-y-4">
                {transcripts.length === 0 && (
                    <div className="flex-grow flex items-center justify-center text-gray-400">
                        <p>Conversation transcript will appear here...</p>
                    </div>
                )}
                {transcripts.map((entry, index) => (
                    <div key={index} className={`flex ${entry.user === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${
                            entry.user === 'user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-700 text-gray-200'
                        }`}>
                            <p>{entry.text}</p>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="flex flex-col items-center space-y-3">
                <button
                    onClick={handleToggleSession}
                    className={`flex items-center justify-center gap-3 w-48 p-4 rounded-full font-bold text-white transition-all duration-300 ease-in-out shadow-lg transform hover:scale-105
                        ${isSessionActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isSessionActive ? <StopIcon /> : <MicIcon />}
                    <span>{isSessionActive ? 'End Session' : 'Start Session'}</span>
                </button>
                <p className="text-sm text-gray-400 h-5">
                    {status === 'connecting' && 'Connecting...'}
                    {status === 'connected' && <span className="text-green-400">Connected</span>}
                    {status === 'error' && <span className="text-red-400">{error || 'An error occurred'}</span>}
                </p>
            </div>
        </div>
    );
};

export default LiveChat;