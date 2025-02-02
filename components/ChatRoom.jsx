import React from 'react';

function ChatRoom({ room, username, onLeave }) {
  const [messages, setMessages] = React.useState([]);
  const [inputValue, setInputValue] = React.useState('');
  const [showWhiteboard, setShowWhiteboard] = React.useState(false);
  const messageListRef = React.useRef(null);
  const roomConnection = React.useRef(null);

  React.useEffect(() => {
    roomConnection.current = new window.chatUtils.WebsimSocket();
    
    const unsubscribe = roomConnection.current.collection('message')
      .filter({ room_id: room.id })
      .subscribe((msgs) => {
        setMessages(msgs.sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        ));
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
      });

    // Update active users
    const updateActiveUsers = async () => {
      try {
        const configs = await roomConnection.current.collection('room_config')
          .filter({ id: room.id })
          .getList();
          
        if (configs.length > 0) {
          const config = configs[0];
          await roomConnection.current.collection('room_config').update(config.id, {
            active_users: [...new Set([...config.active_users || [], username])]
          });
        }
      } catch (error) {
        console.error('Error updating active users:', error);
      }
    };
    
    updateActiveUsers();

    return () => {
      unsubscribe();
      roomConnection.current = null;
    };
  }, [room.id, username]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const filteredContent = window.chatUtils.filterMessage(
      inputValue.trim(), 
      room.moderateContent, 
      room.advancedModeration
    );

    try {
      await roomConnection.current.collection('message').create({
        content: filteredContent,
        room_id: room.id,
        type: 'text',
        ephemeral: room.ephemeralMessages,
        read_by: [], // Initialize empty read_by array for ephemeral messages
        created_at: new Date().toISOString()
      });
      
      setInputValue('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Function to mark message as read
  const markMessageAsRead = async (message, connection) => {
    try {
      await connection.collection('message').update(message.id, {
        read_by: [...new Set([...message.read_by || [], username])]
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Add useEffect for message reading
  React.useEffect(() => {
    if (!messages.length) return;
    
    messages.forEach(message => {
      if (message.ephemeral) {
        markMessageAsRead(message, roomConnection.current);
      }
    });
  }, [messages]);

  return (
    <div className="h-[calc(100vh-12rem)] dark-card rounded-lg shadow flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">
            {room.name}
            <button
              onClick={() => {
                navigator.clipboard.writeText(room.room_code);
                alert('Room code copied to clipboard!');
              }}
              className="ml-2 px-2 py-1 text-sm bg-indigo-600 rounded hover:bg-indigo-700"
              title="Copy room code"
            >
              📋 {room.room_code}
            </button>
          </h2>
          <p className="text-sm text-gray-400">
            Type: {room.type} | Duration: {room.duration}
          </p>
        </div>
        {room.features?.whiteboard && (
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className="px-3 py-1 dark-surface-light rounded hover:bg-gray-700"
          >
            {showWhiteboard ? 'Hide' : 'Show'} Whiteboard
          </button>
        )}
        <button
          onClick={onLeave}
          className="px-3 py-1 dark-surface-light rounded hover:bg-gray-700"
        >
          Leave Room
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col ${showWhiteboard ? 'w-1/2' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto p-4" ref={messageListRef}>
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                isOwnMessage={message.username === username}
              />
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
            <div className="flex space-x-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 dark-input rounded"
              />
              <button
                type="submit"
                className="px-4 py-2 dark-button"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {showWhiteboard && (
          <div className="w-1/2 border-l border-gray-700">
            <Whiteboard room={room} username={username} />
          </div>
        )}
      </div>
    </div>
  );
}