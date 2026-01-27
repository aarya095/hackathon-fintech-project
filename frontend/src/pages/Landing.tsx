import { Link } from "react-router-dom"
import { useAuthStore } from "../stores/auth"

export default function Landing() {
  const token = useAuthStore((s) => s.token)

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-teal-700">
            Trust-based lending
          </span>
          <nav className="flex gap-4">
            {token ? (
              <Link
                to="/dashboard"
                className="text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-medium text-white bg-teal-600 px-4 py-2 rounded-lg hover:bg-teal-700"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
          Lend and borrow with{" "}
          <span className="text-teal-600">trust, not tension</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-xl mx-auto">
          A gentle way to track money between friends and family. Transparent
          records, soft reminders, and zero pressure. Relationships first.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          {token ? (
            <Link
              to="/dashboard"
              className="btn-primary inline-flex items-center justify-center"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="btn-primary inline-flex items-center justify-center"
              >
                Create free account
              </Link>
              <Link
                to="/login"
                className="btn-secondary inline-flex items-center justify-center"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <ul className="mt-16 grid sm:grid-cols-3 gap-8 text-left">
          <li className="p-4 rounded-xl bg-white shadow-sm border border-gray-100">
            <span className="text-2xl" aria-hidden>🤝</span>
            <h2 className="mt-2 font-semibold text-gray-800">Trust first</h2>
            <p className="mt-1 text-sm text-gray-500">
              No penalties or interest. Both sides see the same balance and
              history.
            </p>
          </li>
          <li className="p-4 rounded-xl bg-white shadow-sm border border-gray-100">
            <span className="text-2xl" aria-hidden>✨</span>
            <h2 className="mt-2 font-semibold text-gray-800">Gentle reminders</h2>
            <p className="mt-1 text-sm text-gray-500">
              Optional, friendly nudge—or snooze with a reason. Your call.
            </p>
          </li>
          <li className="p-4 rounded-xl bg-white shadow-sm border border-gray-100">
            <span className="text-2xl" aria-hidden>📋</span>
            <h2 className="mt-2 font-semibold text-gray-800">Clear history</h2>
            <p className="mt-1 text-sm text-gray-500">
              Every payment and change is logged. Shared memory, not hidden
              spreadsheets.
            </p>
          </li>
        </ul>
      </main>
    </div>
  )
}
