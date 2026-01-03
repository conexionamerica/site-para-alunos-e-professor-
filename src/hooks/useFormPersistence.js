import { useEffect, useState } from 'react';

/**
 * Hook to persist form data in localStorage
 * @param {string} key - Unique key for the form
 * @param {any} initialValue - Initial state of the form
 * @returns {[any, Function, Function]} - current state, setter function, clear function
 */
export const useFormPersistence = (key, initialValue) => {
    const [formData, setFormData] = useState(() => {
        try {
            const saved = localStorage.getItem(`form_persist_${key}`);
            return saved ? JSON.parse(saved) : initialValue;
        } catch (e) {
            console.warn(`Error loading form persistence for ${key}:`, e);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(`form_persist_${key}`, JSON.stringify(formData));
        } catch (e) {
            console.warn(`Error saving form persistence for ${key}:`, e);
        }
    }, [key, formData]);

    const clearPersistence = () => {
        try {
            localStorage.removeItem(`form_persist_${key}`);
            setFormData(initialValue);
        } catch (e) {
            console.warn(`Error clearing form persistence for ${key}:`, e);
        }
    };

    return [formData, setFormData, clearPersistence];
};
