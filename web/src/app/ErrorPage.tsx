import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { reportError } from '../lib/monitoring'
import { SucculentIcon } from '../shared/ui'

/** Замість технічного «Unexpected Application Error!» — зрозуміла сторінка; сама помилка йде в Sentry. */
export function ErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) reportError(error, { action: 'page_crash', url: location.pathname })
  }, [error, notFound])

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-100 p-4">
      <div className="max-w-md rounded-[32px] bg-sand-50 px-6 py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sand-200 text-brand-600">
          <SucculentIcon className="w-12" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-extrabold text-brand-600">
          {notFound ? t('errorPage.notFound') : t('errorPage.title')}
        </h1>
        <p className="mt-3 text-sand-700">{notFound ? t('errorPage.notFoundText') : t('errorPage.text')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!notFound && (
            <button onClick={() => location.reload()} className="min-h-11 rounded-xl bg-sand-200 px-5 font-bold hover:bg-sand-300">
              {t('errorPage.reload')}
            </button>
          )}
          <Link to="/" className="rounded-xl bg-brand-600 px-5 py-3 font-bold text-sand-50 hover:bg-brand-700">
            {t('errorPage.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
