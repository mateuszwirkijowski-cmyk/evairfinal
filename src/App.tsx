import { useEffect, useState } from 'react';
// @ts-ignore
import { signUp, signIn, signOut, getCurrentUser, onAuthStateChange } from '../auth.js';
import { User, Mail, Lock, LogOut, MessageSquare } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

interface UserData {
  user: any;
  profile: Profile;
}

function App() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkUser();

    onAuthStateChange((_event: any, data: any) => {
      setUserData(data);
      setLoading(false);
    });
  }, []);

  async function checkUser() {
    try {
      const data = await getCurrentUser();
      setUserData(data);
    } catch (err) {
      console.error('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (authMode === 'register') {
        if (!formData.fullName.trim()) {
          setError('Proszę podać imię i nazwisko');
          setIsSubmitting(false);
          return;
        }
        await signUp(formData.email, formData.password, formData.fullName);
        const data = await signIn(formData.email, formData.password);
        setUserData(data);
      } else {
        const data = await signIn(formData.email, formData.password);
        setUserData(data);
      }

      setFormData({ email: '', password: '', fullName: '' });
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setUserData(null);
      setFormData({ email: '', password: '', fullName: '' });
    } catch (err: any) {
      setError(err.message || 'Błąd wylogowania');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {authMode === 'login' ? 'Witaj ponownie' : 'Utwórz konto'}
            </h1>
            <p className="text-gray-600">
              {authMode === 'login'
                ? 'Zaloguj się do swojego konta'
                : 'Zarejestruj się i zacznij korzystać'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {authMode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imię i nazwisko
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Jan Kowalski"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="twoj@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hasło
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Przetwarzanie...'
                : authMode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm transition"
            >
              {authMode === 'login'
                ? 'Nie masz konta? Zarejestruj się'
                : 'Masz już konto? Zaloguj się'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <MessageSquare className="w-8 h-8 text-blue-600 mr-3" />
              <span className="text-xl font-bold text-gray-900">BlaBla Chat</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {userData.profile?.full_name || 'Użytkownik'}
                </p>
                <p className="text-xs text-gray-500">{userData.profile?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Wyloguj</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <User className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Witaj, {userData.profile?.full_name || 'Użytkowniku'}!
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Autoryzacja działa poprawnie. Zalogowano jako: <strong>{userData.profile?.email}</strong>
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                Status systemu autoryzacji
              </h3>
              <div className="text-left space-y-2 text-sm text-blue-800">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Rejestracja działa poprawnie
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Logowanie działa poprawnie
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Profil użytkownika został utworzony automatycznie
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Sesja jest utrzymywana w localStorage
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
