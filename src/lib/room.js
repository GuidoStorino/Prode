import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

// Generate a random 4-letter room code
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Simple hash for reveal code (not cryptographic, just obfuscation)
export const hashCode = async (str) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(str.toUpperCase().trim())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Create a new room
export const createRoom = async (events, revealCode) => {
  const roomCode = generateRoomCode()
  const hashedReveal = await hashCode(revealCode)

  await setDoc(doc(db, 'rooms', roomCode), {
    events,
    revealCodeHash: hashedReveal,
    revealed: false,
    createdAt: serverTimestamp(),
  })

  return roomCode
}

// Join a room (register a player) - idempotent, won't overwrite existing votes
export const joinRoom = async (roomCode, userId, playerName) => {
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Sala no encontrada')

  const playerRef = doc(db, 'rooms', roomCode, 'players', userId)
  const playerSnap = await getDoc(playerRef)

  // If player already exists (rejoining), don't overwrite their votes
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

// Submit votes for a player - merges with existing votes to preserve previous ones
export const submitVotes = async (roomCode, userId, newVotes) => {
  const playerRef = doc(db, 'rooms', roomCode, 'players', userId)
  const playerSnap = await getDoc(playerRef)
  const existingVotes = playerSnap.exists() ? (playerSnap.data().votes || {}) : {}
  const mergedVotes = { ...existingVotes, ...newVotes }
  await updateDoc(playerRef, { votes: mergedVotes, hasVoted: true })
}

// Try to reveal the room
export const tryReveal = async (roomCode, inputCode) => {
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Sala no encontrada')

  const { revealCodeHash } = roomSnap.data()
  const inputHash = await hashCode(inputCode)

  if (inputHash !== revealCodeHash) throw new Error('Código incorrecto')

  await updateDoc(roomRef, { revealed: true })
}

// Add a new event to an existing room, reopen voting only for players missing that event
export const addEventToRoom = async (roomCode, newEvent) => {
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Sala no encontrada')

  const { events } = roomSnap.data()
  const updatedEvents = [...events, newEvent]

  // Update events list
  await updateDoc(roomRef, { events: updatedEvents })

  // For each player that already voted, check if they're missing this new event
  // If so, reopen their voting (hasVoted = false) without touching existing votes
  const playersSnap = await import('firebase/firestore').then(({ getDocs }) =>
    getDocs(collection(db, 'rooms', roomCode, 'players'))
  )

  const updates = []
  playersSnap.forEach(playerDoc => {
    const data = playerDoc.data()
    if (data.hasVoted && !data.votes?.[newEvent.id]) {
      updates.push(updateDoc(playerDoc.ref, { hasVoted: false }))
    }
  })

  await Promise.all(updates)
}

export const setCorrectAnswers = async (roomCode, correctAnswers) => {
  await updateDoc(doc(db, 'rooms', roomCode), { correctAnswers })
}

// Listen to room changes
export const listenRoom = (roomCode, callback) => {
  return onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// Listen to players changes
export const listenPlayers = (roomCode, callback) => {
  return onSnapshot(collection(db, 'rooms', roomCode, 'players'), (snap) => {
    const players = {}
    snap.forEach(d => { players[d.id] = d.data() })
    callback(players)
  })
}
