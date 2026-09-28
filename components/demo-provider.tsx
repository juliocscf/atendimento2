'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { type DemoData, initialData, STORAGE_KEY } from '@/lib/demo';

type Context = { data: DemoData; ready: boolean; commit: (update: (current: DemoData) => DemoData, message: string) => boolean; notify: (message: string, error?: boolean) => void; reset: () => void };
const DemoContext = createContext<Context | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoData>(initialData);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  function notify(message: string, error = false) { setToast({ message, error }); }
  useEffect(() => {
    // Restore browser-only demo data after hydration; the server always renders the same seed.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoData;
        const valid = parsed.version === 1 && ['clients', 'devices', 'orders', 'appointments'].every(key => Array.isArray(parsed[key as keyof DemoData]));
        if (!valid || !parsed.clients.every(c => typeof c.name === 'string') || !parsed.orders.every(o => Array.isArray(o.history) && Array.isArray(o.contacts) && typeof o.amount === 'number' && parsed.clients.some(c => c.id === o.clientId))) throw new Error('Invalid demo');
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional browser storage hydration
        setData(parsed);
      }
    } catch { setToast({ message: 'Os dados locais não puderam ser recuperados. Exibindo a demonstração inicial.', error: true }); }
    setReady(true);
  }, []);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timeout); }, [toast]);
  function commit(update: (current: DemoData) => DemoData, message: string) {
    if (!ready) return false;
    try { const updated = update(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); setData(updated); notify(message); return true; }
    catch { notify('Não foi possível salvar neste navegador. O preenchimento foi mantido. Libere o armazenamento e tente novamente.', true); return false; }
  }
  function reset() { commit(() => structuredClone(initialData), 'Demonstração restaurada.'); }
  return <DemoContext.Provider value={{ data, ready, commit, notify, reset }}>{children}{toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button aria-label="Fechar aviso" onClick={() => setToast(null)}><X size={17} /></button></div>}</DemoContext.Provider>;
}
export function useDemo() { const value = useContext(DemoContext); if (!value) throw new Error('DemoProvider missing'); return value; }
