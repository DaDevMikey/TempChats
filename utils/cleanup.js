import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function cleanupExpiredData() {
  try {
    const now = new Date().toISOString();

    // Cleanup expired rooms
    const roomsRef = collection(db, 'room_config');
    const q = query(roomsRef, where('expires_at', '<', now));
    const expiredRooms = await getDocs(q);

    expiredRooms.forEach(async (room) => {
      // Delete all messages in expired rooms
      const messagesRef = collection(db, 'messages');
      const messageQuery = query(messagesRef, where('room_id', '==', room.id));
      const messages = await getDocs(messageQuery);
      
      messages.forEach(async (message) => {
        await deleteDoc(doc(db, 'messages', message.id));
      });
      
      // Delete the room config
      await deleteDoc(doc(db, 'room_config', room.id));
    });

    // Remove inactive users from active rooms
    const activeRoomsQuery = query(roomsRef, where('expires_at', '>', now));
    const activeRooms = await getDocs(activeRoomsQuery);

    activeRooms.forEach(async (room) => {
      const inactiveTimeout = new Date();
      inactiveTimeout.setMinutes(inactiveTimeout.getMinutes() - 30);
      
      const messagesRef = collection(db, 'messages');
      const messageQuery = query(messagesRef, where('room_id', '==', room.id));
      const messages = await getDocs(messageQuery);
      
      const config = room.data();
      const activeUsers = config.active_users.filter(username => {
        const userMessages = messages.docs
          .filter(msg => msg.data().username === username)
          .sort((a, b) => new Date(b.data().created_at) - new Date(a.data().created_at));
          
        return userMessages.length > 0 && new Date(userMessages[0].data().created_at) > inactiveTimeout;
      });

      if (activeUsers.length !== config.active_users.length) {
        await updateDoc(doc(db, 'room_config', room.id), {
          active_users: activeUsers
        });
      }
    });
  } catch (error) {
    console.error('Error cleaning up expired data:', error);
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredData, 60 * 1000);