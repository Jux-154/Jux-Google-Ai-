import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Message } from '../types';
import * as geminiService from '../services/geminiService';
import { Loader } from '../components/ui/Loader';
import { Send, Plus, Trash2, BrainCircuit, Zap, UploadCloud } from 'lucide-react';
import { fileToBase64, getMimeType } from '../utils/fileUtils';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AppContext } from '../App';
import { TOOLS } from '../constants';

type ModelOption = 'flash' | 'pro' | 'lite';

const Chat: React.FC = () => {
    const [messages, setMessages] = useLocalStorage<Message[]>('jux-chat-history', []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [image, setImage] = useState<{file: File, preview: string} | null>(null);
    const [model, setModel] = useState<ModelOption>('flash');
    const [isToolPopoverOpen, setIsToolPopoverOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    
    const context = useContext(AppContext);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                setIsToolPopoverOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setImage({ file, preview: URL.createObjectURL(file) });
            setIsToolPopoverOpen(false);
        }
    };
    
    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input, image: image?.preview };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        let imagePart = null;
        if (image) {
            const base64Data = await fileToBase64(image.file);
            const mimeType = getMimeType(image.file);
            imagePart = { inlineData: { data: base64Data, mimeType } };
            setImage(null);
        }

        try {
            let response;
            if (model === 'pro') {
                response = await geminiService.generateTextWithThinking(input);
            } else {
                const geminiModel = model === 'lite' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
                response = await geminiService.generateText(input, imagePart, geminiModel);
            }
            
            const modelMessage: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text };
            setMessages(prev => [...prev, modelMessage]);
        } catch (err) {
            setError("Échec de la réponse de l'IA. Veuillez réessayer.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, image, model, setMessages]);
    
    const clearHistory = () => {
        setMessages([]);
    };

    const ModelButton: React.FC<{ type: ModelOption; icon: React.ElementType; label: string }> = ({ type, icon: Icon, label }) => (
        <button
            onClick={() => setModel(type)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full transition-colors ${model === type ? 'bg-light-primary text-white dark:bg-dark-primary' : 'bg-light-surface dark:bg-dark-surface hover:bg-black/10 dark:hover:bg-white/10'}`}
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
                            {msg.image && <img src={msg.image} alt="uploaded content" className="rounded-lg mb-2 max-h-60" />}
                            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.text) as string) }} />
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
                    <ModelButton type="lite" icon={Zap} label="Rapide" />
                    <ModelButton type="flash" icon={Zap} label="Équilibré" />
                    <ModelButton type="pro" icon={BrainCircuit} label="Complexe" />
                </div>
                <div className="relative">
                    {isToolPopoverOpen && (
                         <div ref={popoverRef} className="absolute bottom-full mb-2 w-60 bg-light-surface dark:bg-dark-surface rounded-lg shadow-lg border border-light-border dark:border-dark-border p-2 z-20">
                            <button onClick={() => { fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 p-2 text-left rounded-md hover:bg-black/5 dark:hover:bg-white/10">
                                <UploadCloud size={20} className="text-light-subtle dark:text-dark-subtle" />
                                <span>Téléverser une image</span>
                            </button>
                             <div className="my-1 border-t border-light-border dark:border-dark-border" />
                             {TOOLS.filter(t => t.id !== 'chat').map(tool => {
                                const Icon = tool.icon;
                                return (
                                    <button 
                                        key={tool.id} 
                                        onClick={() => context?.setActiveTool(tool.id)}
                                        className="w-full flex items-center gap-3 p-2 text-left rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                                    >
                                        <Icon size={20} className="text-light-subtle dark:text-dark-subtle" />
                                        <span>{tool.name}</span>
                                    </button>
                                );
                            })}
                         </div>
                    )}

                    {image && (
                        <div className="absolute bottom-full left-0 mb-2 p-1 bg-light-surface dark:bg-dark-surface rounded-lg shadow-md">
                            <img src={image.preview} alt="preview" className="h-20 w-20 object-cover rounded" />
                            <button type="button" onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">x</button>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="flex items-center p-2 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border focus-within:ring-2 focus-within:ring-light-primary dark:focus-within:ring-dark-primary">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                        <button ref={triggerRef} type="button" onClick={() => setIsToolPopoverOpen(prev => !prev)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                            <Plus size={20} />
                        </button>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder="Demandez n'importe quoi à Jux..."
                            className="flex-1 bg-transparent focus:outline-none resize-none px-2 max-h-36"
                            rows={1}
                        />
                         <button type="button" onClick={clearHistory} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-subtle dark:text-dark-subtle" title="Effacer l'historique">
                            <Trash2 size={20} />
                        </button>
                        <button type="submit" disabled={isLoading || !input.trim()} className="p-2 ml-2 rounded-full bg-light-primary dark:bg-dark-primary text-white disabled:opacity-50 disabled:cursor-not-allowed">
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;