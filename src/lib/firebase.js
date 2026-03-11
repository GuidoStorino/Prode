import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBKZho8a1WKrSSn6VJKqkxOO9p7DPliWfI",
  authDomain: "prode-bb059.firebaseapp.com",
  projectId: "prode-bb059",
  storageBucket: "prode-bb059.firebasestorage.app",
  messagingSenderId: "389248468122",
  appId: "1:389248468122:web:8edcacc0f74b5b5f2f0b23"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

export const signInAnon = () => signInAnonymously(auth)
