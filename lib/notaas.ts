const DEFAULT_BASE_URL = 'https://platform.notaas.com.br/api/v1';

export type NotaasResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

export function isNotaasConfigured() {
  return Boolean(process.env.NOTAAS_API_KEY?.trim());
}

export async function notaasRequest(path: string, init: RequestInit = {}): Promise<NotaasResult> {
  const apiKey = process.env.NOTAAS_API_KEY?.trim();
  if (!apiKey) throw new Error('A integração Notaas ainda não foi configurada no servidor.');
  const baseUrl = (process.env.NOTAAS_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...init.headers,
      },
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try { data = JSON.parse(text) as Record<string, unknown>; }
      catch { data = { message: response.ok ? 'Resposta recebida.' : 'Resposta inválida do provedor fiscal.' }; }
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('O Notaas demorou para responder. Tente novamente.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function fiscalStatus(data: Record<string, unknown>) {
  const raw = String(data.status ?? data.situacao ?? '').toLowerCase();
  if (['queued', 'processing', 'issued', 'error', 'cancelled', 'inutilized'].includes(raw)) return raw;
  return 'processing';
}

export function safeProviderResponse(data: Record<string, unknown>) {
  const allowed = ['status', 'situacao', 'invoiceId', 'id', 'chaveAcesso', 'accessKey', 'numero', 'nNf', 'serie', 'protocolo', 'nProt', 'codigoStatus', 'cStat', 'motivo', 'xMotivo', 'errorMessage', 'valorTotal'];
  return Object.fromEntries(allowed.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
}

export function providerError(data: Record<string, unknown>, fallback: string) {
  return String(data.motivo ?? data.xMotivo ?? data.errorMessage ?? data.message ?? data.error ?? fallback).slice(0, 1000);
}
