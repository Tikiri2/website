# shues product CMS setup

This product manager uses Supabase's free tier. It stores products in a hosted database, so changes appear in the shop for visitors. Free-tier usage and inactivity limits apply.

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) and wait for its database to finish provisioning.

## 2. Create the products database

In the Supabase dashboard, open **SQL Editor**, paste the contents of `cms-setup.sql`, and run it. The SQL creates the products table, security policies, and the six current shop products.

## 3. Create and allowlist your admin account

In **Authentication → Users**, add a user with your email and a strong password. Do not enable public sign-ups.

Then run this in the SQL Editor, replacing the email with the exact admin email you created:

```sql
insert into public.cms_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

Confirm that the query inserted one row. Only users listed in `cms_admins` can change products.

## 4. Connect this website

In **Project Settings → API**, copy the **Project URL** and the **publishable/anon key** into `cms-config.js`:

```js
window.SHUES_CMS_CONFIG = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-publishable-or-anon-key',
};
```

The publishable/anon key is intended for browser use. **Never put a `service_role` or secret key in this website.**

## 5. Open the product manager

Run the site through a local web server or deploy it to your hosting provider, then visit `/Backend/admin.html` and sign in with the admin account. You can add, edit, publish/unpublish, and delete products. Product images can be hosted image URLs or paths in the website, such as `Backend/assets/my-shoe.jpg`.

If you already set up Supabase before the images moved, run this once in its SQL Editor to update the existing seed product paths:

```sql
update public.products
set image_url = 'Backend/' || image_url
where image_url like 'assets/%';
```

If you add image files to the website, upload them to your hosting provider too. Changes made to product data are live in Supabase; the website files still need to be deployed when you change code or add local image files.
