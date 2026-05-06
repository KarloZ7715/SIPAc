## Cursor Cloud specific instructions

### Services

| Service         | How to start                                                            | Notes                             |
| --------------- | ----------------------------------------------------------------------- | --------------------------------- |
| MongoDB         | `mongod --dbpath /data/db --fork --logpath /var/log/mongodb/mongod.log` | Must be running before `pnpm dev` |
| Nuxt dev server | `pnpm dev`                                                              | Runs at http://localhost:3000     |

### Environment setup

A `.env` file is required at the workspace root. See `.env.example` for all variables. The minimum required:

- `MONGODB_URI=mongodb://localhost:27017/sipac`
- `JWT_SECRET` (32+ chars)
- `GOOGLE_API_KEY` (injected as env secret)

The admin seed user is created automatically on first boot if `ADMIN_EMAIL` + `ADMIN_PASSWORD` are both set. **Important**: the seeded admin user starts with `emailVerifiedAt = null`, so you must manually mark it verified before login works:

```bash
mongosh --eval 'db.getSiblingDB("sipac").users.updateOne({email:"admin@sipac.local"},{$set:{emailVerifiedAt:new Date()}})'
```

### Gotchas

- `pnpm install` may show a warning about ignored build scripts (`@sentry/cli`, `cloudflared`, `unrs-resolver`, `vue-demi`). This does **not** break lint or tests — safe to ignore.
- The `nuxt-security` module is disabled in dev/test (`NODE_ENV !== 'production'`), so CSP headers won't apply locally.

### Commands reference

Standard commands from `package.json` scripts — see `README.md` § Scripts or `CLAUDE.md` § Commands for the full list. Key ones:

- `pnpm lint` / `pnpm lint:fix`
- `pnpm test` (Vitest)
- `pnpm typecheck`
- `pnpm dev`
