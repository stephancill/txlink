# AGENTS.md

## Project

txlink is a Vite React app for sharing wallet JSON-RPC requests as URLs. It is deployed to `https://txlink.stupidtech.net` using Cloudflare Workers Static Assets.

## Stack

- Package manager: Bun.
- Frontend: Vite, React, TypeScript.
- Styling: Tailwind utilities only. Tailwind Preflight/base reset is intentionally disabled in `src/index.css`.
- Blockchain libraries: wagmi and viem.
- Async state: React Query.
- Formatter: oxfmt, configured by `.oxfmtrc.json`.
- Deployment: Wrangler with `wrangler.jsonc`.

## Before Making Changes

- Check `README.md` and this file before changing behavior.
- Check `skills/txlink/SKILL.md` and `public/SKILL.md` when changing URL formats, supported methods, redirect behavior, or agent-facing usage.
- Do not add shadcn, Radix wrappers, component libraries, or CSS reset/base styles unless explicitly requested.
- Keep the UI plain and native-looking. Prefer raw HTML elements and minimal Tailwind layout utilities.

## Coding Rules

- Keep changes minimal and localized.
- Use function components and modern React patterns.
- Use React Query for async state.
- Use viem/wagmi for wallet and blockchain interactions.
- Prefer named object parameters for new helper functions when a function takes multiple related inputs.
- Validate external/user-provided data before use.
- Preserve technical identifiers exactly, including JSON-RPC method names, `chainId`, `params`, and `redirect_url`.

## Styling Rules

- Use native browser controls where possible.
- Avoid card-like UI, heavy borders, icons, large typography hierarchies, and decorative styling.
- Use Tailwind mainly for layout (`flex`, `gap`, `space-y`, `max-w`, `p-*`) and limited state color (`text-gray-*`, `text-red-*`).
- Do not re-enable Tailwind Preflight unless explicitly requested.

## Skill File

- `skills/txlink/SKILL.md` is the source skill documentation.
- `public/SKILL.md` must stay in sync so it is hosted at `https://txlink.stupidtech.net/SKILL.md`.
- Update both files whenever agent-facing behavior or examples change.

## Verification

- After TypeScript/React changes, run:

```bash
bunx oxfmt --write "src/App.tsx" "src/wagmi.ts" "vite.config.ts"
bun run build
```

- After dependency changes, ensure `bun.lockb` is updated.
- Before deployment, ensure `bun run build` passes.

## Deployment

- Deploy with:

```bash
bun run deploy
```

- Deployment uses `wrangler.jsonc` and should publish the custom domain route:
  `txlink.stupidtech.net (custom domain)`.
- If Wrangler requires Node 22, use nvm before deploying:

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 22
```

## Related Site

- `../stupidtech.net` lists txlink as a product.
- If the public product description changes materially, update `../stupidtech.net/index.html` and commit/push that repo separately when requested.
