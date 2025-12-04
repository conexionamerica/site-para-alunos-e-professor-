import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Bell, UserCog } from 'lucide-react';
import NotificationsWidget from '@/components/NotificationsWidget';

const Header = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-baseline gap-1 hover:opacity-80 transition-opacity">
              <span className="text-2xl sm:text-3xl font-bold text-sky-500">Conexión</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-800">América</span>
            </Link>
            <p className="hidden md:block ml-4 text-xs text-slate-500 tracking-wide">
              Portal do Aluno
            </p>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <NotificationsWidget />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="hidden sm:inline-flex hover:bg-slate-100"
              >
                Sair
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="sm:hidden hover:bg-slate-100"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            location.pathname !== '/professor-login' && (
              <Link to="/professor-login">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm border-sky-500 text-sky-600 hover:bg-sky-50"
                >
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
