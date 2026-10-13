# Deploying Vibely

Three pieces: **frontend** on Vercel, **backend API** (Node, Express, Socket.IO) on Render or Railway, **AI service** (Python FastAPI) on Render or Railway, plus **MongoDB Atlas** and **Cloudinary**.

> Not yet verified end to end on real hosting. Follow the checklist at the bottom after the first deploy.

## 0. Before you start: two things that block real users
1. **OTP delivery.** `OTP_PROVIDER=dev` sends nothing. Sign-up verification and password reset cannot finish in production until you add an SMS/email provider in `server/src/services/otpService.js` (the `deliverOtp` function is the one place to change).
2. **Media storage.** Use `MEDIA_PROVIDER=cloudinary`. Local disk is wiped on most hosts. The Cloudinary code is written but has not been tested against a real account.

## 1. MongoDB Atlas
1. Create a free cluster at cloud.mongodb.com, then **Database Access**: add a user with a long random password (read/write on one database).
2. **Network Access**: add your backend's outbound IPs. For a first test `0.0.0.0/0` works, but tighten it later.
3. **Connect** > Drivers: copy the `mongodb+srv://...` string and put the database name in it, for example `.../vibely?retryWrites=true&w=majority`. This is `MONGODB_URI`.
4. Indexes are created automatically when the server starts. Turn on Atlas backups.

## 2. Cloudinary
Create a free account and copy cloud name, API key and API secret into the backend variables below. The secret stays on the server.

## 3. Backend API (Render, using `render.yaml`)
1. Push the repo to GitHub. In Render: **New > Blueprint** and pick the repo. It creates `vibely-api` and `vibely-ai`.
2. Fill the secret variables when asked (see the table below). `JWT_SECRET` is generated for you.
3. Wait for the deploy. Open `https://<your-api>/api/health`: it should answer `{"success":true,"status":"ok"}`.

**Railway instead:** create two services from the same repo. API: root directory `server`, start command `npm start`. AI: root directory `ai-service`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add the same variables.

WebSockets (chat, calls, notifications) work on Render and Railway. Free tiers sleep when idle, so the first request can take about 30 seconds.

## 4. AI service
Variables: `AI_SERVICE_KEY` (the same 16+ character secret as the backend), `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`. Set `AI_SERVICE_URL` on the backend to this service's URL. Without a model key the app still works and the AI page says it is not set up.

## 5. Frontend (Vercel)
1. **Add New > Project**, import the repo, leave the framework as Vite. `vercel.json` already contains the single-page-app rewrite, caching and security headers.
2. Environment variables:
   - `VITE_API_URL` = `https://<your-api>/api`
   - `VITE_SOCKET_URL` = `https://<your-api>` (no `/api`)
3. Deploy, then set the backend's `CLIENT_URL` to the Vercel URL (exactly, no trailing slash) and redeploy the backend. CORS and sockets only allow that origin.

## 6. Environment variables
| Where | Variable | Notes |
|---|---|---|
| backend | `NODE_ENV` | `production` |
| backend | `PORT` | set by the host |
| backend | `MONGODB_URI` | Atlas string. Required |
| backend | `JWT_SECRET` | 32+ random characters. Required |
| backend | `JWT_EXPIRES_IN` | `1d` is a good production value |
| backend | `CLIENT_URL` | frontend origin(s), comma-separated. Required in production, no `*` |
| backend | `PUBLIC_URL` | the API's own public URL |
| backend | `MEDIA_PROVIDER` | `cloudinary` in production |
| backend | `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | required when using Cloudinary |
| backend | `OTP_PROVIDER` / `OTP_API_KEY` | `dev` until a provider is added |
| backend | `STUN_URLS` / `TURN_URL` / `TURN_SECRET` | calls. TURN is optional but helps strict networks |
| backend | `AI_SERVICE_URL` / `AI_SERVICE_KEY` / `AI_TIMEOUT_MS` / `AI_RATE_LIMIT_MAX` | leave the URL empty to run without AI |
| ai-service | `AI_SERVICE_KEY` | same value as the backend |
| ai-service | `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL` | model access |
| ai-service | `AI_ENV` / `AI_TIMEOUT_SECONDS` / `AI_MAX_OUTPUT_TOKENS` | `production` hides `/docs` |
| frontend | `VITE_API_URL` / `VITE_SOCKET_URL` | public values only |

Never commit `.env` files. `npm run audit:secrets` (in `server/`) checks this.

## 7. Create the first admin
Open a shell on the backend service (Render: **Shell** tab) and run `npm run admin:grant -- you@example.com`. The account must be registered and verified first. Log out and in again.

## 8. After the first deploy: checklist
- [ ] `/api/health` answers ok, and the frontend loads from the Vercel URL.
- [ ] Register, verify, log in. Create a post with a photo and check the photo loads (Cloudinary).
- [ ] Open the app in two browsers: chat messages arrive live and the typing indicator shows.
- [ ] Place a voice call between the two browsers (HTTPS is required for the microphone).
- [ ] If a model is configured, ask Vibely AI a question.
- [ ] Log in as admin and open `/admin`.
- [ ] Run `npm audit` in the project root and in `server/`, and `pip-audit` in `ai-service/`.

## 9. Recommended hardening for production
- Add a Content-Security-Policy header on the frontend host that allows your API origin in `connect-src` (including `wss:`) and your Cloudinary host in `img-src` and `media-src`.
- Run more than one backend instance only after moving rate limits to a shared store (Redis).
- Keep `JWT_EXPIRES_IN` short, restrict Atlas network access, and review `SECURITY.md`.
