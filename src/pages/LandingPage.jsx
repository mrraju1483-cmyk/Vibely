import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-pink-100 px-6 text-center dark:from-slate-950 dark:via-slate-900 dark:to-purple-950">
      <Logo size="lg" />
      <h1 className="mt-8 max-w-2xl text-4xl font-extrabold sm:text-6xl">Share Your <span className="bg-gradient-to-r from-brand-600 to-pink-500 bg-clip-text text-transparent">Vibe.</span></h1>
      <p className="mt-4 max-w-md text-slate-600 dark:text-slate-300">Post moments, follow friends, chat in real time and discover what is trending, all in one friendly place.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/register" className="btn-primary px-6 py-3">Get Started</Link>
        <Link to="/login" className="btn-ghost px-6 py-3">Login</Link>
      </div>
    </main>
  )
}
