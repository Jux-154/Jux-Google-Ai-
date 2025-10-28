
import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', text }) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-8 w-8 border-4',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
        <div
        className={`animate-spin rounded-full border-solid border-light-primary dark:border-dark-primary border-t-transparent ${sizeClasses[size]}`}
        ></div>
        {text && <p className="text-light-subtle dark:text-dark-subtle animate-pulse">{text}</p>}
    </div>
  );
};
