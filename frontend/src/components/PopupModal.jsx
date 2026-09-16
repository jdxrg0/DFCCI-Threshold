import { useEffect } from 'react';
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
    <div className="popup-modal-backdrop">
      <div
        className="popup-modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
      >
        <button className="popup-modal__close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {title && <h3 className="popup-modal__title">{title}</h3>}

        {message && <p className="popup-modal__body">{message}</p>}

        {isPrompt && (
          <input
            type="text"
            className="popup-modal__field"
            value={promptValue}
            onChange={(e) => onPromptChange && onPromptChange(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (onConfirm) onConfirm(promptValue);
                onClose();
              }
            }}
          />
        )}

        <div className="popup-modal__actions">
          {!isAlert && (
            <button onClick={onClose} className="btn btn-secondary">
              {cancelText || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm(isPrompt ? promptValue : undefined);
              onClose();
            }}
            className="btn btn-primary"
          >
            {confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PopupModal;