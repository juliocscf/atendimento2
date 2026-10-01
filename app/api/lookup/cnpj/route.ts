import { NextResponse } from 'next/server';
import { isValidCnpj, onlyDigits } from '@/lib/brazil-documents';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  const document = onlyDigits(new URL(request.url).searchParams.get('document') ?? '');
  if (!isValidCnpj(document)) return NextResponse.json({ error: 'Informe um CNPJ válido antes de consultar.' }, { status: 400 });

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${document}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json', 'User-Agent': 'Atendimento2/1.0' }, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'CNPJ não encontrado.' : 'Serviço de CNPJ indisponível no momento.' }, { status: response.status === 404 ? 404 : 502 });
    const result = await response.json() as { cnpj?: string; razao_social?: string; nome_fantasia?: string; email?: string | null; ddd_telefone_1?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; municipio?: string; uf?: string; descricao_situacao_cadastral?: string };
    return NextResponse.json({ data: { document: result.cnpj ?? document, legalName: result.razao_social ?? '', tradeName: result.nome_fantasia ?? '', email: result.email ?? '', phone: result.ddd_telefone_1 ?? '', postalCode: result.cep ?? '', street: result.logradouro ?? '', number: result.numero ?? '', complement: result.complemento ?? '', neighborhood: result.bairro ?? '', city: result.municipio ?? '', state: result.uf ?? '', status: result.descricao_situacao_cadastral ?? '' } }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o CNPJ agora.' }, { status: 502 });
  }
}
