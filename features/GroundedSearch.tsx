import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Message } from '../types';
import * as geminiService from '../services/geminiService';
import { Loader } from '../components/ui/Loader';
import { Send, Globe, MapPin, Trash2, Link as LinkIcon } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type ToolOption = 'googleSearch' | 'googleMaps';

const GroundedSearch: React.FC = () => {
    const [messages, setMessages] = useLocalStorage<Message[]>('jux-grounded-history', []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tool, setTool] = useState<ToolOption>('googleSearch');
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (tool === 'googleMaps' && !location) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (err) => {
                    console.warn("Could not get location:", err.message);
                    setError("Impossible d'accéder à votre localisation. La recherche sur Maps pourrait être moins précise.");
                }
            );
        }
    }, [tool, location]);
    
    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;
        if(tool === 'googleMaps' && !location){
            setError("L'accès à la localisation est requis pour la recherche Maps. Veuillez l'activer dans votre navigateur.");
            return;
        }

        const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const {text, sources} = await geminiService.generateTextWithGrounding(input, tool, location || undefined);
            const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text, sources };
            setMessages(prev => [...prev, modelMessage]);
        } catch (err) {
            setError('Échec de la récupération de la réponse. Veuillez réessayer.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, tool, location, setMessages]);
    
    const clearHistory = () => {
        setMessages([]);
    };

    const ToolButton: React.FC<{ type: ToolOption; icon: React.ElementType; label: string }> = ({ type, icon: Icon, label }) => (
        <button
            onClick={() => setTool(type)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-colors ${tool === type ? 'bg-light-primary text-white dark:bg-dark-primary' : 'bg-light-surface dark:bg-dark-surface hover:bg-black/10 dark:hover:bg-white/10'}`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-4 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
                         {msg.role === 'model' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-light-primary dark:bg-dark-primary flex items-center justify-center text-white font-bold text-sm">J</div>}
                        <div className={`p-4 rounded-2xl max-w-lg ${msg.role === 'user' ? 'bg-light-primary text-white dark:bg-dark-primary' : 'bg-light-surface dark:bg-dark-surface'}`}>
                           <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.text) as string) }} />
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-light-border dark:border-dark-border">
                                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><LinkIcon size={12}/> Sources :</h4>
                                    <ul className="space-y-1">
                                        {msg.sources.map((source, i) => (
                                            <li key={i}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-light-primary dark:text-dark-primary hover:underline truncate block">
                                                    {source.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                         {msg.role === 'user' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center font-bold text-sm">V</div>}
                    </div>
                ))}
                 {isLoading && (
                    <div className="flex gap-4 items-start">
                         <div className="flex-shrink-0 h-8 w-8 rounded-full bg-light-primary dark:bg-dark-primary flex items-center justify-center text-white font-bold text-sm">J</div>
                        <div className="p-4 rounded-2xl bg-light-surface dark:bg-dark-surface">
                            <Loader size="sm" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            
             <div className="mt-auto pt-2 bg-light-background dark:bg-dark-background">
                {error && <p className="text-red-500 text-center mb-2">{error}</p>}
                <div className="flex items-center justify-center gap-2 mb-2">
                    <ToolButton type="googleSearch" icon={Globe} label="Recherche Web" />
                    <ToolButton type="googleMaps" icon={MapPin} label="Recherche Maps" />
                </div>
                <form onSubmit={handleSubmit} className="relative">
                    <div className="flex items-center p-2 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border focus-within:ring-2 focus-within:ring-light-primary dark:focus-within:ring-dark-primary">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder={tool === 'googleSearch' ? "Posez des questions sur l'actualité..." : 'Trouvez des lieux près de chez vous...'}
                            className="flex-1 bg-transparent focus:outline-none resize-none px-2 max-h-36"
                            rows={1}
                        />
                         <button type="button" onClick={clearHistory} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-subtle dark:text-dark-subtle" title="Effacer l'historique">
                            <Trash2 size={20} />
                        </button>
                        <button type="submit" disabled={isLoading || !input.trim()} className="p-2 ml-2 rounded-full bg-light-primary dark:bg-dark-primary text-white disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GroundedSearch;