# Board game compass

A shared map where friends place themselves (and each other) on two axes.
Static page + one Vercel Function, with Upstash Redis for storage.

## Files

- `index.html` – the app
- `api/state.js` – reads and writes people and placements
- `package.json` – one dependency, `@upstash/redis`

## Deploy

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project**, import the repo. Framework preset: **Other**. No build command needed. Deploy.
3. In the project, open **Storage**, add **Upstash Redis** from the Marketplace, and connect it to the project (all environments).
4. **Deployments → ⋯ → Redeploy** so the function picks up the new environment variables.
5. Open the site, add yourself, and share the link.

The function accepts either `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
or `KV_REST_API_URL` / `KV_REST_API_TOKEN`, whichever the integration created.

## Notes

- Anyone with the link can add people and place tokens. There's no login.
- The page checks for new placements every 4 seconds.
- To clear the map, open the database in the Upstash console (Storage → your database → Open in Upstash)
  and delete the keys `bgc:people` and `bgc:placements`.
- Run locally with `npm i -g vercel`, then `vercel link`, `vercel env pull`, and `vercel dev`.
