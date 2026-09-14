# Attach Paper Ledger to MyIrishTax

Target URL: **https://ledger.myirishtax.com**

I cannot finish this from GitHub alone. `myirishtax.com` is on **Hostinger**. Subdomains are created in hPanel. `myirishtax.ie` currently has **no DNS at all** (the name does not resolve), so it cannot host a subdomain until the domain is registered and pointed.

## What is already done

- This repo is ready for a custom domain (`public/CNAME` = `ledger.myirishtax.com`).
- GitHub Pages builds with `BASE_PATH=/` so assets work on that host name.
- After you add the DNS record below, GitHub can issue HTTPS for the subdomain.

## The one step only you can do (Hostinger)

1. Log in to [hPanel](https://hpanel.hostinger.com).
2. Open **Domains** → **myirishtax.com** → **DNS / DNS Zone**.
3. Add:

   | Type | Name | Points to | TTL |
   |---|---|---|---|
   | CNAME | `ledger` | `alexcanchaya-dotcom.github.io` | 300 or default |

4. In GitHub: [paper-ledger → Settings → Pages](https://github.com/alexcanchaya-dotcom/paper-ledger/settings/pages)
   - Source: **GitHub Actions**
   - Custom domain: `ledger.myirishtax.com`
   - Tick **Enforce HTTPS** once the certificate appears (can take up to an hour).

5. Wait for DNS (often a few minutes, sometimes up to an hour). Then open https://ledger.myirishtax.com

## If you prefer Hostinger hosting instead of GitHub Pages

1. hPanel → **Domains** → **Subdomains** → create `ledger.myirishtax.com`.
2. On your computer: `npm ci && npm run build` in this repo.
3. Upload the contents of `dist/` into that subdomain’s `public_html` folder.

## myirishtax.ie

Right now `myirishtax.ie` does not resolve. To use **https://ledger.myirishtax.ie** later:

1. Register / restore the `.ie` domain if it is not active.
2. Point the apex wherever you want the tax site.
3. Add the same CNAME: `ledger` → `alexcanchaya-dotcom.github.io`
4. Change `public/CNAME` in this repo to `ledger.myirishtax.ie` (or add both names in Pages).

## After it is live

Books on the Grok preview will not appear on the subdomain. On the preview: Export → **Save backup**. On ledger.myirishtax.com: **Open a backup**.
