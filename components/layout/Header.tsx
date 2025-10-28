import React, { useContext } from 'react';
import { AppContext } from '../../App';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Theme } from '../../types';
import { Home } from 'lucide-react';

interface HeaderProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme }) => {
    const context = useContext(AppContext);
    if (!context) return null;
    
    const { activeTool, setActiveTool } = context;
    const Icon = activeTool.icon;
    const isChat = activeTool.id === 'chat';

    return (
        <header className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
                 {!isChat && (
                    <button 
                        onClick={() => setActiveTool('chat')} 
                        className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors -ml-2"
                        aria-label="Accueil"
                    >
                        <Home className="h-6 w-6 text-light-subtle dark:text-dark-subtle" />
                    </button>
                )}
                <Icon className="h-6 w-6 text-light-primary dark:text-dark-primary" />
                <h1 className="text-xl font-semibold text-light-text dark:text-dark-text">{activeTool.name}</h1>
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
        </header>
    );
}