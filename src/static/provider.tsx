import { ReactNode } from 'react';
import { StaticModeContext } from './context';

interface StaticModeProviderProps {
  children: ReactNode;
}

export function StaticModeProvider({ children }: StaticModeProviderProps) {
  return (
    <StaticModeContext.Provider value={true}>
      {children}
    </StaticModeContext.Provider>
  );
}
