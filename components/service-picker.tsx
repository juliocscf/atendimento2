'use client';
import { useEffect, useState } from 'react';
import { money, normalize } from '@/lib/demo';
import { CATALOG_STORAGE_KEY, serviceInput, type CatalogService } from '@/lib/service-catalog';
export function ServicePicker({ liveMode, onSelect }: { liveMode: boolean; onSelect: (service: CatalogService) => void }) {
  const [services, setServices] = useState<CatalogService[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let data: CatalogService[];
        if (liveMode) { const response = await fetch('/api/services?active=true'); const result = await response.json(); if (!response.ok) throw new Error(); data = result.data; }
        else { const saved = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) ?? '[]'); data = Array.isArray(saved) ? saved.filter(item => typeof item?.id === 'string' && serviceInput(item)) : []; }
        if (active) setServices(data.filter(service => service.is_active));
      } catch { if (active) setError('Catálogo indisponível. Você pode preencher o item manualmente.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [liveMode]);
  const matches = services.filter(service => normalize(`${service.code} ${service.name}`).includes(normalize(query)));
  return <div className="service-picker"><label className="full-label">Buscar serviço por código ou nome<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="SRV-001 ou nome do serviço" /></label>{loading && <small>Carregando catálogo…</small>}{error && <small role="alert">{error}</small>}{!loading && !error && !matches.length && <small>Nenhum serviço ativo encontrado. Cadastre serviços na tela Serviços ou preencha manualmente.</small>}{query.trim() && <div className="service-picker-results">{matches.slice(0, 30).map(service => <button type="button" key={service.id} onClick={() => { onSelect(service); setQuery(''); }}><b>{service.code} · {service.name}</b><span>{money(service.default_price_cents)}</span></button>)}{matches.length > 30 && <small>Refine a pesquisa para encontrar outros serviços.</small>}</div>}</div>;
}
