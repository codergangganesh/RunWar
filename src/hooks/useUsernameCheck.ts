import { useState, useEffect } from 'react';
import { challengeService } from '../services/challengeService';

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged';

export function useUsernameCheck(initialUsername: string = '', currentUserId: string = '') {
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (initialUsername) {
      const cleanInit = initialUsername.replace(/^@/, '').toLowerCase().trim();
      if (!usernameInput) {
        setUsernameInput(cleanInit);
      }
    }
  }, [initialUsername]);

  useEffect(() => {
    const clean = usernameInput.replace(/^@/, '').toLowerCase().trim();

    if (!clean) {
      setStatus('idle');
      setMessage('');
      setSuggestions([]);
      return;
    }

    const currentClean = (initialUsername || '').replace(/^@/, '').toLowerCase().trim();
    if (currentClean && clean === currentClean) {
      setStatus('unchanged');
      setMessage('Current username');
      setSuggestions([]);
      return;
    }

    setStatus('checking');
    setMessage('Checking availability...');

    const timer = setTimeout(async () => {
      const res = await challengeService.checkUsernameAvailable(clean, currentUserId);
      if (res.available) {
        setStatus('available');
        setMessage('Available ✓');
        setSuggestions([]);
      } else {
        setStatus(res.reason === 'Username already taken' ? 'taken' : 'invalid');
        setMessage(res.reason || 'Username already taken');
        setSuggestions(res.suggestions || []);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [usernameInput, initialUsername, currentUserId]);

  return {
    usernameInput,
    setUsernameInput,
    status,
    message,
    suggestions,
    isAvailable: status === 'available' || status === 'unchanged',
    isChecking: status === 'checking',
    isTaken: status === 'taken',
    isInvalid: status === 'invalid',
  };
}
