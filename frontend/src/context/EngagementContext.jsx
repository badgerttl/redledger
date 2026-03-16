import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const EngagementContext = createContext(null);

export function EngagementProvider({ children }) {
  const [engagements, setEngagements] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/engagements');
      setEngagements(data);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
