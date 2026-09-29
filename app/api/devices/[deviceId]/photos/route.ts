import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(_request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const { data: device } = await supabase.from('devices').select('id').eq('id', deviceId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!device) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
  const { data, error } = await supabase.from('device_photos').select('id, storage_path, mime_type, file_size, created_at').eq('device_id', deviceId).eq('organization_id', membership.organization_id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const photos = await Promise.all((data ?? []).map(async photo => {
    const signed = await supabase.storage.from('device-photos').createSignedUrl(photo.storage_path, 3600);
    return { ...photo, url: signed.data?.signedUrl ?? null };
  }));
  return NextResponse.json({ data: photos });
}

export async function POST(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const { data: device } = await supabase.from('devices').select('id').eq('id', deviceId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!device) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG or WebP images are allowed.' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'The image must be smaller than 10 MB.' }, { status: 400 });

  const extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
  const storagePath = `${membership.organization_id}/${deviceId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from('device-photos').upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });

  const { data, error } = await supabase.from('device_photos').insert({ organization_id: membership.organization_id, device_id: deviceId, storage_path: storagePath, mime_type: file.type, file_size: file.size, created_by: userId }).select('id, storage_path, mime_type, file_size, created_at').single();
  if (error) {
    await supabase.storage.from('device-photos').remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
