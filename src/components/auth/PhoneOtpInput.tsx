import React, { useRef, useEffect } from 'react';

interface PhoneOtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  length?: number;
  disabled?: boolean;
  onComplete?: (otp: string) => void;
  autoFocus?: boolean;
}

export const PhoneOtpInput: React.FC<PhoneOtpInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  onComplete,
  autoFocus = true,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Split value into array of length
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleDigitChange = (index: number, char: string) => {
    const numericChar = char.replace(/\D/g, '');
    if (!numericChar) {
      // Empty / cleared
      const newDigits = [...digits];
      newDigits[index] = '';
      const newOtp = newDigits.join('');
      onChange(newOtp);
      return;
    }

    // Single digit input
    const singleDigit = numericChar.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    const newOtp = newDigits.join('');
    onChange(newOtp);

    // Auto-advance to next box if available
    if (index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger onComplete if full length entered
    if (newOtp.length === length && onComplete) {
      onComplete(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Current is empty, backspace into previous box
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (!pastedData) return;

    onChange(pastedData);

    // Focus last filled box or next empty box
    const targetIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[targetIndex]?.focus();

    if (pastedData.length === length && onComplete) {
      onComplete(pastedData);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 w-full my-3">
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete="one-time-code"
            disabled={disabled}
            value={digits[index]}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-display font-black rounded-2xl border-2 transition-all outline-none select-none ${
              disabled
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : isFilled
                ? 'bg-emerald-50/50 dark:bg-[#0d2a24] text-slate-950 dark:text-white border-[#00d09c] shadow-sm shadow-[#00d09c]/20'
                : 'bg-slate-50 dark:bg-[#0c1425] text-slate-950 dark:text-white border-slate-200 dark:border-[#1e2d4a] focus:border-[#00d09c] focus:ring-4 focus:ring-[#00d09c]/10'
            }`}
          />
        );
      })}
    </div>
  );
};
