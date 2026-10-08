import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hashPortalToken } from '@/lib/supabase/portal-token';
import { ClientProfileLinkForm } from '@/components/client-profile-link-form';

export const dynamic = 'force-dynamic';

export default async function ClientProfileLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_client_profile_link', { p_token_hash: hashPortalToken(token) });
  if (error || !data) notFound();
  const payload = data as {
    purpose: 'register' | 'update'; organization_name: string; expires_at: string;
    client?: { full_name?: string; phone?: string; email?: string | null; tax_id?: string | null; document_type?: 'cpf' | 'cnpj'; legal_name?: string | null; trade_name?: string | null; notes?: string | null } | null;
    address?: { postal_code?: string | null; street?: string | null; number?: string | null; complement?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null } | null;
  };
  return <ClientProfileLinkForm token={token} initialData={{
    purpose: payload.purpose,
    organization_name: payload.organization_name,
    expires_at: payload.expires_at,
    client: payload.client ? { fullName: payload.client.full_name ?? '', phone: payload.client.phone ?? '', email: payload.client.email ?? '', taxId: payload.client.tax_id ?? '', documentType: payload.client.document_type ?? 'cpf', legalName: payload.client.legal_name ?? '', tradeName: payload.client.trade_name ?? '', notes: payload.client.notes ?? '' } : null,
    address: payload.address ? { postalCode: payload.address.postal_code ?? '', street: payload.address.street ?? '', number: payload.address.number ?? '', complement: payload.address.complement ?? '', neighborhood: payload.address.neighborhood ?? '', city: payload.address.city ?? '', state: payload.address.state ?? '' } : null,
  }} />;
}
