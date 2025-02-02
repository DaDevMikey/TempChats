import React from 'react';

function ChatMessage({ message, isOwnMessage }) {
  return (
    <div className={`mb-4 ${isOwnMessage ? 'ml-auto' : ''}`}>
      <div className="flex items-center mb-1">
        <img
          src={`https://images.websim.ai/avatar/${message.username}`}
          alt={message.username}
          className="w-8 h-8 rounded-full mr-2"
        />
        <span className="font-semibold text-gray-100">{message.username}</span>
        <span className="text-gray-400 text-sm ml-2">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
      <div className={`message-bubble ${isOwnMessage ? 'own' : 'other'}`}>
        <p className="break-words">{message.content}</p>
      </div>
    </div>
  );
}

export default ChatMessage;