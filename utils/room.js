import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export async function createRoom(config) {
  try {
    // Generate a unique room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const roomConfig = await addDoc(collection(db, 'room_config'), {
      ...config,
      room_code: roomCode,
      created_at: new Date().toISOString(),
      expires_at: calculateExpiry(config.duration),
      active_users: [],
      typing_users: []
    });

    return {
      id: roomConfig.id,
      room_code: roomCode,
      ...config
    };
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

export async function joinRoom(roomCode) {
  try {
    const roomsRef = collection(db, 'room_config');
    const q = query(roomsRef, where('room_code', '==', roomCode.toUpperCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('Room not found');
    }

    const config = querySnapshot.docs[0].data();
    const roomId = querySnapshot.docs[0].id;
    
    // Check if room has expired
    if (new Date(config.expires_at) < new Date()) {
      throw new Error('Room has expired');
    }

    // Update active users
    const username = localStorage.getItem('username');
    const roomRef = doc(db, 'room_config', roomId);
    await updateDoc(roomRef, {
      active_users: [...new Set([...config.active_users, username])]
    });

    return {
      id: roomId,
      room_code: roomCode,
      ...config
    };
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

export async function leaveRoom(roomId) {
  try {
    const username = localStorage.getItem('username');
    const roomRef = doc(db, 'room_config', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
      const config = roomSnap.data();
      const activeUsers = config.active_users.filter(user => user !== username);
      await updateDoc(roomRef, {
        active_users: activeUsers
      });
    }
  } catch (error) {
    console.error('Error leaving room:', error);
    throw error;
  }
}

export function calculateExpiry(duration) {
  const now = new Date();
  switch(duration) {
    case '1h': return new Date(now.getTime() + 60*60*1000).toISOString();
    case '4h': return new Date(now.getTime() + 4*60*60*1000).toISOString();
    case '24h': return new Date(now.getTime() + 24*60*60*1000).toISOString();
    case '7d': return new Date(now.getTime() + 7*24*60*60*1000).toISOString();
    case '30d': return new Date(now.getTime() + 30*24*60*60*1000).toISOString();
    case '1y': return new Date(now.getTime() + 365*24*60*60*1000).toISOString();
    default: return new Date(now.getTime() + 60*60*1000).toISOString();
  }
}

export function checkLoginExpiry() {
  const loginTime = localStorage.getItem('loginTime');
  if (loginTime) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    if (new Date(loginTime) < oneMonthAgo) {
      localStorage.removeItem('username');
      localStorage.removeItem('loginTime');
      return true;
    }
  }
  return false;
}