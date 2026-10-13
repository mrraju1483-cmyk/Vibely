# Vibely security notes

## Controls in place
- **Passwords:** bcrypt (cost 12). Resetting a password signs out every older session (`passwordChangedAt`).
- **Sessions:** signed JWTs (HS256, pinned algorithm, expiry). The user is re-read from the database on every request, so a deactivated or removed account is locked out immediately, and Socket.IO connections are cut at the same moment.
- **Roles:** `requireAdmin` reads the role from the database, not from the token. Admins can only be created or revoked from the command line (`npm run admin:grant -- email`), never through the API. Admin accounts cannot be changed from the dashboard, and the last admin cannot be revoked.
- **Input:** every body, query and URL parameter is stripped of `$` / `.` keys (NoSQL operator injection), validated as a plain string, and size-limited (10 KB JSON, 64 KB for AI). Every `:id` must be a 24-character hex ObjectId. Search text is regex-escaped.
- **Uploads:** the real file type is read from the file's first bytes (the browser's claim is ignored), SVG is refused, sizes are capped, and server-generated file names are used.
- **Headers and CORS:** Helmet security headers, an explicit CORS allow-list (`CLIENT_URL`), `Cache-Control: no-store` on all API answers.
- **Abuse limits:** rate limits on login/register, OTP, general API, search, posting, AI (per user) and admin routes. OTP codes expire (5 min), are hashed, and allow 5 attempts.
- **Errors:** friendly messages only. No stack traces, file paths or database details reach the client. Unknown accounts and wrong passwords give the same answer.
- **Secrets:** only in `.env` files (git-ignored). Browsers never see the AI key, TURN secret or Cloudinary secret. `npm run audit:secrets` (in `server/`) scans the whole repository for hardcoded secrets, committed `.env` files and frontend debug logging.
- **Audit trail:** every admin action (who, what, why) is written to `ModerationLog`. It is append-only in the app.

## Remaining risks (know these before going live)
1. **Tokens live in browser storage.** A cross-site-scripting bug would expose them. React escapes output, but keep dependencies updated. Moving to httpOnly cookies is a larger change.
2. **No server-side token revocation list.** Logout only deletes the token in the browser. A stolen token stays valid until it expires, or until the password changes or the account is deactivated. Keep `JWT_EXPIRES_IN` short in production.
3. **Rate limits are per server process (in memory).** With more than one server instance, use a shared store such as Redis.
4. **No real OTP provider yet.** In production `OTP_PROVIDER=dev` delivers nothing, so sign-up verification and password reset cannot complete. Connect an SMS/email provider before launch.
5. **Admin accounts have no two-factor login.** Use strong unique passwords.
6. **Frontend hosting headers.** Helmet protects the API. Set a Content-Security-Policy on the frontend host (for example on Vercel).
7. **Local uploads are for development only.** Use Cloudinary (not yet tested against a real account) or another object store in production.
8. **Moderation is manual.** Reports are reviewed by people. The AI safety check is advisory and only reads text.
9. **Dependencies were not scanned here.** Run `npm audit` in the project root and in `server/`, and `pip-audit` in `ai-service/`.
