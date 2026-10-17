import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

// Проєкт "demo-*" працює тільки з емуляторами і не потребує справжнього Firebase-проєкту.
export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-succulents',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-succulents.appspot.com',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'europe-central2')
export const storage = getStorage(app)

// Емулятори шукаємо на тому ж комп'ютері, з якого відкрито сайт:
// localhost — з цього ПК, 192.168.x.x — з телефона в тій самій Wi-Fi мережі.
export const emulatorHost = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, emulatorHost, 8080)
  connectFunctionsEmulator(functions, emulatorHost, 5001)
  connectStorageEmulator(storage, emulatorHost, 9199)
}

/**
 * Посилання на фото з емулятора містять адресу ПК, з якого фото завантажили (напр. 127.0.0.1).
 * На телефоні підміняємо її на поточну. На справжньому Firebase посилання не змінюються.
 */
export function imageUrl(url: string): string {
  if (!useEmulators) return url
  return url.replace(/^http:\/\/[^/:]+:9199\//, `http://${emulatorHost}:9199/`)
}
