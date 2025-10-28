
import React, { useState, useMemo, createContext, useEffect } from 'react';
// Sidebar a été supprimé car il n'est plus utilisé.
import { TOOLS } from './constants';
import { Theme, ToolId, Tool } from './types';
import { Header } from './components/layout/Header';

interface AppContextType {
  activeTool: Tool;
  setActiveTool: (toolId: ToolId) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

const App: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<ToolId>('chat');
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme') as Theme;
      if (storedTheme) return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const activeTool = useMemo(() => TOOLS.find(tool => tool.id === activeToolId) || TOOLS[0], [activeToolId]);

  const setActiveTool = (toolId: ToolId) => {
    setActiveToolId(toolId);
  };

  const ActiveComponent = activeTool.component;

  return (
    <AppContext.Provider value={{ activeTool, setActiveTool }}>
      <div className={`h-screen font-sans text-light-text dark:text-dark-text bg-light-background dark:bg-dark-background`}>
        <main className="flex flex-col h-screen">
          <Header theme={theme} setTheme={setTheme} />
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <ActiveComponent />
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
};

export default App;
