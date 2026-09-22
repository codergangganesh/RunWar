import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  UserCredential,
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';

class FirebaseAuthService {
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  /**
   * Initializes the invisible RecaptchaVerifier on the specified container element.
   */
  public initRecaptcha(containerId: string = 'recaptcha-container'): RecaptchaVerifier {
    if (!auth) {
      throw new Error(
        'Firebase Authentication is not configured. Please add NEXT_PUBLIC_FIREBASE_* credentials to .env.local.'
      );
    }

    // Ensure container element exists in DOM
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }

    // Clean up previous instance if any
    this.clearRecaptcha();

    try {
      this.recaptchaVerifier = new RecaptchaVerifier(auth, container, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved - allow signInWithPhoneNumber
        },
        'expired-callback': () => {
          console.warn('[Firebase Auth] Recaptcha expired, resetting verifier.');
          this.clearRecaptcha();
        },
      });

      return this.recaptchaVerifier;
    } catch (err: any) {
      console.error('[Firebase Auth] Error initializing RecaptchaVerifier:', err);
      throw err;
    }
  }

  /**
   * Cleans up the recaptcha verifier widget.
   */
  public clearRecaptcha(): void {
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch (err) {
        // Suppress widget clear errors if already unmounted
      }
      this.recaptchaVerifier = null;
    }
  }

  /**
   * Sends an SMS OTP to the given E.164 phone number.
   */
  public async sendOtp(
    phoneNumber: string,
    containerId: string = 'recaptcha-container'
  ): Promise<ConfirmationResult> {
    if (!isFirebaseConfigured() || !auth) {
      throw new Error(
        'Firebase is not configured. Please supply NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local.'
      );
    }

    // Format and clean phone number
    const formattedPhone = phoneNumber.trim().replace(/[\s-]/g, '');
    if (!formattedPhone.startsWith('+') || formattedPhone.length < 9) {
      throw new Error('Please enter a valid international phone number starting with + and country code (e.g. +91 9876543210).');
    }

    const verifier = this.initRecaptcha(containerId);

    try {
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      return confirmationResult;
    } catch (error: any) {
      this.clearRecaptcha();
      const message = this.mapFirebaseError(error);
      throw new Error(message);
    }
  }

  /**
   * Verifies the 6-digit OTP using the confirmation result.
   */
  public async verifyOtp(
    confirmationResult: ConfirmationResult,
    otp: string
  ): Promise<UserCredential> {
    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      throw new Error('Please enter a valid 6-digit OTP code.');
    }

    try {
      const userCredential = await confirmationResult.confirm(cleanOtp);
      return userCredential;
    } catch (error: any) {
      const message = this.mapFirebaseError(error);
      throw new Error(message);
    }
  }

  /**
   * Retrieves the current logged-in Firebase user.
   */
  public getFirebaseUser(): FirebaseUser | null {
    return auth ? auth.currentUser : null;
  }

  /**
   * Retrieves the current user's ID token (JWT) to authenticate downstream InsForge API requests.
   */
  public async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    const user = this.getFirebaseUser();
    if (!user) return null;
    try {
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      console.error('[Firebase Auth] Failed to retrieve ID token:', error);
      return null;
    }
  }

  /**
   * Subscribes to Firebase Authentication state changes.
   */
  public onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Signs out the user from Firebase Authentication.
   */
  public async signOut(): Promise<void> {
    this.clearRecaptcha();
    if (auth) {
      await firebaseSignOut(auth);
    }
  }

  /**
   * Translates Firebase error codes into friendly user messages.
   */
  public mapFirebaseError(err: any): string {
    const rawCode = (err?.code || '').toLowerCase();
    const rawMessage = (err?.message || '').toLowerCase();

    // Extract auth code from message if code is empty (e.g. "Firebase: Error (auth/configuration-not-found)")
    const match = rawMessage.match(/auth\/[a-z0-9-]+/);
    const code = rawCode || (match ? match[0] : '');

    if (code.includes('billing-not-enabled')) {
      return 'Real SMS delivery requires a Firebase Blaze plan. For free development testing, add your number under Firebase Console > Authentication > Sign-in method > Phone > "Phone numbers for testing".';
    }
    if (code.includes('configuration-not-found') || code.includes('operation-not-allowed')) {
      return 'Phone authentication is not enabled in your Firebase project. In the Firebase Console, go to Authentication > Sign-in method, select "Phone", and click Enable.';
    }
    if (code.includes('unauthorized-domain') || code.includes('app-not-authorized')) {
      return 'This domain is not authorized for OAuth/Phone Auth. In Firebase Console, add "localhost" under Authentication > Settings > Authorized domains.';
    }
    if (code.includes('invalid-api-key') || code.includes('api-key-not-valid')) {
      return 'Invalid Firebase API Key. Please check NEXT_PUBLIC_FIREBASE_API_KEY in your .env.local file.';
    }
    if (code.includes('project-not-found')) {
      return 'Firebase Project not found. Please check NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local.';
    }
    if (code.includes('invalid-phone-number')) {
      return 'The phone number entered is invalid. Please check country code and format (e.g. +91 9876543210).';
    }
    if (code.includes('missing-phone-number')) {
      return 'Please enter your phone number to proceed.';
    }
    if (code.includes('quota-exceeded')) {
      return 'SMS quota exceeded for today. Add a test phone number in Firebase Console or try again later.';
    }
    if (code.includes('too-many-requests')) {
      return 'Too many attempts from this device. Please wait a few moments before trying again.';
    }
    if (code.includes('invalid-verification-code') || code.includes('invalid-app-credential')) {
      return 'The 6-digit verification code entered is incorrect. Please check and try again.';
    }
    if (code.includes('code-expired')) {
      return 'The verification code has expired. Please request a new OTP.';
    }
    if (code.includes('captcha-check-failed')) {
      return 'Security verification check failed. Please refresh the page and try again.';
    }
    if (code.includes('network-request-failed')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    if (code.includes('user-disabled')) {
      return 'This account has been disabled. Please contact support.';
    }

    return err?.message || 'An authentication error occurred. Please try again.';
  }
}

export const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;
