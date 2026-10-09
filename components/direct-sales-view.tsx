'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Barcode,
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useInventory, useInventoryCommand } from '@/components/inventory-view';
import { money, normalize } from '@/lib/demo';
import { available, cents, type Product } from '@/lib/inventory';

type CartLine = { productId: string; quantity: number; priceCents: number };
type PaymentMode = 'full' | 'partial' | 'later';

const paymentLabels: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export function DirectSalesView({ liveMode, notify }: { liveMode: boolean; notify: (message: string, error?: boolean) => void }) {
  const { data, error: loadError, loading, reload, setUnit } = useInventory(liveMode);
  const command = useInventoryCommand();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientId, setClientId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialPaid, setPartialPaid] = useState('0');
  const [method, setMethod] = useState('pix');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saleError, setSaleError] = useState('');

  const categories = useMemo(() => {
    if (!data) return ['Todos'];
    return ['Todos', ...Array.from(new Set(data.products.filter(product => product.active && product.category).map(product => product.category))).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [data]);

  if (!liveMode) return <section className="panel direct-sale-unavailable"><ShoppingBag /><h3>Venda direta</h3><p>Entre com sua conta para abrir o ponto de venda.</p></section>;
  if (!data) return <section className="panel direct-sale-unavailable"><p>{loading ? 'Preparando o ponto de venda…' : loadError}</p>{!loading && <button className="button secondary" onClick={() => void reload()}>Tentar novamente</button>}</section>;

  const canSell = ['gestor', 'atendimento'].includes(data.role);
  const query = normalize(search);
  const filteredProducts = data.products.filter(product => product.active
    && (category === 'Todos' || product.category === category)
    && (!query || normalize([product.name, product.code, product.barcode, product.brand, product.category].join(' ')).includes(query)));
  const subtotal = cart.reduce((total, line) => total + Math.round(line.quantity * line.priceCents), 0);
  const discountCents = Math.max(0, cents(discount || '0'));
  const total = Math.max(0, subtotal - discountCents);
  const paidCents = paymentMode === 'full' ? total : paymentMode === 'later' ? 0 : Math.max(0, cents(partialPaid || '0'));
  const unitName = data.units.find(unit => unit.id === data.unitId)?.name ?? 'Unidade';

  function productFor(line: CartLine) { return data!.products.find(product => product.id === line.productId); }
  function quantityInCart(productId: string) { return cart.find(line => line.productId === productId)?.quantity ?? 0; }
  function addProduct(product: Product) {
    const stock = available(data!, product.id);
    setSaleError('');
    setCart(current => {
      const existing = current.find(line => line.productId === product.id);
      const nextQuantity = (existing?.quantity ?? 0) + 1;
      if (nextQuantity > stock) {
        setSaleError(`Estoque disponível de ${product.name}: ${stock.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${product.unit}.`);
        return current;
      }
      return existing
        ? current.map(line => line.productId === product.id ? { ...line, quantity: nextQuantity } : line)
        : [...current, { productId: product.id, quantity: 1, priceCents: product.price_cents }];
    });
    setSearch('');
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }
  function setQuantity(productId: string, quantity: number) {
    const product = data!.products.find(item => item.id === productId);
    if (!product) return;
    const stock = available(data!, productId);
    const safe = Math.min(stock, Math.max(0, Math.round(quantity * 1000) / 1000));
    setCart(current => safe === 0 ? current.filter(line => line.productId !== productId) : current.map(line => line.productId === productId ? { ...line, quantity: safe } : line));
  }
  function handleSearchEnter() {
    if (!query) return;
    const exact = data!.products.find(product => product.active && [product.barcode, product.code].some(value => normalize(value) === query));
    if (exact) addProduct(exact);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaleError('');
    if (!canSell) return setSaleError('Seu perfil não pode registrar vendas.');
    if (!cart.length) return setSaleError('Adicione ao menos um produto ao carrinho.');
    if (discountCents > subtotal) return setSaleError('O desconto não pode ser maior que o subtotal.');
    if (paidCents > total) return setSaleError('O valor recebido não pode ser maior que o total da venda.');
    const unavailable = cart.find(line => line.quantity > available(data!, line.productId));
    if (unavailable) return setSaleError(`Confira o estoque de ${productFor(unavailable)?.name ?? 'um dos produtos'}.`);
    setBusy(true);
    try {
      await command('sale', data!.unitId, {
        client_id: clientId,
        items: cart.map(line => ({ product_id: line.productId, quantity: line.quantity, price_cents: line.priceCents })),
        discount_cents: discountCents,
        paid_cents: paidCents,
        method,
        note,
      });
      setCart([]);
      setClientId('');
      setDiscount('0');
      setPaymentMode('full');
      setPartialPaid('0');
      setNote('');
      notify('Venda confirmada e estoque atualizado.');
      await reload();
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } catch (cause) {
      setSaleError(cause instanceof Error ? cause.message : 'Não foi possível registrar a venda.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="direct-sales-view view-stack">
    <section className="direct-sales-hero">
      <div><span className="direct-sales-kicker"><span /> PDV conectado ao estoque</span><h2>Venda rápida, estoque sempre certo.</h2><p>Localize o produto, monte o carrinho e confirme o pagamento em poucos passos.</p></div>
      <div className="direct-sales-unit"><label>Unidade<select value={data.unitId} onChange={event => { setCart([]); setUnit(event.target.value); }}>{data.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><button className="direct-sales-refresh" aria-label="Atualizar ponto de venda" onClick={() => void reload()} disabled={loading}><RefreshCw size={17} /></button></div>
    </section>

    <div className="direct-sales-metrics">
      <article><span className="direct-sales-metric-icon blue"><ShoppingBag size={18} /></span><div><small>Vendas confirmadas</small><strong>{money(data.summary.total)}</strong><p>{unitName}</p></div></article>
      <article><span className="direct-sales-metric-icon green"><CreditCard size={18} /></span><div><small>Recebido</small><strong>{money(data.summary.received)}</strong><p>Pagamentos registrados</p></div></article>
      <article><span className="direct-sales-metric-icon amber"><Wallet size={18} /></span><div><small>A receber</small><strong>{money(data.summary.pending)}</strong><p>Saldo das vendas diretas</p></div></article>
    </div>

    <div className="direct-sales-shell">
      <section className="panel direct-sales-catalog">
        <header><div><span className="eyebrow">Catálogo</span><h3>Escolha os produtos</h3></div><span>{filteredProducts.length} disponíveis</span></header>
        <div className="direct-sales-search"><Search size={18} /><input ref={searchRef} autoFocus aria-label="Buscar produto para venda" placeholder="Nome, código ou código de barras" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); handleSearchEnter(); } }} /><kbd>Enter</kbd></div>
        <div className="direct-sales-categories">{categories.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="direct-sales-products">
          {filteredProducts.slice(0, 30).map(product => {
            const stock = available(data, product.id);
            const selected = quantityInCart(product.id);
            return <button className={`direct-sales-product ${stock <= 0 ? 'unavailable' : ''}`} key={product.id} onClick={() => addProduct(product)} disabled={stock <= 0 || !canSell}>
              <span className="direct-sales-product-icon"><Package size={21} /></span>
              <span className="direct-sales-product-copy"><small>{product.category || 'Produto'}{product.brand ? ` · ${product.brand}` : ''}</small><b>{product.name}</b><em>{product.code}{product.barcode ? ` · ${product.barcode}` : ''}</em></span>
              <span className="direct-sales-product-side"><strong>{money(product.price_cents)}</strong><small className={stock <= Number(product.minimum_stock) ? 'low' : ''}>{stock > 0 ? `${stock.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${product.unit}` : 'Sem estoque'}</small>{selected > 0 && <i>{selected.toLocaleString('pt-BR')} no carrinho</i>}</span>
              <Plus size={17} />
            </button>;
          })}
          {!filteredProducts.length && <div className="direct-sales-empty"><Barcode size={30} /><b>Nenhum produto encontrado</b><span>Confira o código digitado ou escolha outra categoria.</span></div>}
        </div>
      </section>

      <form className="panel direct-sales-cart" onSubmit={submit}>
        <header><div><span className="eyebrow">Venda atual</span><h3>Carrinho <span>{cart.length}</span></h3></div>{cart.length > 0 && <button type="button" onClick={() => setCart([])}>Limpar</button>}</header>
        <div className="direct-sales-cart-lines">
          {cart.map(line => {
            const product = productFor(line);
            if (!product) return null;
            return <article key={line.productId}>
              <span className="direct-sales-cart-icon"><Package size={17} /></span>
              <div className="direct-sales-cart-product"><b>{product.name}</b><small>{money(line.priceCents)} · {product.unit}</small><div className="direct-sales-quantity"><button type="button" aria-label={`Diminuir ${product.name}`} onClick={() => setQuantity(line.productId, line.quantity - 1)}><Minus size={13} /></button><input aria-label={`Quantidade de ${product.name}`} type="number" min="0.001" max={available(data, product.id)} step="0.001" value={line.quantity} onChange={event => setQuantity(line.productId, Number(event.target.value))} /><button type="button" aria-label={`Aumentar ${product.name}`} onClick={() => setQuantity(line.productId, line.quantity + 1)}><Plus size={13} /></button></div></div>
              <div className="direct-sales-cart-value"><b>{money(Math.round(line.quantity * line.priceCents))}</b><button type="button" aria-label={`Remover ${product.name}`} onClick={() => setQuantity(line.productId, 0)}><Trash2 size={15} /></button></div>
            </article>;
          })}
          {!cart.length && <div className="direct-sales-empty cart"><ShoppingBag size={31} /><b>Seu carrinho está vazio</b><span>Selecione um produto no catálogo para começar.</span></div>}
        </div>

        <div className="direct-sales-customer"><UserRound size={17} /><label>Cliente<select value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Consumidor não identificado</option>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label></div>

        <div className="direct-sales-payment">
          <div className="direct-sales-totals"><span>Subtotal<b>{money(subtotal)}</b></span><label>Desconto <span>R$ <input aria-label="Desconto da venda" type="number" min="0" max={subtotal / 100} step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} /></span></label><strong>Total <b>{money(total)}</b></strong></div>
          <div className="direct-sales-payment-modes"><button type="button" className={paymentMode === 'full' ? 'active' : ''} onClick={() => setPaymentMode('full')}>Pago agora</button><button type="button" className={paymentMode === 'partial' ? 'active' : ''} onClick={() => setPaymentMode('partial')}>Pagamento parcial</button><button type="button" className={paymentMode === 'later' ? 'active' : ''} onClick={() => setPaymentMode('later')}>A receber</button></div>
          {paymentMode === 'partial' && <label className="direct-sales-field">Valor recebido agora<input type="number" min="0.01" max={total / 100} step="0.01" value={partialPaid} onChange={event => setPartialPaid(event.target.value)} /></label>}
          {paymentMode !== 'later' && <label className="direct-sales-field">Forma de pagamento<select value={method} onChange={event => setMethod(event.target.value)}>{Object.entries(paymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
          <label className="direct-sales-field">Observação <span>opcional</span><textarea maxLength={2000} rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="Informação interna da venda" /></label>
        </div>

        {saleError && <p className="direct-sales-error" role="alert">{saleError}</p>}
        {!canSell && <p className="direct-sales-error">Seu perfil pode consultar as vendas, mas não pode registrar uma nova venda.</p>}
        <button className="direct-sales-confirm" disabled={busy || !canSell || !cart.length || total <= 0}>{busy ? 'Confirmando venda…' : <><CheckCircle2 size={19} /> Confirmar venda · {money(total)}</>}</button>
        <small className="direct-sales-legal">A confirmação registra a venda e baixa o estoque. Este comprovante não substitui documento fiscal.</small>
      </form>
    </div>

    <section className="panel direct-sales-history">
      <header><div><span className="eyebrow">Movimento recente</span><h3>Últimas vendas</h3></div><span>{data.sales.length} registro{data.sales.length === 1 ? '' : 's'}</span></header>
      <div className="direct-sales-history-list">
        {data.sales.slice(0, 8).map(sale => {
          const client = data.clients.find(item => item.id === sale.client_id)?.name ?? 'Consumidor não identificado';
          const balance = sale.status === 'returned' ? 0 : sale.total_cents - sale.paid_cents;
          return <article key={sale.id}><span className={`direct-sales-history-icon ${sale.status}`}><ShoppingBag size={17} /></span><div><b>Venda {sale.id.slice(0, 8).toUpperCase()}</b><small>{client} · {new Date(sale.created_at).toLocaleString('pt-BR')}</small></div><span className={`direct-sales-sale-status ${sale.status === 'returned' ? 'returned' : balance > 0 ? 'pending' : 'paid'}`}>{sale.status === 'returned' ? 'Devolvida' : balance > 0 ? 'Pagamento pendente' : 'Recebida'}</span><strong>{money(sale.total_cents)}</strong></article>;
        })}
        {!data.sales.length && <div className="direct-sales-empty"><ShoppingBag size={28} /><b>Nenhuma venda registrada</b><span>As vendas confirmadas aparecerão aqui.</span></div>}
      </div>
    </section>
  </div>;
}
