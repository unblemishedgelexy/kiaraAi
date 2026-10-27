# Kiara website and admin panel

This standalone Vite app lives beside `Kiara-ai` and `kiara-server`.

## Run locally

1. Start the API from `kiara-server` with `npm run dev` (port 4000).
2. From this folder run `npm install`, then `npm run dev` (port 5174).
3. Open `http://localhost:5174/` for the public site. Open `http://localhost:5174/admin` directly for administration; the public homepage does not link to it.

For Netlify, set the publish directory to `dist` and the build command to `npm run build`. The `public/_redirects` rule is copied into the build output so direct routes such as `/admin` load the single-page app instead of showing Netlify's 404 page.

The public site is responsive on mobile and desktop. The `/admin` sign-in is visible to everyone and uses a separate admin email/password endpoint; the normal user login is not used by the website admin panel. The sign-in screen also has a first-admin registration option. It does not send an auth token or registration key; the server only accepts it while the `admins` collection is empty. Only active accounts with the `admin` or `dev` role can enter:

- `admin` can manage dashboard data, users, website content, support, and app releases.
- `dev` can view dashboard data and app performance, update feedback/help-desk statuses, and upload APK releases. Other changes are rejected by the server.
- Regular user accounts cannot use the admin login. Google OAuth remains available to the regular user authentication flow, but cannot create admin-panel sessions.

To create the first admin, use the registration option on `/admin` or send this request from Postman while the `admins` collection has no admin accounts yet. An existing regular user account—even with the same email—does not block this one-time bootstrap, and no registration key or auth token is required:

```http
POST http://localhost:4000/api/admin/auth/register
Content-Type: application/json

{
  "firstName": "Admin",
  "lastName": "Name",
  "email": "admin@example.com",
  "password": "<at least 12 characters>"
}
```

This admin account is stored separately from regular users in the `admins` MongoDB collection, so an existing normal-user email does not prevent first-admin setup. Only the first admin can be created without a key; subsequent admin creation requires a long random `ADMIN_REGISTRATION_KEY` on the server and that key in the `X-Admin-Registration-Key` header. A unique MongoDB index prevents two simultaneous first-admin registrations. Regular users are never promoted by this route, and regular-user access tokens cannot be used for admin APIs. Remove or rotate the key when it is no longer needed. For developer access, update the admin document's role to `dev` in MongoDB after provisioning. Admin sign-in uses `POST /api/admin/auth/login` with `{ "email": "...", "password": "..." }`; the frontend calls this endpoint directly. Local Vite origins on ports 5173 and 5174 are allowed automatically outside production, even when `CLIENT_ORIGIN` is customized. In production, allow the website origin through the server's CORS configuration.

Publish an Android `.apk` from the Website & APK panel. The server validates the APK archive, uploads it to ImageKit, and stores its file ID and public URL in MongoDB. APK downloads are streamed through the server with an `.apk` filename and Android package MIME type so browsers do not save them as generic ZIP files. The maximum upload size is **25 MiB (26,214,400 bytes)** to match the ImageKit limit. The server requires `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT`; configure these in the server environment (for example, Render) and restart the service. ImageKit settings are also used for profile-image uploads.

Existing APKs stored in Cloudflare R2 remain downloadable. If an old R2 APK is replaced or deleted, the server also removes the old R2 object when its R2 credentials are still configured.

For local frontend development, leave `VITE_API_BASE_URL` empty; Vite proxies `/api` requests to `http://localhost:4000`. For a separately hosted production frontend, create `kiara-website/.env.local` (or configure the same variable in your frontend hosting dashboard) and set `VITE_API_BASE_URL` to the public origin of `kiara-server`, for example `https://kiara-server.example.com`. Do not add `/api` to the value. Rebuild/redeploy the frontend after changing it. The server must allow the website origin in its CORS configuration. A blank local template is provided in `.env.example`.
