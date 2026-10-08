'use client';

import { useEffect, useState } from 'react';
import { money, normalize } from '@/lib/demo';
import type { Product } from '@/lib/inventory';

export function ProductPicker({ liveMode, selected, onSelect }: {
  liveMode: boolean;
  selected?: { code?: string; name?: string };
  onSelect: (product: Product) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!liveMode) {
          if (active) setProducts([]);
          return;
        }
        const response = await fetch('/api/inventory');
        const result = await response.json() as { data?: { products?: Product[] }; error?: string };
        if (!response.ok) throw new Error(result.error ?? 'Catálogo indisponível.');
        if (active) setProducts((result.data?.products ?? []).filter(product => product.active));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Catálogo indisponível.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [liveMode]);

  const matches = products.filter(product => normalize(`${product.code} ${product.name} ${product.barcode ?? ''}`).includes(normalize(query)));

  return <div className="service-picker product-picker">
    <label className="full-label">Buscar peça cadastrada por código, nome ou código de barras
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Código, nome ou código de barras" />
    </label>
    {selected?.code && <div className="service-selected"><span>Peça vinculada: {selected.code} · {selected.name}</span><small>Preço e custo foram preenchidos pelo cadastro; você ainda pode ajustá-los nesta proposta.</small></div>}
    {loading && <small>Carregando produtos…</small>}
    {error && <small role="alert">{error}</small>}
    {!loading && !error && !products.length && <small>Nenhuma peça ativa encontrada no cadastro de produtos.</small>}
    {query.trim() && <div className="service-picker-results">{matches.slice(0, 30).map(product => <button type="button" key={product.id} onClick={() => { onSelect(product); setQuery(''); }}><b>{product.code} · {product.name}</b><span>{money(product.price_cents)}</span></button>)}{!matches.length && <small>Nenhuma peça encontrada para esta busca.</small>}{matches.length > 30 && <small>Refine a pesquisa para encontrar outros produtos.</small>}</div>}
  </div>;
}
