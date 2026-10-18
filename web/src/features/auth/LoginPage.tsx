import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { auth } from '../../firebase/config'
import { reportError, track } from '../../lib/monitoring'
import { Button, Input, PageTitle, PasswordInput } from '../../shared/ui'
import { useAuth } from './authStore'

const google = new GoogleAuthProvider()
// Завжди показувати вікно вибору акаунта Google, навіть якщо в браузері вже є один залогінений.
google.setCustomParameters({ prompt: 'select_account' })

/**
 * Телефони й вбудовані браузери (Telegram, Instagram…) погано працюють зі спливними вікнами:
 * вікно відкривається новою вкладкою й не може повернути результат. Там одразу переходимо на сторінку Google.
 */
const preferRedirect = () =>
  window.matchMedia('(pointer: coarse)').matches || /Telegram|FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(navigator.userAgent)

/** Людина сама закрила вікно Google — це не помилка, нічого не показуємо. */
const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']

/** Куди повернутись після входу: /login?next=/blog/... (лише адреси цього сайту). */
function nextPath() {
  const next = new URLSearchParams(location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // /login?mode=signup — одразу форма реєстрації (кнопка з банера на головній).
  const [isSignUp, setIsSignUp] = useState(() => new URLSearchParams(location.search).get('mode') === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const user = useAuth((s) => s.user)

  // Повернулись зі сторінки Google (вхід переходом): якщо щось пішло не так — показуємо помилку,
  // а коли вхід вдався — ведемо назад (або на головну), як і після звичайного входу.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => result && track('login', { method: 'google-redirect' }))
      .catch((e) => {
        if (e instanceof FirebaseError && CANCELLED.includes(e.code)) return
        reportError(e, { action: 'login', method: 'google-redirect', code: e instanceof FirebaseError ? e.code : undefined })
        setError(true)
      })
  }, [])
  useEffect(() => {
    if (user) navigate(nextPath(), { replace: true })
  }, [user, navigate])

  async function run(action: () => Promise<unknown>, method: string) {
    setError(false)
    try {
      await action()
      track('login', { method })
      navigate(nextPath())
    } catch (e) {
      if (e instanceof FirebaseError && CANCELLED.includes(e.code)) return
      // Неправильний пароль — звичайна річ, лише «крихта»; решта (напр. збій Google) — у Sentry.
      const code = e instanceof FirebaseError ? e.code : undefined
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/email-already-in-use') {
        track('login_failed', { method, code })
      } else {
        reportError(e, { action: 'login', method, code })
      }
      setError(true)
    }
  }

  async function signInWithGoogle() {
    if (preferRedirect()) {
      await signInWithRedirect(auth, google)
      return
    }
    try {
      await signInWithPopup(auth, google)
    } catch (e) {
      // Деякі мобільні браузери блокують спливні вікна — тоді переходимо на сторінку Google і повертаємось.
      if (e instanceof FirebaseError && e.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, google)
        return
      }
      throw e
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      if (!isSignUp) return signInWithEmailAndPassword(auth, email, password)
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      // Вітальні 100 грн нараховуються після підтвердження пошти — надсилаємо лист одразу.
      await sendEmailVerification(cred.user)
    }, isSignUp ? 'password_signup' : 'password')
  }

  return (
    <div className="mx-auto max-w-md rounded-[32px] bg-sand-50 p-6 sm:p-8">
      <PageTitle>{isSignUp ? t('auth.signUp') : t('auth.title')}</PageTitle>
      <p className="-mt-3 mb-6 text-sand-700">{t('auth.bonusHint')}</p>

      <button
        type="button"
        onClick={() => void run(signInWithGoogle, 'google')}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-sand-200 bg-white px-4 font-bold text-ink hover:border-sand-300"
      >
        <GoogleLogo />
        {t('auth.google')}
      </button>

      <div className="my-6 flex items-center gap-3 text-sm text-sand-700">
        <span className="h-px flex-1 bg-sand-200" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-sand-200" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input label={t('auth.email')} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordInput
          label={t('auth.password')}
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          required
          minLength={6}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-700">{t('auth.error')}</p>}
        <Button type="submit" className="w-full">
          {isSignUp ? t('auth.signUp') : t('auth.signIn')}
        </Button>
      </form>
      <button className="mt-4 min-h-11 text-sm font-bold text-brand-600 underline" onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? t('auth.toggleSignIn') : t('auth.toggleSignUp')}
      </button>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
