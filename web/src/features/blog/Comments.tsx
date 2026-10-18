import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore'
import { LogIn, MessageCircle, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { db } from '../../firebase/config'
import { reportError, track } from '../../lib/monitoring'
import { useAuth } from '../auth/authStore'

interface Comment {
  id: string
  uid: string
  name: string
  text: string
  createdAt?: Timestamp
}

const MAX = 1000

const commentsRef = (slug: string) => collection(db, 'blog', slug, 'comments')

function useComments(slug: string) {
  return useQuery({
    queryKey: ['blog-comments', slug],
    queryFn: async () => {
      const snap = await getDocs(query(commentsRef(slug), orderBy('createdAt', 'asc'), limit(300)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment)
    },
  })
}

const formatWhen = (c: Comment) =>
  c.createdAt?.toDate().toLocaleString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? ''

/** Перша літера імені — замість аватарки */
const initial = (name: string) => name.trim().charAt(0).toLocaleUpperCase('uk') || '?'

/**
 * Коментарі під статтею. Читають усі; написати можна після входу (ім’я береться з акаунта, його можна змінити).
 * Редагувати не можна; видалити — свій коментар, а продавець — будь-який (модерація).
 */
export function Comments({ slug }: { slug: string }) {
  const { user, role } = useAuth()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const comments = useComments(slug)
  // Ім’я за замовчуванням — лише ім’я з акаунта Google (без прізвища), щоб не показувати зайвого
  // (поки людина не змінила його сама; акаунт може завантажитися вже після відкриття сторінки)
  const [editedName, setName] = useState<string | null>(null)
  const name = editedName ?? user?.displayName?.split(' ')[0] ?? ''
  const [text, setText] = useState('')

  const add = useMutation({
    mutationFn: () => addDoc(commentsRef(slug), { uid: user!.uid, name: name.trim(), text: text.trim(), createdAt: serverTimestamp() }),
    onSuccess: () => {
      track('blog_comment', { slug })
      setText('')
      void queryClient.invalidateQueries({ queryKey: ['blog-comments', slug] })
    },
    onError: (e) => reportError(e, { action: 'blog_comment', slug }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteDoc(doc(db, 'blog', slug, 'comments', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blog-comments', slug] }),
    onError: (e) => reportError(e, { action: 'blog_comment_delete', slug }),
  })

  const canSend = name.trim().length >= 1 && text.trim().length >= 2 && !add.isPending
  function submit(e: FormEvent) {
    e.preventDefault()
    if (canSend) add.mutate()
  }

  const list = comments.data ?? []
  const input = 'w-full rounded-xl border-2 border-sand-200 bg-sand-50 px-4 py-3 outline-none focus:border-brand-500'

  return (
    <section className="mx-auto mt-12 max-w-2xl" aria-labelledby="comments-title">
      <h2 id="comments-title" className="flex items-center gap-2 font-display text-2xl font-extrabold text-brand-600">
        <MessageCircle size={24} strokeWidth={2.25} aria-hidden />
        Коментарі
        {list.length > 0 && <span className="rounded-full bg-sand-200 px-2.5 text-base text-sand-700">{list.length}</span>}
      </h2>

      {comments.isLoading && <p className="mt-4 text-sand-700">Завантаження…</p>}
      {comments.isError && <p className="mt-4 text-red-700">Не вдалося завантажити коментарі.</p>}
      {comments.data && list.length === 0 && <p className="mt-4 text-sand-700">Поки що немає коментарів. Поділіться своїм досвідом першими!</p>}

      <ul className="mt-5 space-y-3">
        {list.map((c) => {
          const mine = c.uid === user?.uid
          return (
            <li key={c.id} className="flex gap-3 rounded-2xl border-2 border-sand-200 bg-sand-50 p-4">
              <span
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold ${mine ? 'bg-brand-600 text-sand-50' : 'bg-sunset-100 text-sunset-700'}`}
              >
                {initial(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold">{c.name}</span>
                  <span className="text-xs text-sand-700">{formatWhen(c)}</span>
                </p>
                <p className="mt-1 leading-relaxed break-words whitespace-pre-line">{c.text}</p>
              </div>
              {(mine || role === 'seller') && (
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => window.confirm('Видалити цей коментар?') && remove.mutate(c.id)}
                  aria-label="Видалити коментар"
                  title="Видалити"
                  className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sand-700 hover:bg-red-100 hover:text-red-700 disabled:opacity-40"
                >
                  <Trash2 size={16} strokeWidth={2.25} aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {user ? (
        <form onSubmit={submit} className="mt-6 space-y-3 rounded-3xl border-2 border-sand-200 bg-sand-100 p-4">
          <label className="block">
            <span className="text-sm font-bold">Ваше ім’я</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={`${input} mt-1`} />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Коментар</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX}
              rows={4}
              required
              placeholder="Питання, досвід, порада…"
              className={`${input} mt-1 resize-y`}
            />
            <span className="mt-1 block text-right text-xs text-sand-700">
              {text.length}/{MAX}
            </span>
          </label>
          {add.isError && <p className="text-sm text-red-700">Не вдалося надіслати. Спробуйте ще раз.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-sand-700">Ім’я й коментар побачать усі відвідувачі сайту.</p>
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-sand-50 hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
            >
              <Send size={17} strokeWidth={2.25} aria-hidden />
              {add.isPending ? 'Надсилаємо…' : 'Надіслати'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-dashed border-sand-300 p-5">
          <p className="text-sand-700">Щоб написати коментар, увійдіть у свій акаунт.</p>
          <Link
            to={`/login?next=${encodeURIComponent(pathname)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-sand-50 hover:bg-brand-700"
          >
            <LogIn size={17} strokeWidth={2.25} aria-hidden />
            Увійти
          </Link>
        </div>
      )}
    </section>
  )
}
