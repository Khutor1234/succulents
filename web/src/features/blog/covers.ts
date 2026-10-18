import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteField, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
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
