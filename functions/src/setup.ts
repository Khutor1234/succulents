import { initializeApp } from 'firebase-admin/app'
import { setGlobalOptions } from 'firebase-functions'

initializeApp()

// Варшава — найближчий до України регіон Google Cloud.
setGlobalOptions({ region: 'europe-central2', maxInstances: 10 })
