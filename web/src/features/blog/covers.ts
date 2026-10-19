import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

/**
 * Заставки статей. Самі статті — у коді (articles.ts), а фото-заставку продавець додає з сайту:
 * вона зберігається в документі blog/{slug} (поле cover — посилання на фото у сховищі).
 * Немає заставки — показуємо значок теми, як раніше.
 */
export function useArticleCovers() {
  return useQuery({
    queryKey: ['blogCovers'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'blog'))
      const covers = new Map<string, string>()
      snap.forEach((d) => {
        const cover = d.data().cover
        if (typeof cover === 'string' && cover) covers.set(d.id, cover)
      })
      return covers
    },
    staleTime: 10 * 60 * 1000,
  })
}

/** Додати, замінити (file) або прибрати (null) заставку статті. Лише для продавця (так і в Rules). */
export function useSetArticleCover(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File | null) => {
      const ref = doc(db, 'blog', slug)
      if (!file) return setDoc(ref, { cover: deleteField(), updatedAt: serverTimestamp() }, { merge: true })
      // Сховище фото вантажиться лише тут — покупцям, які читають блог, цей код не потрібен
      const { uploadBlogCover } = await import('../admin/imageUpload')
      const cover = await uploadBlogCover(file)
      return setDoc(ref, { cover, updatedAt: serverTimestamp() }, { merge: true })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blogCovers'] }),
  })
}

/** Фото до статті (блок «Фото» під текстом): посилання на фото у сховищі, у порядку додавання. */
export function useArticlePhotos(slug: string) {
  return useQuery({
    queryKey: ['blogPhotos', slug],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'blog', slug))
      const photos = snap.data()?.photos
      return Array.isArray(photos) ? (photos.filter((p) => typeof p === 'string') as string[]) : []
    },
    staleTime: 10 * 60 * 1000,
  })
}

/** Додати фото (file) або прибрати (url) з блоку «Фото» статті. Лише для продавця. */
export function useEditArticlePhotos(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (change: { add: File } | { remove: string }) => {
      const ref = doc(db, 'blog', slug)
      if ('remove' in change) return setDoc(ref, { photos: arrayRemove(change.remove), updatedAt: serverTimestamp() }, { merge: true })
      const { uploadBlogCover } = await import('../admin/imageUpload')
      const url = await uploadBlogCover(change.add)
      return setDoc(ref, { photos: arrayUnion(url), updatedAt: serverTimestamp() }, { merge: true })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blogPhotos', slug] }),
  })
}
