
import React, { useContext, useState } from 'react';
import { AppContext } from '../../App';
import { TOOLS } from '../../constants';
import { ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import { ToolId } from '../../types';

export const Sidebar: React.FC = () => {
    const context = useContext(AppContext);
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!context) return null;

    const { activeTool, setActiveTool } = context;

    const handleToolClick = (toolId: ToolId) => {
        setActiveTool(toolId);
    };

    return (
        <div className={`bg-light-surface dark:bg-dark-surface/80 border-r border-light-border dark:border-dark-border flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border ${isCollapsed ? 'justify-center' : ''}`}>
                {!isCollapsed && <span className="text-2xl font-bold text-light-primary dark:text-dark-primary">Jux</span>}
                <Bot className={`h-8 w-8 text-light-primary dark:text-dark-primary ${isCollapsed ? '' : 'hidden'}`} />
                 <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 hidden md:block">
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>
            <nav className="flex-1 p-2 space-y-1">
                {TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = activeTool.id === tool.id;
                    return (
                        <button
                            key={tool.id}
                            onClick={() => handleToolClick(tool.id)}
                            className={`flex items-center w-full p-3 rounded-lg text-left transition-colors ${isCollapsed ? 'justify-center' : ''} ${isActive ? 'bg-light-primary/10 text-light-primary dark:bg-dark-primary/20 dark:text-dark-primary' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                            title={tool.name}
                        >
                            <Icon className={`h-5 w-5 ${!isCollapsed ? 'mr-3' : ''}`} />
                            {!isCollapsed && <span className="font-medium">{tool.name}</span>}
                        </button>
                    );
                })}
            </nav>
            <div className={`p-4 border-t border-light-border dark:border-dark-border`}>
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-md hover:bg-black/10 dark:hover:bg-white/10 md:hidden w-full flex justify-center">
                    {isCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
                </button>
            </div>
        </div>
    );
};
