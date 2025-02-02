import { collection, addDoc, query, where, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const violentWords = [
  'racist', 'nazis', 'hitler', 'kill', 'murder'
];

const mildWords = [
  'fuck', 'shit', 'damn', 'ass'
];

export const filterMessage = (content, moderateContent, advancedModeration) => {
  if (!moderateContent && !advancedModeration) return content;
  
  let filtered = content;
  
  // Always filter violent words if moderation is enabled
  if (moderateContent) {
    violentWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '***');
    });
  }
  
  // Only filter mild words if advanced moderation is enabled
  if (advancedModeration) {
    mildWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '***');
    });
  }
  
  return filtered;
};

export const formatMessage = (message) => {
  const timestamp = new Date(message.created_at).toLocaleTimeString();
  return {
    ...message,
    timestamp
  };
};

export const scrollToBottom = (element) => {
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
};

export const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const markMessageAsRead = async (message) => {
  if (!message.read_by) {
    message.read_by = [];
  }
  
  const currentUser = localStorage.getItem('username');
  
  if (!message.read_by.includes(currentUser)) {
    try {
      const messageRef = doc(db, 'messages', message.id);
      await updateDoc(messageRef, {
        read_by: [...message.read_by, currentUser]
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }
};

export const shouldShowMessage = (message) => {
  if (!message.ephemeral) return true;
  
  const currentUser = localStorage.getItem('username');
  return message.username === currentUser || !message.read_by?.includes(currentUser);
};