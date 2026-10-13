import Logo from './Logo.jsx'

// Shared card layout for all auth screens (keeps the Phase 1 look)
export default function AuthShell({ title, children, onSubmit }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} noValidate className="card w-full max-w-sm space-y-3 p-6">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="text-center text-lg font-semibold">{title}</h1>
        {children}
      </form>
    </main>
  )
}

export const Alert = ({ kind = 'error', children }) =>
  children ? (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${kind === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'}`}>{children}</p>
  ) : null

// Shown only when the backend runs without an SMS/email provider
export const DevOtpBanner = ({ otp }) =>
  otp ? (
    <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <strong>DEVELOPMENT MODE:</strong> no SMS/email provider is configured, so nothing was sent. Your code is <strong className="font-mono text-sm">{otp}</strong>.
    </p>
  ) : null
