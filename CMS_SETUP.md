# shues product CMS setup

This product manager uses Supabase's free tier. It stores products in a hosted database, so changes appear in the shop for visitors. Free-tier usage and inactivity limits apply.

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) and wait for its database to finish provisioning.

## 2. Create the products database

For the first setup, open **SQL Editor**, paste the contents of `cms-setup.sql`, and run it. This creates the products table, the public product-image bucket with admin-only uploads, security policies, and six sample women's heels and sandals. Product names and prices are mock values. Existing products are not duplicated.

## 3. Create and allowlist your admin account

In **Authentication → Users**, add a user with your email and a strong password. Do not enable public sign-ups.

Then run this in the SQL Editor, replacing the email with the exact admin email you created:

```sql
insert into public.cms_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

Confirm that the query inserted one row. Only users listed in `cms_admins` can change products.

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

For future database/schema changes, add a new, timestamped SQL file under `supabase/migrations/`. The women's footwear catalog migration updates the six original sample products and adds heels/sandals categories; only those categories appear in the storefront. Other CMS products are left untouched. Do not edit or rerun old migrations to change an existing production database. Check the workflow run in **Actions** to confirm each migration completed.

## 6. Open the product manager

Run the site through a local web server or deploy it to your hosting provider, then visit `/admin/` and sign in with the admin account. On GitHub Pages, the full URL is `https://your-user.github.io/your-repository/admin/`. You can add, edit, publish/unpublish, and delete products. Select a JPG, PNG, WebP, or AVIF image up to 5 MB; it is uploaded to the Supabase `product-images` bucket and displayed in the shop.

To preview the six local sample heels and sandals without loading live Supabase products, open `index.html?preview=1`. The storefront normally loads only products categorized as **heels** or **sandals**.

If you already set up Supabase before the images moved, run this once in its SQL Editor to update the existing seed product paths:

```sql
update public.products
set image_url = 'Backend/' || image_url
where image_url like 'assets/%';
```

If you add image files to the website, upload them to your hosting provider too. Changes made to product data are live in Supabase; the website files still need to be deployed when you change code or add local image files.
