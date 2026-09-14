# Paper Ledger

Books for a small business. Six kits share a register, P&L, desk, assets, tax working paper, settings, JSON backup, and Excel export. **Tuition & Coaching / Kumon** is the flagship kit (families, per-subject fees, sibling discount, renewals, royalty, forecast).

This repository is a **standalone Vite + React 19 app**. It is **not** a folder of static HTML files, and it is **not** Next.js. The live books live in the browser (`localStorage`). Nothing is uploaded.

## What this is

| Question | Answer |
|---|---|
| Stack | Vite 6, React 19, TypeScript, Tailwind v4, Zustand |
| Server | None. The built `dist/` folder is static files |
| Database | None. Browser `localStorage` key `paper-ledger-v1` |
| Auth | None |
| Excel | Generated in the browser as a real `.xlsx` |
| GitHub Pages | Yes — static `dist/` |
| Vercel / Netlify | Yes — import this repo |
| Next.js | Not this app. Copy the product folders into your site (see [NEXTJS.md](./NEXTJS.md)) |

## Folder structure

```
paper-ledger/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vercel.json
├── LICENSE
├── public/
│   └── favicon.svg
├── .github/workflows/pages.yml   # GitHub Pages
└── src/
    ├── main.tsx                  # browser entry
    ├── App.tsx                   # mounts the workbook
    ├── styles.css                # paper-ledger theme
    ├── lib/
    │   ├── utils.ts
    │   └── ledger/               # all business logic (no UI)
    │       ├── types.ts
    │       ├── calc.ts           # fees, discount, royalty, P&L, tax
    │       ├── kits.ts           # six kits + sample data
    │       ├── store.ts          # Zustand + persist
    │       ├── backup.ts         # JSON backup / restore
    │       ├── excel.ts          # .xlsx builder
    │       ├── reminders.ts
    │       ├── reports.ts
    │       └── …
    └── components/
        ├── ui/                   # button, dialog, input
        └── workbook/             # screens
            ├── Workbook.tsx      # shell + nav
            ├── Onboarding.tsx
            ├── CentreDashboard.tsx
            ├── StudentsSheet.tsx
            ├── FollowUpsSheet.tsx
            ├── PnlSheet.tsx
            ├── AssetsSheet.tsx
            ├── TaxSheet.tsx
            ├── ExportSheet.tsx
            └── SettingsSheet.tsx
```

## Run it on your machine

Needs [Node.js 22](https://nodejs.org/).

```bash
git clone https://github.com/alexcanchaya-dotcom/paper-ledger.git
cd paper-ledger
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run typecheck   # TypeScript
npm run build       # writes static files to dist/
npm run preview     # serve dist/ locally
```

## Put it on GitHub (if you are starting from the zip)

```bash
cd paper-ledger
git init
git add .
git commit -m "Initial Paper Ledger handoff"
git branch -M main
git remote add origin https://github.com/YOUR_USER/paper-ledger.git
git push -u origin main
```

Replace `YOUR_USER` with your GitHub username. Create the empty repo on GitHub first (no README, so the push is clean).

## Deploy as a standalone app

### A. Subdomain of MyIrishTax (intended)

See **[SUBDOMAIN.md](./SUBDOMAIN.md)**. Planned URL: `https://ledger.myirishtax.com`.

That needs one DNS record in Hostinger (this repo cannot add it). `myirishtax.ie` currently has no DNS.

### B. Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → Add New → Project → import `paper-ledger`.
3. Framework preset: **Vite**. Build command `npm run build`. Output `dist`.
4. Deploy. You get a public URL. Each visitor’s books stay in *their* browser.

Custom domain: Vercel project → Settings → Domains.

### C. Netlify

Import the GitHub repo. Build `npm run build`, publish `dist`.

### D. GitHub Pages

1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Push to `main`. The workflow in `.github/workflows/pages.yml` builds with `BASE_PATH=/paper-ledger/` and publishes `dist/`.
3. Site URL: `https://YOUR_USER.github.io/paper-ledger/`

If the repo name is not `paper-ledger`, the workflow still uses the repo name as the path.

If you later use a custom domain on Pages, set `BASE_PATH=/` in the workflow.

### D. Any static host

`npm run build` → upload the `dist/` folder. This is a single-page app: every path can serve `index.html`.

## How data works after you publish

- Live books: this browser only (`localStorage`).
- Move to another computer: Export → **Save backup** (`.json`) → on the other machine, Open a backup.
- Accountant: Export → Excel (`.xlsx`). Excel does **not** restore back into Paper Ledger.
- Clearing site data on that domain deletes the books unless a JSON backup exists.

## Dependencies (runtime)

| Package | Why |
|---|---|
| `react` / `react-dom` | UI |
| `zustand` | Books store + `localStorage` persist |
| `fflate` | Zip the `.xlsx` in the browser |
| `recharts` | Dashboard chart |
| `lucide-react` | Icons |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Button variants / class names |
| `@radix-ui/react-dialog`, `@radix-ui/react-slot` | Dialog + button `asChild` |

Dev: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`.

## Next.js website

Do **not** drop this whole Vite app inside a Next.js repo. Copy the product folders and mount `<Workbook />` on a client page. Step-by-step: [NEXTJS.md](./NEXTJS.md).

## License

MIT. See [LICENSE](./LICENSE).
