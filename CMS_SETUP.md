# VENU Shoues CMS setup

This CMS powers the VENU Shoues storefront and uses Supabase's free tier. It stores products, homepage text and homepage cards in a hosted database, so changes appear in the shop for visitors. Free-tier usage and inactivity limits apply.

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) and wait for its database to finish provisioning.

## 2. Create the database

For the first setup, open **SQL Editor**, paste the contents of `cms-setup.sql`, and run it. This creates the products table, the homepage text and card tables, the public image buckets with admin-only uploads, security policies, and sample content (six women's heels and sandals, four mood cards and three promise cards). Product names and prices are mock values. Existing content is not duplicated.

## 3. Create and allowlist your admin account

In **Authentication → Users**, add a user with your email and a strong password. Do not enable public sign-ups.

Then run this in the SQL Editor, replacing the email with the exact admin email you created:

```sql
insert into public.cms_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

Confirm that the query inserted one row. Only users listed in `cms_admins` can change products or homepage content.

After the CMS user-management migration is applied, you can give another existing Auth user access directly from the signed-in CMS using **Add a CMS user** and their email. They must first be invited or created under **Authentication → Users**. The CMS checks the caller is already an admin; it does not expose a public way to grant access.

## 4. Connect this website

In **Project Settings → API**, copy the **Project URL** and the **publishable/anon key** into `cms-config.js`:

```js
window.SHUES_CMS_CONFIG = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-publishable-or-anon-key',
};
```

The publishable/anon key is intended for browser use. **Never put a `service_role` or secret key in this website.**

## 5. Enable automatic database migrations

In the GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:

- `SUPABASE_ACCESS_TOKEN`: create a personal access token in your Supabase account settings.
- `SUPABASE_DB_PASSWORD`: the database password chosen when creating the Supabase project.
- `SUPABASE_PROJECT_ID`: the project reference shown in the Supabase project URL/dashboard.

After these three secrets are configured, changes committed under `supabase/migrations/` and pushed to `main` are applied to Supabase automatically by GitHub Actions. You can also run the workflow manually from the repository's **Actions** tab. Ordinary product edits in the CMS do not need migrations or SQL.

For future database/schema changes, add a new, timestamped SQL file under `supabase/migrations/`. The women's footwear catalog migration updates the six original sample products and adds heels/sandals categories; only those categories appear in the storefront. The homepage CMS migration adds the `site_content` and `site_cards` tables plus the `site-images` bucket. Other CMS products are left untouched. Do not edit or rerun old migrations to change an existing production database. Check the workflow run in **Actions** to confirm each migration completed.

If your shop already existed before the homepage CMS was added, pushing the new migration (or running `supabase/migrations/20261108030000_homepage_cms.sql` in the SQL Editor once) enables the Homepage tab and seeds the current homepage text and cards.

## 6. Open the CMS

Run the site through a local web server or deploy it to your hosting provider, then visit `/admin/` and sign in with the admin account. On GitHub Pages, the full URL is `https://your-user.github.io/your-repository/admin/`.

The CMS uses a dark sidebar/top bar dashboard layout with four sections:

- **Dashboard** — product/card counts, aggregate order counts by status, non-cancelled order value (not payments received), and the five most recent orders. Click a pipeline status to filter Orders.

- **Products** — add, edit, publish/unpublish, and delete heels and sandals. Select a JPG, PNG, WebP, or AVIF image up to 5 MB; it is uploaded to the Supabase `product-images` bucket and displayed in the shop.
- **Homepage** — edit the announcement bar, hero banner, section headings, story, newsletter, footer and WhatsApp link. You can also add, edit, reorder, publish/unpublish, and delete **mood cards** (the five image tiles that also feed the hero carousel) and **promise cards** (the numbered cards near the bottom). Homepage images are uploaded to the Supabase `site-images` bucket.
- **Orders** — separate New, Confirmed, Processing, Shipping, Completed and Cancelled tabs show counts and only the matching orders, paginated newest first. The former heading/description and status/phone filter form are removed. Contact the customer, view images, change status and save internal notes within each order. Status saves verify the returned database status, refresh counts, and open the saved status's tab. If you switch tabs during a save, the currently visible tab is refreshed when it finishes. Errors are shown both on the form and as a notification; a stale record must be refreshed rather than overwritten. In **Completed**, expand an order and select **Delete completed order** to permanently remove its record/notes and image after confirmation. Other statuses retain **Delete order**; use Cancelled to retain a record instead.

Expanding an order does not load/display its image automatically. Select **View order image** to open a private preview only when needed, using a five-minute signed URL. If the aggregate `cms_order_overview` RPC has not been deployed, tab/sidebar counts fall back to exact, admin-protected database HEAD counts (including legacy Making/Shipped statuses). Dashboard order value remains unavailable rather than displaying a misleading zero until the aggregate migration is applied. This compatibility fallback does not replace the order-management migration/function required for status writes and deletion.

Homepage text is edited as plain text. For the announcement bar and scrolling ticker, put one item per line. Use the italic line fields for the script-style second line of a heading.

To preview the six local sample heels and sandals without loading live Supabase products, open `index.html?preview=1`. The storefront normally loads only products categorized as **heels** or **sandals**.

If you already set up Supabase before the images moved, run this once in its SQL Editor to update the existing seed product paths:

```sql
update public.products
set image_url = 'Backend/' || image_url
where image_url like 'assets/%';
```

If you add image files to the website, upload them to your hosting provider too. Changes made to products and homepage content are live in Supabase; the website files still need to be deployed when you change code or add local image files.

## 7. Enable saved orders and WhatsApp image links

Deploy the website changes **and** the backend before using this flow:

1. Apply the pending migrations to the existing project (do not rerun old migrations). `20261109010000_orders.sql` adds orders/storage/policies; `20261109020000_short_order_links.sql` adds opaque image-link tokens and a fixed seven-day expiry from order creation. Existing orders receive tokens with the same creation-based expiry. `20261109030000_order_management.sql` renames Making → Processing and Shipped → Shipping without deleting existing orders, and adds dashboard aggregation, transactional admin-only deletion, and a private storage-cleanup queue.
2. Deploy all three Edge Functions: `supabase functions deploy create-order --remote=YOUR_PROJECT_REF --yes`, `supabase functions deploy order-image --remote=YOUR_PROJECT_REF --yes`, and `supabase functions deploy delete-order --remote=YOUR_PROJECT_REF --yes`. Their config uses `verify_jwt = false` for publishable-key compatibility. **The delete function still explicitly verifies the user's bearer JWT against Supabase Auth and checks `cms_admins` before any deletion/cleanup**; anonymous and non-admin users are rejected. Submission validation, upload limits, server-checked pricing and rate limits stay on the server. The service-role key stays in Supabase's function environment, never in website JavaScript.
3. Alternatively, push these changes to `main` with the repository secrets from step 5 configured: the GitHub Actions workflow applies migrations and deploys all functions. Check all deployment steps finish successfully. Deploy the updated website/admin files, including `Backend/dashboard.css`, to the website host too.
4. Use a **live CMS product**, not a local preview product. Confirming an order generates the PNG and saves the order and image. **Continue to WhatsApp** opens the shop chat with the order reference and a short website link such as `https://your-shop.example/order.html#<32-character-token>`, rather than the long Supabase signed URL. The token is a private access capability, not an order ID; don't shorten it manually. The viewer exchanges it for a temporary image URL without exposing the orders table. It expires seven days after order creation; reopening it does not renew the expiry. The customer must still tap **Send** in WhatsApp. This is a link, not an attached image; WhatsApp thumbnail previews are not guaranteed. Older frontend deployments can still use the original signed-URL response.
5. Sign in to `/admin/` → **Orders** to manage the submission. A saved/New order does **not** prove WhatsApp was sent, payment was received, or the order was confirmed. Confirm with the customer. Upload failures can leave a visible order without an image; retrying the unchanged submission on the same page uses the same request key instead of creating another order.

The image contains a phone number. Anyone holding its signed link can view it until it expires; avoid forwarding links unnecessarily. Expiry blocks link access, not storage retention. Orders/images remain private and available to allowlisted CMS admins until removed by the project operator. Set your own retention/cleanup policy in Supabase. Admin image previews use fresh 5-minute signed URLs, so they continue to work after customer links expire. Internal notes never appear in the customer link or WhatsApp message. The stored structured details use server-checked pricing; the PNG itself is customer-submitted and should not be treated as payment proof.

Deleting an order immediately removes its database row and disables its short website link. The backend then removes its storage image. If storage is unavailable, a durable cleanup job remains: the Orders panel displays a warning and **Retry image cleanup**. Existing direct storage URLs can continue working until that image is removed or their signature expires, so retry pending cleanup promptly. A retry handles up to 25 pending images at a time. Delete checks `updated_at` under a database row lock, so stale admin screens cannot silently delete a recently edited order. Dashboard data and management operations remain protected by admin-only policies; no public order-list/delete permission is added.

Anonymous ordering has basic abuse limits (30 attempts per IP/hour, 10 new-order attempts per phone/hour); this is not a replacement for CAPTCHA or gateway-level abuse protection on a busy public shop. Customer image links intentionally use bearer access, whereas order lists and management require CMS-admin authentication.

### Development checks

Run `node --test tests/*.test.cjs` with Node 22.18+ for mocked backend, image-link/viewer, dashboard/deletion and CMS regression tests, and `npx --yes deno check supabase/functions/create-order/index.ts supabase/functions/order-image/index.ts supabase/functions/delete-order/index.ts` for function type checking. These checks do not apply migrations, upload live orders, delete real orders or send WhatsApp messages. After deployment, separately verify anonymous users cannot list orders/read unsigned images, non-admin signed-in users cannot manage/delete orders, and an allowlisted admin can view images and update status/notes. Verify a newly shared short link opens the image and that expired/invalid links do not. Use a disposable test order to verify deletion, image removal and cleanup retry.
