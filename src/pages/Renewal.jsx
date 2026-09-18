import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, deleteDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_PASSWORD = 'Chixmist26'

function generateToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function formatDate(value) {
  if (!value) return '—'
  const d = value?.toDate ? value.toDate() : new Date(value)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Renewal() {
  const { currentUser, userProfile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(false)
  const [newToken, setNewToken] = useState('')
  const [embeddedPassword, setEmbeddedPassword] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'admin_tokens'), where('email', '==', currentUser.email))
    const unsub = onSnapshot(
      q,
      (s) => {
        setTokens(s.docs.map((d) => ({ token: d.id, ...d.data() })))
        if (!embeddedPassword && s.docs.length > 0 && s.docs[0].data().password) {
          setEmbeddedPassword(s.docs[0].data().password)
        }
      },
      (err) => setMessage({ type: 'error', text: err.message })
    )
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  if (!currentUser) return <Navigate to="/login" replace />
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center max-w-md shadow-sm">
          <p className="text-4xl mb-3">🔒</p>
          <h3 className="text-base font-semibold mb-1">Admin access required</h3>
          <p className="text-sm text-gray-400 mb-4">You need an admin account to renew access tokens.</p>
          <button onClick={() => signOut().then(() => navigate('/login'))} className="text-sm text-gray-500 underline">Switch account</button>
        </div>
      </div>
    )
  }

  async function handleLogout() {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Logout failed' })
    }
  }

  async function handleRenew() {
    setMessage({ type: '', text: '' })
    if (tokens.length > 0 && !window.confirm('Renewing will REVOKE all of your current access tokens. The old tokens will stop working immediately. Continue?')) return

    setLoading(true)
    try {
      const existing = tokens.find((t) => t.password)
      const pass = embeddedPassword.trim() || existing?.password || DEFAULT_PASSWORD

      await Promise.all(tokens.map((t) => deleteDoc(doc(db, 'admin_tokens', t.token))))

      const token = generateToken()
      await setDoc(doc(db, 'admin_tokens', token), {
        email: currentUser.email,
        password: pass,
        created_at: serverTimestamp(),
      })

      setNewToken(token)
      setMessage({ type: 'success', text: 'New access token generated and old tokens revoked.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to renew token' })
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(newToken)
      setMessage({ type: 'success', text: 'Token copied to clipboard' })
    } catch {
      setMessage({ type: 'error', text: 'Could not copy automatically — please copy manually' })
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-900">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M22 4L12 13L2 4"/>
            </svg>
            <div>
              <span className="text-lg font-bold tracking-wide text-primary-900">CHIXMIST</span>
              <p className="text-xs text-gray-400">Admin Access Token Renewal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">{currentUser.email}</span>
            <button onClick={handleLogout} className="text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {message.text && (
          <div className={`rounded-lg px-4 py-3 text-sm border ${
            message.type === 'error'
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-green-50 border-green-100 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        {newToken && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">Your New Access Token</h3>
              <span className="text-xs text-gray-400">Shown once — save it now</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Use this token on the dashboard login screen for instant sign-in. It never expires.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={newToken}
                onFocus={(e) => e.target.select()}
                className="flex-1 font-mono text-xs px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-800"
              />
              <button onClick={handleCopy} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                Copy
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Your Access Tokens</h2>
              <p className="text-xs text-gray-400">{userProfile?.first_name || ''} {userProfile?.last_name || ''} · {currentUser.email}</p>
            </div>
            <button
              onClick={handleRenew}
              disabled={loading}
              className="bg-primary-900 hover:bg-primary-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Renewing...' : 'Renew / Generate New Token'}
            </button>
          </div>

          {tokens.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-3">🗝️</p>
              <p className="text-sm text-gray-500 mb-1">No active access token found.</p>
              <p className="text-xs text-gray-400">Generate a new one to enable instant sign-in.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {tokens.map((t) => (
                <div key={t.token} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3">
                  <code className="font-mono text-xs text-gray-700 flex-1 break-all">{t.token}</code>
                  <span className="text-xs text-gray-400 whitespace-nowrap">created {formatDate(t.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Token sign-in password (embedded)</h3>
          <p className="text-xs text-gray-500 mb-3">
            The access token signs the admin in automatically using an embedded password. Change it here if your admin password changed.
          </p>
          <div className="max-w-xs">
            <input
              type="password"
              value={embeddedPassword}
              onChange={(e) => setEmbeddedPassword(e.target.value)}
              placeholder={DEFAULT_PASSWORD}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-900/20 focus:border-primary-900"
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Note</h3>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            <li>Access tokens never expire — they stay valid until revoked.</li>
            <li>Anyone who knows your token can sign in to the dashboard as you. Treat it like a password.</li>
            <li>Renewing revokes all existing tokens for your email and issues a single new one.</li>
          </ul>
        </div>
      </main>
    </div>
  )
}