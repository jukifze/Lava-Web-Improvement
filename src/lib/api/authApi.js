import { signInWithEmailAndPassword, signOut, onIdTokenChanged, getIdTokenResult } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';

const LOCAL_AUTH_KEY = 'lavestreat_auth_user';
const isDemo = !isFirebaseConfigured && import.meta.env.DEV;
async function profile(user) {
  const token = await getIdTokenResult(user);
  return token.claims.role === 'admin' ? { uid: user.uid, email: user.email, role: 'admin' } : null;
}

export const authApi = {
  async login(email, password) {
    if (isFirebaseConfigured) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = await profile(credential.user);
        if (!user) { await signOut(auth); throw new Error('Akun ini tidak memiliki izin admin.'); }
        return user;
      } catch (error) {
        if (error.code?.startsWith('auth/')) throw new Error('Login gagal. Periksa akun admin dan koneksi Anda.');
        throw error;
      }
    }
    if (isDemo && email === 'admin@lavestreat.com' && password === 'admin123') {
      const user = { uid: 'admin-local-1', email, role: 'admin', displayName: 'Admin Demo' };
      localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user)); return user;
    }
    throw new Error(isDemo ? 'Email atau password tidak sesuai.' : 'Login admin belum dikonfigurasi.');
  },
  async logout() {
    if (isFirebaseConfigured) await signOut(auth);
    localStorage.removeItem(LOCAL_AUTH_KEY);
  },
  getCurrentUser() {
    if (!isDemo) return null;
    try { return JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY)); } catch { return null; }
  },
  onAuthStateChange(callback) {
    if (isFirebaseConfigured) return onIdTokenChanged(auth, async user => {
      if (!user) { callback(null); return; }
      try { const result = await profile(user); if (auth.currentUser?.uid === user.uid) callback(result); }
      catch { callback(null); }
    });
    callback(this.getCurrentUser()); return () => {};
  },
};
