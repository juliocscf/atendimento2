import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']);

async function getOrderContext(orderId: string) {
  const context = await getRequestContext();
  if (!context.userId) return { ...context, order: null };
  if (!context.membership) return { ...context, order: null };
  const { data: order } = await context.supabase.from('service_orders').select('id').eq('id', orderId).eq('organization_id', context.membership.organization_id).maybeSingle();
  return { ...context, order };
}

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership, order } = await getOrderContext(orderId);
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const { data, error } = await supabase.from('service_order_attachments').select('id, storage_path, file_name, mime_type, file_size, created_at').eq('organization_id', membership.organization_id).eq('service_order_id', orderId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const attachments = await Promise.all((data ?? []).map(async attachment => {
    const signed = await supabase.storage.from('order-attachments').createSignedUrl(attachment.storage_path, 3600);
    return { ...attachment, url: signed.data?.signedUrl ?? null };
  }));
  return NextResponse.json({ data: attachments });
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership, order } = await getOrderContext(orderId);
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'This file type is not allowed.' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'The file must be smaller than 20 MB.' }, { status: 400 });
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const storagePath = `${membership.organization_id}/${orderId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from('order-attachments').upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });
  const { data, error } = await supabase.from('service_order_attachments').insert({ organization_id: membership.organization_id, service_order_id: orderId, storage_path: storagePath, file_name: file.name, mime_type: file.type, file_size: file.size, created_by: userId }).select('id, storage_path, file_name, mime_type, file_size, created_at').single();
  if (error) { await supabase.storage.from('order-attachments').remove([storagePath]); return NextResponse.json({ error: error.message }, { status: 400 }); }
  return NextResponse.json({ data }, { status: 201 });
}
