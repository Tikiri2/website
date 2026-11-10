import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const hash = async (value: string) => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  if (Number(req.headers.get('content-length')) > 3300000) return respond({ error: 'Image is too large.' }, 413);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    // Limit before parsing multipart data. Never persist raw IP addresses.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { data: allowed, error: limitError } = await db.rpc('consume_order_limit', {
      p_key: await hash(`ip:${ip}`), p_limit: 30,
    });
    if (limitError) throw limitError;
    if (!allowed) return respond({ error: 'Too many attempts. Please try again in an hour.' }, 429);
    // Bound the streamed body as well as Content-Length (which may be absent).
    const reader = req.body?.getReader();
    if (!reader) return respond({ error: 'Missing order.' }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 3300000) {
        await reader.cancel();
        return respond({ error: 'Image is too large.' }, 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    let form: FormData;
    let input;
    try {
      form = await new Response(body, {
        headers: { 'Content-Type': req.headers.get('content-type') || '' },
      }).formData();
      input = JSON.parse(String(form.get('order') || '{}'));
    } catch {
      return respond({ error: 'Invalid order submission.' }, 400);
    }
    const image = form.get('image');
    if (!input || typeof input !== 'object' || !uuid.test(input.request_key) || !uuid.test(input.product_id) || !/^0\d{9}$/.test(input.phone)
      || !Number.isFinite(input.size) || input.size < 20 || input.size > 50 || input.size % 0.5 !== 0
      || !Number.isFinite(input.heel) || input.heel < 0 || input.heel > 12 || input.heel % 0.5 !== 0
      || typeof input.colour !== 'string' || !input.colour.trim() || input.colour.length > 100
      || !(image instanceof File) || image.type !== 'image/png' || image.size > 3145728 || image.size < 24) {
      return respond({ error: 'Invalid order details or image. Please reload and try again.' }, 400);
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    const view = new DataView(bytes.buffer);
    if (!signature.every((byte, index) => bytes[index] === byte)
      || view.getUint32(16) !== 900 || view.getUint32(20) !== 1280) {
      return respond({ error: 'Invalid order image.' }, 400);
    }
    const { data: previous, error: previousError } = await db.from('orders').select('*')
      .eq('request_key', input.request_key).maybeSingle();
    if (previousError) throw previousError;
    let order = previous;
    if (order && (order.product_id !== input.product_id || order.customer_phone !== input.phone
      || order.colour !== input.colour.trim() || Number(order.shoe_size) !== input.size
      || Number(order.heel_height) !== input.heel || order.product_price !== input.expected_price)) {
      return respond({ error: 'This submission has changed. Reload the page before placing a new order.' }, 409);
    }
    if (!order) {
      const { data: phoneAllowed, error: phoneLimitError } = await db.rpc('consume_order_limit', {
        p_key: await hash(`phone:${input.phone}`), p_limit: 10,
      });
      if (phoneLimitError) throw phoneLimitError;
      if (!phoneAllowed) return respond({ error: 'Too many orders for this phone number. Please try again in an hour.' }, 429);
      const { data: product, error: productError } = await db.from('products')
        .select('id, name, price, published').eq('id', input.product_id).maybeSingle();
      if (productError) throw productError;
      if (!product?.published) return respond({ error: 'This product is no longer available. Please return to the shop.' }, 400);
      if (product.price !== input.expected_price) return respond({ error: 'The price has changed. Reload this page before ordering.' }, 409);
      const shortShareToken = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('') + '0'.repeat(20);
      const { data, error } = await db.from('orders').insert({
        request_key: input.request_key, product_id: product.id, product_name: product.name,
        colour: input.colour.trim(), shoe_size: input.size, heel_height: input.heel,
        customer_phone: input.phone, product_price: product.price, courier_fee: 250,
        image_share_token: shortShareToken,
      }).select().single();
      if (error) {
        // A retry can arrive while the first request is finishing.
        if (error.code !== '23505') throw error;
        const { data: existing, error: retryError } = await db.from('orders').select('*')
          .eq('request_key', input.request_key).single();
        if (retryError) throw retryError;
        order = existing;
      } else order = data;
    }
    if (!order.image_path) {
      const path = `${order.id}/order.png`;
      const { error: uploadError } = await db.storage.from('order-images').upload(path, bytes, {
        contentType: 'image/png', upsert: true,
      });
      if (uploadError) throw uploadError;
      const { error: saveError } = await db.from('orders').update({ image_path: path }).eq('id', order.id);
      if (saveError) throw saveError;
      order.image_path = path;
    }
    const { data: link, error: linkError } = await db.storage.from('order-images')
      .createSignedUrl(order.image_path, 7 * 24 * 60 * 60);
    if (linkError) throw linkError;
    return respond({
      id: order.id, image_url: link.signedUrl, expires_in_days: 7,
      share_token: order.image_share_token, share_expires_at: order.image_share_expires_at,
    });
  } catch (error) {
    console.error('Order submission failed:', error instanceof Error ? error.message : 'Backend error');
    return respond({ error: 'Could not save your order. Please try again. If this continues, contact the shop.' }, 500);
  }
});
