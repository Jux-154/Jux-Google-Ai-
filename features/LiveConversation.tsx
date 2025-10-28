import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as geminiService from '../services/geminiService';
import { decode, decodeAudioData, encode } from '../utils/audioUtils';
import { Loader } from '../components/ui/Loader';
import { Mic, MicOff, Bot, User } from 'lucide-react';
import type { LiveServerMessage, LiveSession, Blob } from '@google/genai';

type Transcript = {
  id: string;
  speaker: 'user' | 'model';
  text: string;
  isFinal: boolean;
};

type Status = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';

const LiveConversation: React.FC = () => {
    const [status, setStatus] = useState<Status>('IDLE');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    
    // Refs for transcript updates to avoid stale closures
    const currentInputTranscriptRef = useRef('');
    const currentOutputTranscriptRef = useRef('');

    const cleanup = useCallback(() => {
        console.log('Cleaning up resources...');
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close()).catch(console.error);
            sessionPromiseRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.error);
            outputAudioContextRef.current = null;
        }
        for (const source of sourcesRef.current.values()) {
            try {
                source.stop();
            } catch (e) {
                // may already be stopped
            }
        }
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        currentInputTranscriptRef.current = '';
        currentOutputTranscriptRef.current = '';
    }, []);

    const handleStart = async () => {
        if (status !== 'IDLE' && status !== 'ERROR') return;
        
        setError(null);
        setTranscripts([]);
        setStatus('CONNECTING');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputAudioContext;

            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputAudioContext;

            const outputNode = outputAudioContext.createGain();
            outputNode.connect(outputAudioContext.destination);

            const sessionPromise = geminiService.connectLive({
                onopen: () => {
                    console.log('Connection opened.');
                    setStatus('LISTENING');

                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob: Blob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        
                        sessionPromiseRef.current?.then((session) => {
                           session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const { text } = message.serverContent.inputTranscription;
                        currentInputTranscriptRef.current += text;
                        setTranscripts(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.speaker === 'user' && !last.isFinal) {
                                return [...prev.slice(0, -1), { ...last, text: currentInputTranscriptRef.current }];
                            }
                            return [...prev, { id: `user-${Date.now()}`, speaker: 'user', text: currentInputTranscriptRef.current, isFinal: false }];
                        });
                    } else if (message.serverContent?.outputTranscription) {
                        const { text } = message.serverContent.outputTranscription;
                         currentOutputTranscriptRef.current += text;
                         setStatus('SPEAKING');
                        setTranscripts(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.speaker === 'model' && !last.isFinal) {
                                return [...prev.slice(0, -1), { ...last, text: currentOutputTranscriptRef.current }];
                            }
                            return [...prev, { id: `model-${Date.now()}`, speaker: 'model', text: currentOutputTranscriptRef.current, isFinal: false }];
                        });
                    }

                    if (message.serverContent?.turnComplete) {
                        setTranscripts(prev => prev.map(t => ({...t, isFinal: true})));
                        currentInputTranscriptRef.current = '';
                        currentOutputTranscriptRef.current = '';
                        setStatus('LISTENING');
                    }

                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData && outputAudioContext) {
                        setStatus('SPEAKING');
                        const decodedData = decode(audioData);
                        const audioBuffer = await decodeAudioData(decodedData, outputAudioContext, 24000, 1);
                        
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);

                        const sourceNode = outputAudioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(outputNode);

                        sourceNode.addEventListener('ended', () => {
                            sourcesRef.current.delete(sourceNode);
                            if (sourcesRef.current.size === 0 && status !== 'IDLE' && status !== 'ERROR') {
                                setStatus('LISTENING');
                            }
                        });
                        
                        sourceNode.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(sourceNode);
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of sourcesRef.current.values()) {
                            source.stop();
                        }
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: Event) => {
                    console.error('Connection error:', e);
                    setError('Une erreur de connexion est survenue. Veuillez réessayer.');
                    setStatus('ERROR');
                    cleanup();
                },
                onclose: () => {
                    console.log('Connection closed.');
                    setStatus('IDLE');
                    cleanup();
                },
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (err) {
            console.error('Failed to start conversation:', err);
            let errorMessage = "Impossible de démarrer la conversation. Vérifiez les autorisations du microphone.";
            if (err instanceof Error && err.name === 'NotAllowedError') {
                errorMessage = "L'autorisation du microphone est requise pour démarrer une conversation.";
            }
            setError(errorMessage);
            setStatus('ERROR');
            cleanup();
        }
    };

    const handleStop = () => {
        if (!sessionPromiseRef.current) {
            cleanup(); // Fallback cleanup if session wasn't even created
            setStatus('IDLE');
            return;
        }

        sessionPromiseRef.current.then(session => {
            session.close();
        }).catch(err => {
            console.error("Error closing session:", err);
            // Even if closing fails, do the cleanup
            cleanup();
            setStatus('IDLE');
        });
        // onclose will handle the rest of the cleanup and state changes
    };

    useEffect(() => {
        return () => {
            handleStop();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getStatusText = () => {
        switch (status) {
            case 'IDLE': return 'Prêt à discuter';
            case 'CONNECTING': return 'Connexion...';
            case 'LISTENING': return 'En écoute...';
            case 'SPEAKING': return 'Jux parle...';
            case 'ERROR': return "Erreur";
            default: return '';
        }
    };

    const renderTranscript = (transcript: Transcript) => {
        const Icon = transcript.speaker === 'user' ? User : Bot;
        const bgColor = transcript.speaker === 'user' ? 'bg-light-surface dark:bg-dark-surface' : 'bg-light-primary/10 dark:bg-dark-primary/20';
        const textColor = transcript.speaker === 'user' ? '' : 'text-light-primary dark:text-dark-primary';

        return (
            <div key={transcript.id} className={`flex items-start gap-3 p-3 rounded-lg ${bgColor}`}>
                <div className="flex-shrink-0">
                    <Icon className={`h-6 w-6 ${textColor}`} />
                </div>
                <p className={`pt-0.5 ${!transcript.isFinal ? 'opacity-70' : ''}`}>
                    {transcript.text || <span className="italic">...</span>}
                </p>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto items-center pb-8">
            <div className="w-full text-center p-4 border-b border-light-border dark:border-dark-border mb-4">
                <p className="text-lg font-semibold">{getStatusText()}</p>
                 {status === 'LISTENING' && <div className="h-1 w-24 bg-light-primary dark:bg-dark-primary rounded-full mx-auto mt-2 animate-pulse" />}
                 {status === 'SPEAKING' && <div className="h-1 w-24 bg-green-500 rounded-full mx-auto mt-2 animate-pulse" />}
            </div>

            <div className="flex-1 w-full overflow-y-auto mb-4 space-y-3 p-2">
                {transcripts.length === 0 && (status === 'IDLE' || status === 'ERROR') && (
                    <div className="flex flex-col items-center justify-center h-full text-light-subtle dark:text-dark-subtle">
                        <Mic className="h-24 w-24 mb-4" />
                        <p className="text-xl">Cliquez sur le micro pour commencer</p>
                    </div>
                )}
                {transcripts.map(renderTranscript)}
                 {status === 'CONNECTING' && <div className="flex justify-center items-center h-full"><Loader text="Établissement d'une connexion sécurisée..." /></div>}
            </div>
            
             <div className="mt-auto pt-4 flex flex-col items-center">
                 {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <button
                    onClick={status === 'IDLE' || status === 'ERROR' ? handleStart : handleStop}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                        ${status === 'LISTENING' || status === 'SPEAKING' || status === 'CONNECTING' ? 'bg-red-500 hover:bg-red-600' : 'bg-light-primary dark:bg-dark-primary hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover'}
                    `}
                    aria-label={status === 'IDLE' || status === 'ERROR' ? 'Start conversation' : 'Stop conversation'}
                >
                    {status === 'LISTENING' || status === 'SPEAKING' || status === 'CONNECTING' ? 
                        <MicOff className="h-10 w-10 text-white" /> : 
                        <Mic className="h-10 w-10 text-white" />}
                </button>
            </div>
        </div>
    );
};

export default LiveConversation;
