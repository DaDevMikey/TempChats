import React, { useState, useEffect, memo } from 'react';

function RoomCard({ room, onJoin }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!room.expires_at) return undefined;

    let interval;

    const calculateTime = () => {
      const target = room.expires_at.toDate ? room.expires_at.toDate() : new Date(room.expires_at);
      const diffMs = target.getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('Expired');
        setIsUrgent(true);
        clearInterval(interval);
        return;
      }
      setIsUrgent(diffMs < 30 * 60000);
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      setTimeLeft(hours > 0 ? `${hours}h ${remMins}m left` : `${remMins}m left`);
    };

    calculateTime();
    interval = setInterval(calculateTime, 30000);
    return () => clearInterval(interval);
  }, [room.expires_at]);

  return (
    <article className="md-card md-card--elevated room-card">
      <div className="room-card__header">
        <div style={{ minWidth: 0 }}>
          <h3 className="room-card__title">{room.name}</h3>
          <div className="room-card__meta" style={{ padding: 0, marginTop: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }} aria-hidden="true">person</span>
              {room.creator}
            </span>
          </div>
        </div>

        {timeLeft && (
          <div className={`countdown-badge ${isUrgent ? 'countdown-badge--urgent' : ''}`}>
            <span className="material-symbols-rounded" aria-hidden="true">timer</span>
            <span>{timeLeft}</span>
          </div>
        )}
      </div>

      {room.latestMessage && (
        <p className="room-card__preview truncate">{room.latestMessage}</p>
      )}

      <div className="room-card__footer">
        <button className="md-btn md-btn--filled" onClick={() => onJoin(room.id)}>
          <span className="material-symbols-rounded" style={{ fontSize: '20px' }} aria-hidden="true">login</span>
          <span>Join room</span>
        </button>
      </div>
    </article>
  );
}

export default memo(RoomCard);
