import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

const EngagementContext = createContext(null);

export function EngagementProvider({ children }) {
  const [engagements, setEngagements] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const autoSelectedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/engagements');
      const sorted = [...data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
      );
      setEngagements(sorted);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // On hard refresh: auto-select engagement from URL once after initial load
  useEffect(() => {
    if (autoSelectedRef.current || loading || current) return;
    const match = window.location.pathname.match(/^\/e\/(\d+)/);
    if (!match) return;
    autoSelectedRef.current = true;
    selectEngagement(parseInt(match[1], 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const selectEngagement = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/engagements/${id}`);
      setCurrent(data);
    } catch { /* empty */ }
  }, []);

  return (
    <EngagementContext.Provider value={{ engagements, current, loading, refresh, selectEngagement, setCurrent }}>
      {children}
    </EngagementContext.Provider>
  );
}

export const useEngagement = () => useContext(EngagementContext);
