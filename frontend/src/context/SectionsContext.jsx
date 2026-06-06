import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sections as sectionsApi } from '../api';

const SectionsContext = createContext([]);

export function SectionsProvider({ children }) {
  const [sections, setSections] = useState([]);

  const refresh = useCallback(() => {
    sectionsApi.list().then(r => setSections(r.data)).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SectionsContext.Provider value={{ sections, refresh }}>
      {children}
    </SectionsContext.Provider>
  );
}

export const useSections = () => useContext(SectionsContext);
