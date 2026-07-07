import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Login } from './Login'; // <--- 1. Agrega esta importación

export const AuthGuard = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-gray-400 font-bold tracking-widest uppercase text-sm animate-pulse">
          Cargando Sistema...
        </h2>
      </div>
    );
  }

  // 2. Reemplazamos el mensaje de error estático por tu nuevo componente de Login
  if (!user) {
    return <Login />;
  }

  return children;
};