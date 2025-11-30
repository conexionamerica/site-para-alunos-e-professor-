import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Bell, UserCog } from 'lucide-react';
import NotificationsWidget from '@/components/NotificationsWidget'; // Importação adicionada

const Header = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-auto py-3 sm:py-4">
          <div className="flex flex-col">
            <Link to="/" className="text-left">
              <div className="text-2xl sm:text-3xl font-bold">
                <span className="text-sky-600">Conexion</span>
                <span className="text-slate-800"> America</span>
              </div>
              <p className="text-xs text-slate-500 tracking-wider mt-0 sm:mt-1">
                A qualquer hora, Em qualquer lugar...
              </p>
            </Link>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <NotificationsWidget /> 
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:inline-flex">
                Sair
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="sm:hidden">
                 <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            location.pathname !== '/professor-login' && (
              <Link to="/professor-login">
                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                  <UserCog className="mr-2 h-4 w-4 hidden sm:inline-block" />
                  Professor
                </Button>
              </Link>
            )
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
