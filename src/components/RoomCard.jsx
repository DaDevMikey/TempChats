import React, { useState, useEffect } from 'react';

export default function RoomCard({ room, onJoin }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!room.expires_at) return;

    const calculateTime = () => {
      const target = room.expires_at.toDate ? room.expires_at.toDate() : new Date(room.expires_at);
      const diffMs = target.getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('Expired');
        return;
      }
      setIsUrgent(diffMs < 30 * 60000);
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hours > 0) setTimeLeft(`${hours}h ${remMins}m left`);
      else setTimeLeft(`${remMins}m left`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30000);
    return () => clearInterval(interval);
  }, [room.expires_at]);

  return (
    <div className="md-card md-card--elevated room-card">
      <div className="room-card__header">
        <div>
          <h3 className="room-card__title">{room.name}</h3>
          <div className="room-card__meta" style={{ padding: 0, marginTop: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>person</span>
              {room.creator}
            </span>
          </div>
        </div>

        {timeLeft && (
          <div className={`countdown-badge ${isUrgent ? 'countdown-badge--urgent' : ''}`}>
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>timer</span>
            <span>{timeLeft}</span>
          </div>
        )}
      </div>

      {room.latestMessage && (
        <p className="room-card__preview truncate">
          {room.latestMessage}
        </p>
      )}

      <div className="room-card__footer">
        <button className="md-btn md-btn--filled" onClick={() => onJoin(room.id)}>
          <span className="material-symbols-rounded">login</span>
          <span>Join Room</span>
        </button>
      </div>
    </div>
  );
}
