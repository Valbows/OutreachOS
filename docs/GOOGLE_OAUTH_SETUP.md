# Google OAuth Setup for Gmail Integration

**Goal:** Let OutreachOS users connect their Gmail account via "Sign in with Google" so the app can send campaign emails *from* their inbox.

**Architecture:** OutreachOS uses [Neon Auth](https://neon.tech/docs/neon-auth/overview) as an OAuth proxy. Google OAuth is configured on the **Neon Auth dashboard** (not in local `.env`). OAuth refresh tokens are stored server-side by Neon Auth; the app retrieves short-lived access tokens on demand.

---

## Step 1 — Google Cloud Console

### 1.1 Create / Select a GCP Project
1. Go to <https://console.cloud.google.com/>
2. Create a new project named `outreachos-prod` (or reuse an existing project).

### 1.2 Enable the Gmail API
1. Navigate to **APIs & Services → Library**
2. Search for **Gmail API** → click **Enable**

### 1.3 Configure the OAuth Consent Screen
1. **APIs & Services → OAuth consent screen**
2. **User Type:** External (or Internal if you have Google Workspace)
3. **App information:**
   - App name: `OutreachOS`
   - User support email: your email
   - Developer contact: your email
4. **Scopes — add ALL of these:**
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
5. **Test users** (required while app is in Testing mode): add the email addresses that will connect.
6. *(Production step)* Submit the app for Google OAuth verification. Required before general-availability use because `gmail.send` is a restricted scope.

### 1.4 Create OAuth 2.0 Client Credentials
1. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. **Application type:** Web application
3. **Name:** `OutreachOS - Neon Auth`
4. **Authorized JavaScript origins:**
   - `http://localhost:3000` (dev)
   - `https://outreachos.com` (prod — replace with your domain)
5. **Authorized redirect URIs** (this URL comes from Neon — see Step 2 first):
   - `https://<your-neon-auth-url>/callback/google`
6. Click **Create**. **Copy** the **Client ID** and **Client Secret**.

---

## Step 2 — Neon Auth Dashboard

### 2.1 Locate Your Project
1. <https://console.neon.tech/> → select your project
2. **Auth** tab → you should see your `NEON_AUTH_BASE_URL`:
   ```
   https://ep-wandering-thunder-aj0jiguj.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth
   ```
3. The Google OAuth callback will be:
   ```
   <NEON_AUTH_BASE_URL>/callback/google
   ```
   Go back to Step 1.4 and paste that exact URL into the Google Cloud **Authorized redirect URIs**.

### 2.2 Configure Google Provider in Neon Auth
1. In the Neon Auth dashboard → **Social providers → Google**
2. Paste:
   - **Client ID** from Step 1.4
   - **Client Secret** from Step 1.4
3. **Scopes to request:**
   ```
   openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send
   ```
4. **Access type:** `offline` (required to receive a refresh token)
5. **Prompt:** `consent` (forces Google to re-issue a refresh token on each connect — important for dev)
6. Save.

### 2.3 Allow `localhost` During Development
1. Neon Auth → **Trusted origins**
2. Add `http://localhost:3000`
3. (For the Cascade browser preview proxy: skip — use `localhost:3000` directly in Chrome.)

---

## Step 3 — Local `.env.local`

Your local env only needs the Neon Auth URL and cookie secret. Google credentials live on Neon, not locally.

```bash
# Required
NEON_AUTH_BASE_URL=https://ep-wandering-thunder-aj0jiguj.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=<generate with: openssl rand -base64 32>

# NOT required (Google OAuth is on Neon's side):
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

---

## Step 4 — Verify End-to-End

1. Restart dev server: `./scripts/dev-restart.sh`
2. Open <http://localhost:3000> in Chrome (not the browser-preview tile — origin mismatch)
3. Log in with `test@example.com` / `password123`
4. Go to **Settings → One-Click Sync**
5. Click **Connect Google Account**
6. You should see Google's consent screen listing **all four scopes**, including *"Send email on your behalf"*
7. Accept → redirects back to Settings
8. The page fires `/api/auth/google/sync` — you should see **"Connected: your-email@gmail.com"**

---

## How Sending Works (Reference)

When a campaign sends via Gmail:

```ts
// packages/services/src/gmail-service.ts (future)
import { auth } from "@/lib/auth/server";

const { data } = await auth.getAccessToken({
  providerId: "google",
  // accountId implicit from session
});

// data.accessToken is a fresh short-lived token.
// Neon Auth handles refresh under the hood using the stored refresh token.
await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
  method: "POST",
  headers: { Authorization: `Bearer ${data.accessToken}` },
  body: JSON.stringify({ raw: base64EncodedMimeMessage }),
});
```

**Why this is clean:**
- No refresh token stored in our DB — no rotation, no encryption drift, no leak surface.
- Neon Auth is the single source of truth for OAuth credentials.
- Revoking access in Google automatically breaks the chain (Neon can't refresh).

---

## Troubleshooting

**Error: `redirect_uri_mismatch` during Google consent**
- The URI in Google Cloud must match the Neon callback URL **exactly** (trailing slash matters).

**Error: `access_denied` on consent screen**
- User's email isn't in the Google Cloud **Test users** list (while app is unverified).

**"Connected" shows but sending fails with `insufficient_permissions`**
- User granted scope `gmail.readonly` only, not `gmail.send`. Disconnect, clear the app's access in <https://myaccount.google.com/permissions>, and reconnect.

**`Invalid origin` on social sign-in**
- Access the app via `http://localhost:3000` directly in your browser, not the Cascade preview tile (port mismatch rejected by Neon).

**Refresh token not returned on re-connect**
- Google only issues refresh tokens on *first* consent. To force re-issue:
  1. Revoke app access: <https://myaccount.google.com/permissions>
  2. Reconnect in OutreachOS
  3. Ensure Neon's Google provider has `access_type=offline` and `prompt=consent`
