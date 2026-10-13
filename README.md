# Vibely: Share Your Vibe.

A full-stack social app: profiles and following, photo/video posts, stories, reels, real-time chat, voice/video calls, notifications,
explore and search, an AI assistant, and an admin dashboard.

## Features
| Area | What you can do |
|---|---|
| Accounts | Register, OTP verification, login (email or phone), forgot/reset password, JWT sessions |
| Profiles | Edit profile, follow/unfollow, followers/following lists, private accounts with follow requests, block users |
| Posts | Photo/video posts, hashtags, location, visibility, infinite-scroll feed, likes, comments and replies, save, share, report |
| Explore | Trending and recent posts, popular and recommended users, trending hashtags, search for users, posts and hashtags |
| Stories | 24-hour stories, viewer with auto-advance, view tracking, privacy rules |
| Reels | Short vertical video feed (autoplay when visible), likes, comments, saves, share |
| Chat | One-to-one and group chats, typing, online status, read receipts, attachments, disappearing messages |
| Calls | One-to-one voice/video (WebRTC), call history |
| Notifications | Live badge for likes, comments, replies, mentions, follows, requests, messages and calls |
| Vibely AI | Assistant chat, caption generator, smart replies, content safety check |
| Admin | Dashboard, user management, report queue, content moderation, audit log |

## Architecture
    Browser (React + Vite)  --HTTPS-->  Node/Express API  --->  MongoDB Atlas
            |                                |   |
            |------ Socket.IO (JWT) ---------+   +--->  Cloudinary (media)
                                             |
                                             +--- X-Internal-Key --->  Python FastAPI AI service ---> LLM provider

The browser never talks to the AI service or any secret-bearing service. Everything goes through the Node API.

## Tech stack
- **Frontend:** React 18, Vite, React Router, Tailwind CSS, Axios, socket.io-client (pages are code-split per route)
- **Backend:** Node.js 20+, Express, Mongoose/MongoDB, Socket.IO, JWT, bcrypt, Helmet, express-rate-limit, multer
- **AI service:** Python 3.12, FastAPI, httpx (Anthropic or any OpenAI-compatible API)
- **Calls:** WebRTC with Socket.IO signaling, STUN (and optional TURN)

## Folder structure
    vibely/
      src/                 React app: api/, components/ (admin/ inside), context/, hooks/, pages/ (admin/ inside), socket/, utils/
      server/
        src/               config/, models/, routes/, controllers/, services/ (chat/, admin/, ai/, media/), middleware/, validators/, socket/, utils/
        scripts/           smoke tests, audits, set-admin
      ai-service/          app/ (routes, services, models, utils), tests/
      vercel.json  render.yaml  .github/workflows/ci.yml
      README.md  DEPLOYMENT.md  SECURITY.md

## Installation
Requirements: Node.js 20+, a MongoDB database (local, or a free MongoDB Atlas cluster), and Python 3.12 only if you want the AI service.

    git clone <your repo> && cd vibely
    npm install                      # frontend
    cd server && npm install         # backend

## Environment setup
    cd server && cp .env.example .env     # fill MONGODB_URI and JWT_SECRET (32+ random characters), set CLIENT_URL=http://localhost:5173
    cp .env.example .env.local            # (project root) optional: VITE_API_URL / VITE_SOCKET_URL, defaults point to localhost:5000
    cd ../ai-service && cp .env.example .env   # optional: AI_SERVICE_KEY, AI_API_KEY, AI_MODEL

Every variable is documented in `DEPLOYMENT.md` and in the `.env.example` files. Never commit a real `.env`.

## Database setup
Nothing to create by hand. Set `MONGODB_URI` (local: `mongodb://127.0.0.1:27017/vibely`, Atlas: the `mongodb+srv://` string).
Collections and indexes are created on first start. If you have posts from before the Explore phase, run `cd server && npm run backfill:discovery` once.

## Run it (development)
    # terminal 1: backend  (http://localhost:5000)
    cd server && npm run dev
    # terminal 2: frontend (http://localhost:5173)
    npm run dev
    # terminal 3, optional: AI service (http://localhost:8001)
    cd ai-service && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8001
    # then in server/.env: AI_SERVICE_URL=http://localhost:8001 and the same AI_SERVICE_KEY in both .env files

Production build of the frontend: `npm run build` then `npm run preview`. Start the backend with `cd server && npm start`.

First admin: `cd server && npm run admin:grant -- you@example.com` (the account must be verified).

## Testing
The smoke tests need the backend running against a test database (they create and delete their own users).

    cd server
    npm run test:all          # everything below, in order
    npm run test:journey      # the full user journey: register ... chat, call, AI, logout, admin
    npm run test:smoke | test:users | test:posts | test:explore | test:stories | test:reels | test:chat | test:phase9 | test:admin | test:ai

No server needed:

    npm run audit             # (project root) API calls vs routes, links vs pages, env vars, imports, secrets
    cd ai-service && python -m unittest discover -s tests     # or: pip install -r requirements-dev.txt && pytest

## Deployment
Frontend on Vercel, backend and AI service on Render or Railway, database on MongoDB Atlas. Step by step in **DEPLOYMENT.md**
(`vercel.json` and `render.yaml` are included, and CI runs from `.github/workflows/ci.yml`).

## API overview
All routes are under `/api`, return `{ success, message, data }`, and need `Authorization: Bearer <token>` except health and the public auth routes.

| Group | Base path | Highlights |
|---|---|---|
| Auth | `/auth` | `register`, `verify-otp`, `resend-otp`, `login`, `logout`, `me`, `forgot-password`, `reset-password` |
| Users | `/users` | `:id`, `profile`, `privacy`, `story-privacy`, `search`, `:id/follow`, `:id/followers`, `:id/following`, `:id/block`, `blocked`, `follow-requests`, `:id/report` |
| Posts | `/posts` | create, `feed`, `saved`, `user/:id`, `:id`, `:id/like`, `:id/comment`, `:id/comments`, `:id/save`, `:id/share`, `:id/report` |
| Comments | `/comments` | `:id/replies`, `:id/like`, delete |
| Explore | `/explore` | `trending-posts`, `recent-posts`, `popular-users`, `recommended-users`, `hashtags/trending`, `hashtags/search`, `hashtags/:name/posts`, `search` |
| Stories | `/stories` | create, tray, `user/:id`, `:id/view`, `:id/viewers`, delete |
| Reels | `/reels` | create, `feed`, `saved`, `user/:id`, `:id`, like, comment, save, share, view, report |
| Chat | `/chat` | `conversations` (direct, group), messages, read, members, settings. Live events over Socket.IO |
| Notifications | `/notifications` | list, `unread-count`, `read-all`, `:id/read` |
| Calls | `/calls` | `config` (ICE servers), history. Signaling over Socket.IO |
| AI | `/ai` | `status`, `chat`, `captions`, `smart-replies`, `safety` |
| Admin | `/admin` | `stats`, `users`, `posts`, `reels`, `comments`, `reports`, `audit` (admin role only) |

Socket.IO (same port, JWT in `auth.token`): `message:*`, `conversation:*`, `typing`, `presence`, `notification:*`, `call:*`.

## Security notes
Passwords hashed with bcrypt; JWT with database checks on every request; admin role read from the database and granted only from the command line;
input sanitized and validated (NoSQL injection, IDs, sizes); uploads checked by real file type; Helmet, strict CORS, rate limits, no stack traces to clients;
secrets only in `.env`; every admin action audited. Full list and **remaining risks** (no OTP provider yet, tokens in browser storage,
in-memory rate limits) are in **SECURITY.md**.

## Future scope
Real OTP provider (SMS/email) and 2FA for admins; httpOnly-cookie sessions with token revocation; Redis for shared rate limits and Socket.IO scaling;
voice messages and group calls; story replies and reactions; image/video analysis in the safety check; push notifications; a TURN server for calls on strict networks;
automated browser (Playwright) tests; analytics and monitoring.
