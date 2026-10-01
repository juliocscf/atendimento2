import { NextResponse } from 'next/server';
import { onlyDigits } from '@/lib/brazil-documents';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  const postalCode = onlyDigits(new URL(request.url).searchParams.get('postalCode') ?? '');
  if (postalCode.length !== 8) return NextResponse.json({ error: 'Informe um CEP com 8 números.' }, { status: 400 });

  try {
    const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
    if (!response.ok) return NextResponse.json({ error: 'Serviço de CEP indisponível no momento.' }, { status: 502 });
    const result = await response.json() as { erro?: boolean; cep?: string; logradouro?: string; complemento?: string; bairro?: string; localidade?: string; uf?: string; ibge?: string };
    if (result.erro) return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 });
    return NextResponse.json({ data: { postalCode: result.cep ?? postalCode, street: result.logradouro ?? '', complement: result.complemento ?? '', neighborhood: result.bairro ?? '', city: result.localidade ?? '', state: result.uf ?? '', ibge: result.ibge ?? '' } }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o CEP agora.' }, { status: 502 });
  }
}
