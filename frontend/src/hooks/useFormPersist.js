import { useState, useEffect, useCallback } from 'react';

/**
 * useFormPersist
 * Persists form state to localStorage under the given key.
 *
 * @param {string} storageKey  - Unique key for localStorage (e.g. 'form_send_mirror')
 * @param {object} initialValues - Default values for every field
 * @param {string[]} [excludeFields] - Field names to never persist (e.g. passwords)
 * @returns [values, setValues, clearSaved]
 */
const useFormPersist = (storageKey, initialValues, excludeFields = []) => {
  const [values, setValues] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with initialValues so any new fields are included
        return { ...initialValues, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return initialValues;
  });

  const excludeStr = excludeFields.join(',');

  // Persist to localStorage on every change, excluding sensitive fields
  useEffect(() => {
    try {
      const toPersist = Object.fromEntries(
        Object.entries(values).filter(([key]) => !excludeFields.includes(key))
      );
      localStorage.setItem(storageKey, JSON.stringify(toPersist));
    } catch {
      // Ignore storage errors (e.g. private browsing quota)
    }
  }, [storageKey, values, excludeFields, excludeStr]);

  /** Call this after a successful submission to wipe the saved draft */
  const clearSaved = useCallback(() => {
    localStorage.removeItem(storageKey);
    setValues(initialValues);
  }, [storageKey, initialValues]);

  return [values, setValues, clearSaved];
};

export default useFormPersist;
