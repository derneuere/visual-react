import { useContext } from 'react';
import { StaticModeContext } from './context';

export function useStaticMode(): boolean {
  return useContext(StaticModeContext);
}
