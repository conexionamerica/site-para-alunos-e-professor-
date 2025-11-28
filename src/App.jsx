import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import UpdatePasswordPage from '@/pages/UpdatePasswordPage';
import ProfessorLoginPage from '@/pages/ProfessorLoginPage';
import ProfessorDashboardPage from '@/pages/ProfessorDashboardPage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { AnimatePresence } from 'framer-motion';
import ChatWidget from '@/components/ChatWidget';
import PostRegistrationForm from '@/components/PostRegistrationForm';
// IMPORTAÇÕES ADICIONADAS PARA O CARTEL DE BLOQUEIO
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; 
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

// NOVO COMPONENTE: Tela de Acesso Bloqueado
const SuspendedScreen = () => (
  <div className="flex items-center justify-center min-h-[80vh]">
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg border-l-4 border-red-500">
      <Alert variant="destructive">
        <AlertTitle className="text-xl font-bold">Acesso Bloqueado</AlertTitle>
        <AlertDescription className="mt-2 text-slate-700">
          Sua conta foi marcada como **inativa**. Para reativá-la e continuar suas aulas, por favor, entre em contato com o suporte da escola.
        </AlertDescription>
      </Alert>
      
      {/* Botão WhatsApp para o Suporte */}
      <a href="https://wa.me/555198541835" target="_blank" rel="noopener noreferrer">
        <Button className="w-full bg-green-500 hover:bg-green-600 text-white shadow-lg">
          <MessageSquare className="mr-2 h-5 w-5" />
          Falar com o Suporte (WhatsApp)
        </Button>
      </a>
    </div>
  </div>
);


const HelpWidget = () => (
  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
    <a href="https://wa.me/555198541835" target="_blank" rel="noopener noreferrer">
      <Button size="icon" className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 shadow-lg">
        <MessageSquare className="h-6 w-6" />
      </Button>
    </a>
  </motion.div>
);

function App() {
  const { user, loading, professorSession, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F8FF]">
        <div className="text-xl font-semibold text-slate-700">Carregando...</div>
      </div>
    );
  }
  
  const showHeaderFooter = !['/professor-login', '/professor-dashboard'].includes(location.pathname);
  const needsPostRegistration = user && profile && !profile.age;
  const isStudent = user && profile?.role === 'student';
  
  // *** NOVA LÓGICA DE BLOQUEIO: Se for aluno E o campo is_active for explicitamente false ***
  const isProfileInactive = isStudent && profile && profile.is_active === false; 
  // ******************************

  // Se o perfil do aluno estiver inativo, renderiza a tela de suspensão e impede o acesso a rotas
  if (isProfileInactive) {
      return (
          <div className="flex flex-col min-h-screen bg-[#F0F8FF]">
              {/* O Header/Footer aparecem se não estivermos nas rotas de login/dashboard do professor */}
              {showHeaderFooter && <Header />}
              <main className="flex-grow container mx-auto px-4 py-8">
                  <SuspendedScreen /> 
              </main>
              {showHeaderFooter && <Footer />}
          </div>
      );
  }


  return (
    <div className="flex flex-col min-h-screen bg-[#F0F8FF]">
      <Helmet>
        <title>Conexión América</title>
        <meta name="description" content="Portal de Conexión América." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </Helmet>
      
      {showHeaderFooter && <Header />}

      {needsPostRegistration && <PostRegistrationForm />}
      
      <main className={`flex-grow ${showHeaderFooter ? 'container mx-auto px-4 py-8' : ''} ${needsPostRegistration ? 'blur-sm pointer-events-none' : ''}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={user ? <HomePage /> : <Navigate to="/login" />} />
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" />} />
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            <Route path="/professor-login" element={!professorSession ? <ProfessorLoginPage /> : <Navigate to="/professor-dashboard" />} />
            <Route path="/professor-dashboard" element={professorSession ? <ProfessorDashboardPage /> : <Navigate to="/professor-login" />} />
          </Routes>
        </AnimatePresence>
      </main>
      
      {isStudent && !needsPostRegistration && (
        <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
          {/* <HelpWidget /> This was a duplicate, HomePage already renders one */}
          <ChatWidget />
        </div>
      )}
      {showHeaderFooter && !needsPostRegistration && <Footer />}
    </div>
  );
}

export default App;
