import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return respond({ error: 'Sign in to the CMS first.' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    // JWT verification is explicit: publishable gateway keys are not user sessions.
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return respond({ error: 'Your session expired. Sign in again.' }, 401);
    const { data: admin, error: adminError } = await db.from('cms_admins')
      .select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return respond({ error: 'CMS admin access required.' }, 403);
    const reader = req.body?.getReader();
    if (!reader) return respond({ error: 'Invalid request.' }, 400);
    const bytes = new Uint8Array(1024);
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) { await reader.cancel(); return respond({ error: 'Invalid request.' }, 400); }
      bytes.set(value, length); length += value.length;
    }
    let input;
    try { input = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))); }
    catch { return respond({ error: 'Invalid request.' }, 400); }
    if (!input || !['delete', 'cleanup'].includes(input.action)) return respond({ error: 'Invalid action.' }, 400);
    if (input.action === 'delete') {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id || '')
        || typeof input.updated_at !== 'string' || !Number.isFinite(Date.parse(input.updated_at))) {
        return respond({ error: 'Invalid order reference.' }, 400);
      }
      const { error } = await db.rpc('delete_order_record', { p_id: input.id, p_updated_at: input.updated_at });
      if (error?.code === '40001') return respond({ error: 'This order changed. Refresh before deleting.' }, 409);
      if (error) throw error;
    }
    let query = db.from('order_image_cleanup').select('id, image_path').order('created_at').limit(25);
    if (input.action === 'delete') query = query.eq('id', input.id);
    const { data: pending, error: pendingError } = await query;
    if (pendingError) throw pendingError;
    for (const item of pending || []) {
      const { error: removeError } = await db.storage.from('order-images').remove([item.image_path]);
      if (removeError) continue; // Keep the job so the admin can safely retry.
      const { error: jobError } = await db.from('order_image_cleanup').delete().eq('id', item.id);
      if (jobError) throw jobError;
    }
    const { count, error: countError } = await db.from('order_image_cleanup').select('id', { count: 'exact', head: true });
    if (countError) throw countError;
    return respond({ deleted: input.action === 'delete', cleanup_pending: count || 0 });
  } catch {
    return respond({ error: 'Could not finish the operation. Refresh and retry; any pending image cleanup is preserved.' }, 500);
  }
});
