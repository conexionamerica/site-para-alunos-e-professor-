import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Bell, UserCog } from 'lucide-react';

const Header = () => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const hasNotifications = true; // Placeholder for notification logic

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-auto py-4">
          <div className="flex flex-col">
            <Link to="/" className="text-left mb-4">
              <div className="text-3xl font-bold">
                <span className="text-sky-600">Conexion</span>
                <span className="text-slate-800"> America</span>
              </div>
              <p className="text-xs text-slate-500 tracking-wider mt-1">
                A qualquer hora, Em qualquer lugar...
              </p>
            </Link>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className={`h-6 w-6 ${hasNotifications ? 'text-sky-600' : 'text-slate-500'}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sair
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            location.pathname !== '/professor-login' && (
              <Link to="/professor-login">
                <Button variant="outline">
                  <UserCog className="mr-2 h-4 w-4" />
                  Sou Professor
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