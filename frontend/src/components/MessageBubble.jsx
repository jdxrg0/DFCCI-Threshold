import React from 'react';
import { format } from 'date-fns';

const MessageBubble = ({ message, isCurrentUser }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className={`message-bubble ${isCurrentUser ? 'current' : 'other'}`}>
        <div className="message-time">
          {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
        </div>

        {message.isInitial ? (
          <div>
            <div className="message-section">
              <strong>Ipinag-aalala:</strong><br />
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.concern}</span>
            </div>
            <div className="message-section">
              <strong>Epekto:</strong><br />
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.impact}</span>
            </div>
            <div style={{ marginBottom: message.content.bibleVerse ? '0.4rem' : 0 }}>
              <strong>Inaasahang Pagbabago:</strong><br />
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.desiredChange}</span>
            </div>
            {message.content.bibleVerse && (
              <div className="message-bible-verse">
                "{message.content.bibleVerse}"
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="message-section">
              <strong>Paglilinaw:</strong><br />
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.clarification}</span>
            </div>
            {message.content.feelings && (
              <div className="message-section">
                <strong>Nararamdaman:</strong><br />
                <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.feelings}</span>
              </div>
            )}
            {message.content.acknowledgment && (
              <div className="message-section">
                <strong>Kinikilala:</strong><br />
                <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.acknowledgment}</span>
              </div>
            )}
            <div style={{ marginBottom: message.content.bibleVerse ? '0.4rem' : 0 }}>
              <strong>Inaasahang Pag-unawa:</strong><br />
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content.hopedUnderstanding}</span>
            </div>
            {message.content.bibleVerse && (
              <div className="message-bible-verse">
                "{message.content.bibleVerse}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
