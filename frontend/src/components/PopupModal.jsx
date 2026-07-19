import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const PopupModal = ({ isOpen, onClose, title, message, onConfirm, confirmText, cancelText, isAlert, isPrompt, promptValue, onPromptChange }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="fun-card" style={{
        backgroundColor: 'var(--surface)',
        width: '100%', maxWidth: '400px',
        padding: '1.5rem',
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: '1rem',
        animation: 'scaleIn 0.2s ease-out',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}>
          <X size={20} />
        </button>
        
        {title && <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem', paddingRight: '1.5rem', fontWeight: 'bold' }}>{title}</h3>}
        
        <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: '1.5' }}>{message}</p>
        
        {isPrompt && (
          <input 
            type="text" 
            value={promptValue} 
            onChange={(e) => onPromptChange && onPromptChange(e.target.value)} 
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (onConfirm) onConfirm(promptValue); 
                onClose();
              }
            }}
          />
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          {!isAlert && (
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: '600' }}>
              {cancelText || 'Cancel'}
            </button>
          )}
          <button onClick={() => { if (onConfirm) onConfirm(isPrompt ? promptValue : undefined); onClose(); }} className="btn btn-primary" style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
            {confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PopupModal;
