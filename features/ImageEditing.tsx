import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { Loader } from '../components/ui/Loader';
import { UploadCloud, Edit3 } from 'lucide-react';
import { fileToBase64, getMimeType } from '../utils/fileUtils';

const ImageEditing: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [originalImage, setOriginalImage] = useState<{file: File, preview: string} | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setOriginalImage({ file, preview: URL.createObjectURL(file) });
            setEditedImage(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || !originalImage || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            const base64Data = await fileToBase64(originalImage.file);
            const mimeType = getMimeType(originalImage.file);
            const result = await editImage(prompt, base64Data, mimeType);
            setEditedImage(result);
        } catch (err) {
            setError("Une erreur est survenue lors de la modification de l'image.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="flex flex-col gap-4">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer aspect-square w-full bg-light-surface dark:bg-dark-surface rounded-lg border-2 border-dashed border-light-border dark:border-dark-border flex flex-col justify-center items-center text-light-subtle dark:text-dark-subtle hover:border-light-primary dark:hover:border-dark-primary transition-colors"
                    >
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                        {originalImage ? (
                             <img src={originalImage.preview} alt="Original" className="max-h-full max-w-full object-contain rounded-lg" />
                        ) : (
                            <>
                                <UploadCloud className="h-12 w-12 mb-2" />
                                <p className="font-semibold">Cliquez pour téléverser une image</p>
                                <p className="text-sm">PNG, JPG, WEBP</p>
                            </>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                         <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="ex: Ajouter un filtre rétro, supprimer la personne en arrière-plan"
                            className="w-full p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary focus:outline-none"
                            rows={3}
                            disabled={!originalImage}
                        />
                         <button
                            type="submit"
                            disabled={isLoading || !prompt.trim() || !originalImage}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-light-primary hover:bg-light-primary-hover dark:bg-dark-primary dark:hover:bg-dark-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-primary dark:focus:ring-dark-primary disabled:opacity-50"
                        >
                           <Edit3 size={18} /> {isLoading ? 'Édition...' : "Modifier l'image"}
                        </button>
                    </form>
                     {error && <p className="text-red-500 text-center">{error}</p>}
                </div>
                {/* Output Column */}
                <div className="aspect-square w-full bg-light-surface dark:bg-dark-surface rounded-lg border border-dashed border-light-border dark:border-dark-border flex justify-center items-center">
                    {isLoading ? (
                        <Loader text="Application des modifications..." />
                    ) : editedImage ? (
                        <img src={`data:image/png;base64,${editedImage}`} alt="Edited" className="max-h-full max-w-full object-contain rounded-lg" />
                    ) : (
                         <div className="text-center text-light-subtle dark:text-dark-subtle p-8">
                            <Edit3 className="mx-auto h-12 w-12" />
                            <p className="mt-2">Votre image modifiée apparaîtra ici.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ImageEditing;