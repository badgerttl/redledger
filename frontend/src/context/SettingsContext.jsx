import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const DEFAULT_SETTINGS = {
  assistant_system_prompt: '',
  findings_gen_instructions: '',
  assistant_context_limit: '',
  code_review_system_prompt: '',
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => { /* use defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  const updateSettings = useCallback(async (updates) => {
    const { data } = await api.patch('/settings', updates);
    setSettings({ ...DEFAULT_SETTINGS, ...data });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loaded, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
