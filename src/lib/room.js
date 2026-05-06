import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, serverTimestamp, getDocs, deleteDoc
} from 'firebase/firestore'
import { db } from './firebase'

export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const hashCode = async (str) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(str.toUpperCase().trim())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const createRoom = async (events, revealCode, mode = 'libre') => {
  const roomCode = generateRoomCode()
  const hashedReveal = await hashCode(revealCode)
  await setDoc(doc(db, 'rooms', roomCode), {
    events,
    revealCodeHash: hashedReveal,
    revealed: false,
    mode,
    createdAt: serverTimestamp(),
  })
  return roomCode
}

export const joinRoom = async (roomCode, userId, playerName) => {
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Sala no encontrada')
  const playerRef = doc(db, 'rooms', roomCode, 'players', userId)
  const playerSnap = await getDoc(playerRef)
  if (!playerSnap.exists()) {
    await setDoc(playerRef, {
      name: playerName,
      joinedAt: serverTimestamp(),
      votes: {},
      hasVoted: false,
    })
  }
  return roomSnap.data()
}

export const submitVotes = async (roomCode, userId, newVotes) => {
  const playerRef = doc(db, 'rooms', roomCode, 'players', userId)
  const playerSnap = await getDoc(playerRef)
  const existingVotes = playerSnap.exists() ? (playerSnap.data().votes || {}) : {}
  const mergedVotes = { ...existingVotes, ...newVotes }
  await updateDoc(playerRef, { votes: mergedVotes, hasVoted: true })
}

export const tryReveal = async (roomCode, inputCode) => {
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Sala no encontrada')
  const { revealCodeHash } = roomSnap.data()
  const inputHash = await hashCode(inputCode)
  if (inputHash !== revealCodeHash) throw new Error('Código incorrecto')
  await updateDoc(roomRef, { revealed: true })
}

export const setCorrectAnswers = async (roomCode, correctAnswers) => {
  await updateDoc(doc(db, 'rooms', roomCode), { correctAnswers })
}

export const addEventToRoom = async (roomCode, newEvent) => {
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Sala no encontrada')
  const { events } = roomSnap.data()
  await updateDoc(roomRef, { events: [...events, newEvent] })
  const playersSnap = await getDocs(collection(db, 'rooms', roomCode, 'players'))
  const updates = []
  playersSnap.forEach(playerDoc => {
    const data = playerDoc.data()
    if (data.hasVoted && !data.votes?.[newEvent.id]) {
      updates.push(updateDoc(playerDoc.ref, { hasVoted: false }))
    }
  })
  await Promise.all(updates)
}

export const removePlayer = async (roomCode, userId) => {
  await deleteDoc(doc(db, 'rooms', roomCode, 'players', userId))
}

export const listenRoom = (roomCode, callback) => {
  return onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

export const listenPlayers = (roomCode, callback) => {
  return onSnapshot(collection(db, 'rooms', roomCode, 'players'), (snap) => {
    const players = {}
    snap.forEach(d => { players[d.id] = d.data() })
    callback(players)
  })
}
