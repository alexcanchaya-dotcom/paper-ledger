# Using Paper Ledger inside an existing Next.js site

Paper Ledger is a **Vite + React** app. It does not use Next.js routing, server components, or a database. The honest ways to ship it on a Next.js website:

1. **Link out** to a standalone deploy (Vercel / Pages). Fastest, no merge.
2. **iframe** the standalone URL on a `/ledger` page.
3. **Copy the product source** into the Next.js repo as a client page. This is the real integration.

## 1. Link out

Deploy this repo on Vercel. From the Next.js site:

```tsx
<a href="https://paper-ledger.your-domain.com">Open the books</a>
```

Books will live on that other origin’s `localStorage`. That is usually what you want (keeps the marketing site and the books apart).

## 2. iframe

```tsx
// app/ledger/page.tsx
export default function LedgerPage() {
  return (
    <iframe
      title="Paper Ledger"
      src="https://paper-ledger.your-domain.com"
      className="h-[100dvh] w-full border-0"
    />
  );
}
```

Same origin rules: if the iframe is a different domain, backup downloads still work; `localStorage` is the iframe origin, not the parent.

## 3. Copy into Next.js (App Router)

You need React 19 (or 18 — should compile) and Tailwind v4, or you map the CSS tokens into your existing Tailwind setup.

### Copy these folders, unchanged

From this repo into the Next.js repo (paths relative to the Next.js `src/` or project root — keep the `@/` alias working):

```
src/lib/ledger/          →  all .ts files
src/lib/utils.ts         →  if you already have cn(), merge uid() into yours
src/components/ui/       →  button.tsx, dialog.tsx, input.tsx
src/components/workbook/ →  all .tsx files
src/styles.css           →  merge the @theme block into your global CSS
```

Do **not** copy `main.tsx`, `App.tsx`, `index.html`, or `vite.config.ts`.

### Alias

`tsconfig.json` (already standard in Next.js):

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Page

```tsx
// app/ledger/page.tsx
"use client";

import { Workbook } from "@/components/workbook/Workbook";

export default function LedgerPage() {
  return <Workbook />;
}
```

`"use client"` is required. Zustand, file downloads, and dialogs are browser-only.

### CSS

Paste the `@theme { … }` block and the base/print rules from `src/styles.css` into `app/globals.css`. Keep the IBM Plex / Source Serif 4 `<link>` tags in `app/layout.tsx`, or swap for your fonts.

Install the same runtime packages:

```bash
npm install zustand fflate recharts lucide-react class-variance-authority clsx tailwind-merge @radix-ui/react-dialog @radix-ui/react-slot
```

### What you do not need

- TanStack Start / Router
- Vite
- A database
- Auth
- API routes for the books (they never leave the browser)

### Storage warning

`localStorage` is **origin-scoped**. If Next.js is `www.example.com` and the old Vite app was `ledger.example.com`, they do not share books. Move data with the JSON backup (Export → Save backup → Open a backup on the new origin).
