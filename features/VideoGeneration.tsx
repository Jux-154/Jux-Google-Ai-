import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as geminiService from '../services/geminiService';
import { Loader } from '../components/ui/Loader';
import { UploadCloud, Video, AlertTriangle } from 'lucide-react';
import { fileToBase64, getMimeType } from '../utils/fileUtils';
import type { GenerateVideosOperation } from '@google/genai';

// Fix: Removed conflicting global declaration for `window.aistudio`.
// The type is expected to be provided by the environment, and this re-declaration was causing a conflict.

type Status = 'IDLE' | 'NEEDS_KEY' | 'GENERATING' | 'POLLING' | 'SUCCESS' | 'ERROR';
const aspectRatios = ['16:9', '9:16'] as const;
type AspectRatio = typeof aspectRatios[number];

const loadingMessages = [
    "Préchauffage des caméras virtuelles...",
    "Chorégraphie des pixels...",
    "Rendu de votre vision en réalité...",
    "Cela peut prendre quelques minutes, veuillez patienter...",
    "Presque terminé, ajout des touches finales..."
];

const VideoGeneration: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<number | null>(null);
    
    useEffect(() => {
        if (status === 'POLLING') {
            const intervalId = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    return loadingMessages[(currentIndex + 1) % loadingMessages.length];
                });
            }, 5000);
            return () => window.clearInterval(intervalId);
        }
    }, [status]);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
            return true;
        }
        setStatus('NEEDS_KEY');
        return false;
    }, []);
    
    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success and let the user try again
            setStatus('IDLE');
        } else {
            setError("La sélection de la clé API n'est pas disponible dans cet environnement.");
        }
    };
    
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setImage({ file, preview: URL.createObjectURL(file) });
        }
    };

    const pollOperation = useCallback(async (operation: GenerateVideosOperation) => {
        pollIntervalRef.current = window.setInterval(async () => {
            try {
                const updatedOp = await geminiService.pollVideoOperation(operation);
                if (updatedOp.done) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    const downloadLink = updatedOp.response?.generatedVideos?.[0]?.video?.uri;
                    if (downloadLink) {
                         // Must append API key to fetch
                         const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                         const blob = await response.blob();
                         setVideoUrl(URL.createObjectURL(blob));
                         setStatus('SUCCESS');
                    } else {
                        throw new Error("La génération de vidéo est terminée mais aucune URI de vidéo n'a été trouvée.");
                    }
                }
            } catch (err) {
                 if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                 setError("La récupération a échoué. Veuillez réessayer.");
                 setStatus('ERROR');
                 console.error(err);
            }
        }, 10000);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || status === 'GENERATING' || status === 'POLLING') return;
        
        const hasKey = await checkApiKey();
        if (!hasKey) return;

        setStatus('GENERATING');
        setError(null);
        setVideoUrl(null);
        
        try {
            let imagePayload = null;
            if (image) {
                const data = await fileToBase64(image.file);
                const mimeType = getMimeType(image.file);
                imagePayload = { data, mimeType };
            }
            
            const operation = await geminiService.generateVideo(prompt, imagePayload, aspectRatio);
            setStatus('POLLING');
            pollOperation(operation);

        } catch (err: any) {
            let errorMessage = "Une erreur est survenue lors de la génération de la vidéo.";
            if (err.message && err.message.includes("Requested entity was not found.")) {
                errorMessage = "Votre clé API est invalide. Veuillez en sélectionner une valide.";
                setStatus('NEEDS_KEY');
            } else {
                 setStatus('ERROR');
            }
            setError(errorMessage);
            console.error(err);
        }
    };

    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const isLoading = status === 'GENERATING' || status === 'POLLING';

    return (
        <div className="max-w-3xl mx-auto">
             {status === 'NEEDS_KEY' && (
                <div className="bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 rounded-md mb-6" role="alert">
                    <div className="flex">
                        <div className="py-1"><AlertTriangle className="h-5 w-5 text-yellow-500 mr-3" /></div>
                        <div>
                            <p className="font-bold">Clé API requise</p>
                            <p className="text-sm">Veuillez sélectionner une clé API pour utiliser la génération de vidéos Veo. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">Infos de facturation</a></p>
                            <button onClick={handleSelectKey} className="mt-2 px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600">Sélectionner une clé API</button>
                        </div>
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer aspect-video w-full bg-light-surface dark:bg-dark-surface rounded-lg border-2 border-dashed border-light-border dark:border-dark-border flex flex-col justify-center items-center text-light-subtle dark:text-dark-subtle hover:border-light-primary dark:hover:border-dark-primary transition-colors"
                >
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                    {image ? (
                         <img src={image.preview} alt="Starting frame" className="max-h-full max-w-full object-contain rounded-lg" />
                    ) : (
                        <>
                            <UploadCloud className="h-10 w-10 mb-2" />
                            <p className="font-semibold">Téléverser une image de départ (optionnel)</p>
                        </>
                    )}
                </div>
                 <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="ex: Un hologramme néon d'un chat conduisant à toute vitesse"
                    className="w-full p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary focus:outline-none"
                    rows={3}
                />
                 <div>
                    <div className="grid grid-cols-2 gap-2">
                        {aspectRatios.map((ratio) => (
                        <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatio(ratio)}
                            className={`p-2 rounded-md transition-colors text-sm border ${ aspectRatio === ratio ? 'bg-light-primary text-white border-light-primary dark:bg-dark-primary dark:border-dark-primary' : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border hover:border-light-primary dark:hover:border-dark-primary'}`}
                        >
                            {ratio === '16:9' ? 'Paysage' : 'Portrait'}
                        </button>
                        ))}
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !prompt.trim() || status === 'NEEDS_KEY'}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-light-primary hover:bg-light-primary-hover dark:bg-dark-primary dark:hover:bg-dark-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-primary dark:focus:ring-dark-primary disabled:opacity-50"
                >
                    {isLoading ? 'Génération...' : 'Générer la vidéo'}
                </button>
            </form>
             {error && <p className="text-red-500 text-center mt-4">{error}</p>}
            <div className="mt-8 flex justify-center items-center aspect-video bg-black rounded-lg">
                {isLoading ? (
                    <Loader text={loadingMessage} />
                ) : videoUrl ? (
                    <video src={videoUrl} controls autoPlay loop className="max-w-full max-h-full rounded-lg" />
                ) : (
                    <div className="text-center text-light-subtle dark:text-dark-subtle p-8">
                        <Video className="mx-auto h-12 w-12" />
                        <p className="mt-2">Votre vidéo générée apparaîtra ici.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoGeneration;