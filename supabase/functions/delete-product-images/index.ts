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
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return respond({ error: 'Your session expired. Sign in again.' }, 401);
    const { data: admin, error: adminError } = await db.from('cms_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return respond({ error: 'CMS admin access required.' }, 403);
    const reader = req.body?.getReader();
    if (!reader) return respond({ error: 'Invalid request.' }, 400);
    const bytes = new Uint8Array(4096);
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) { await reader.cancel(); return respond({ error: 'Invalid request.' }, 400); }
      bytes.set(value, length); length += value.length;
    }
    let ids;
    try { ids = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)))?.ids; }
    catch { return respond({ error: 'Invalid request.' }, 400); }
    if (!Array.isArray(ids) || !ids.length || ids.length > 25 || ids.some((id) => typeof id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return respond({ error: 'Choose 1–25 images from the trash.' }, 400);
    }
    let deleted = 0; let skipped = 0; let failed = 0;
    for (const id of new Set(ids)) {
      const { data: photo, error: claimError } = await db.rpc('claim_product_image_trash', { p_id: id });
      if (claimError) { failed++; continue; }
      if (!photo) { skipped++; continue; }
      // No caller-supplied storage path is accepted. The database checked live
      // product/homepage references and blocked re-use while deletion is pending.
      const { error: removeError } = await db.storage.from('product-images').remove([photo.image_path]);
      if (removeError) {
        await db.from('product_image_trash').update({ state: 'pending', claim_token: null, claimed_at: null })
          .eq('id', id).eq('claim_token', photo.claim_token);
        failed++; continue;
      }
      const { error: finishError } = await db.from('product_image_trash').delete().eq('id', id).eq('claim_token', photo.claim_token);
      if (finishError) failed++;
      else deleted++;
    }
    return respond({ deleted, skipped, failed });
  } catch {
    return respond({ error: 'Could not finish image cleanup. Refresh the trash and retry; pending entries are preserved.' }, 500);
  }
});
