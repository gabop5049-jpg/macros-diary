# Deploying Macro Diary privately (Cloudflare Pages + Access)

You do these steps yourself in the Cloudflare dashboard. Budget about 30 minutes the first time.

## 1. Build

```
node build.mjs
```

This makes `dist/` (only the files a phone loads) and stamps a new `CACHE_VERSION` into `dist/sw.js`. Run it before **every** upload: the new version number is what tells phones there is an update.

## 2. Cloudflare account

1. Sign up at https://dash.cloudflare.com.
2. **Turn on 2FA right away** (profile → Authentication). This account decides who can open the app, so it's the most important password in the setup. Use an authenticator app, not SMS.

## 3. Create the Pages project

1. Workers & Pages → Create → Pages → **Upload assets**.
2. **Pick the project name carefully.** It becomes `<name>.pages.dev` and can't be changed later without deleting the project. Avoid your real name if you don't want it in the URL.
3. Upload the **`dist/` folder** (not the repo folder). Deploy.

Alternative to drag-and-drop, from the repo folder (Windows ARM64 works, Node only):

```
npx wrangler login
npx wrangler pages deploy dist --project-name <name>
```

## 4. Turn on Cloudflare Access

1. In the Pages project: Settings → General → **Enable access policy**. On its own this protects **only preview deployments** (`*.<name>.pages.dev`). The main URL is still public at this point.
2. Click **Manage** on that policy. It opens the Access application in Zero Trust. Edit it so it also covers the production domain `<name>.pages.dev` (add it as a second domain/hostname on the application, or create a second self-hosted application for it with the same policy).
3. Back in Pages → Settings → General, re-select **Enable access policy** if it shows as off.
4. In Zero Trust → Access → Applications, **check that both are covered**:
   - `<name>.pages.dev` (production)
   - `*.<name>.pages.dev` (previews)

   If production isn't covered, the main URL stays public. Test it in step 6, don't assume.

The Zero Trust signup may ask for a payment method even on the Free plan. That's normal; the Free plan is $0 up to 50 users.

### Policy settings

- Action: **Allow**
- Include → **Emails**: list each friend's address individually. Never use "Emails ending in" `@gmail.com`: that lets every Gmail user in.
- Login method: **One-time PIN** (Settings → Authentication → Login methods → add One-time PIN). Turn off anything else you don't use.
- Session duration: **1 week to 1 month**. Longer means fewer logins (nicer on iPhone, where the installed app logs in separately) but a lost/stolen phone stays logged in longer. The site holds no user data, so a long session is a reasonable trade.

To remove someone: delete their email from the policy, then Zero Trust → My Team → Users → revoke their session. Note that the app they already installed keeps working offline from its cache (their own data, our public code), but can't fetch updates.

## 5. Turn off GitHub Pages

The app is still public at `https://gabop5049-jpg.github.io/macros-diary/` until you turn that off: repo → Settings → Pages → Source → **None** (or "Unpublish site"). Do this once Cloudflare works, or Access is pointless.

Optional: after GitHub Pages is off you can make the repo private (Settings → General → Danger Zone). It contains no secrets, but right now anyone can read and self-host the code.

## 6. Verify (do this every time you change Access settings)

- [ ] Open `https://<name>.pages.dev` in a **private window**: you get the Access login, not the app.
- [ ] Same for a preview URL (`https://<hash>.<name>.pages.dev`, listed under Deployments).
- [ ] Log in with an allowed email: the app loads. With an email not on the list: no code arrives / access denied.
- [ ] After logging in, open `https://<name>.pages.dev/manifest.webmanifest`: it shows JSON, not a login page. In desktop Chrome, DevTools → Application → Manifest shows the name and icons with no errors.
- [ ] Install on your iPhone and an Android if you can: the home-screen icon and name are "Macros" with the blue icon, not a blank/letter icon.
- [ ] Open the installed app, turn on airplane mode, close and reopen it: it still works.
- [ ] Scan a barcode: the camera opens and the lookup works.

If the install icon is blank or generic even though the manifest loads, the browser fetched the icons without your cookie. Fix: in Zero Trust add another self-hosted application for the paths `/icon-192.png`, `/icon-512.png`, `/icon.svg`, `/manifest.webmanifest` with a **Bypass** policy (Include: Everyone). Those files aren't private.

## Every update

1. `node build.mjs`
2. Upload `dist/` as a new deployment (Deployments → Create deployment), or `npx wrangler pages deploy dist --project-name <name>`.
3. Phones pick it up the next time the app is opened online with a valid login (sometimes it takes a second open).

## Custom domain (later, optional)

Add the custom domain to the Pages project **before** putting an Access policy on it: Pages can't add a custom domain that already has an Access policy. Then add the domain to the Access application and re-run the verify list.
