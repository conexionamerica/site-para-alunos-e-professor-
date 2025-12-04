import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <div className="text-xl font-bold mb-1">
              <span className="text-sky-500">Conexión</span>
              <span className="text-slate-800"> América</span>
            </div>
            <p className="text-sm text-slate-500">
              Aprenda espanhol do jeito certo
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex gap-4 text-sm">
              <a
                href="https://www.conexionamerica.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-sky-500 transition-colors"
              >
                Site Principal
              </a>
              <span className="text-slate-300">|</span>
              <a
                href="https://wa.me/555198541835"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-sky-500 transition-colors"
              >
                Suporte
              </a>
            </div>
            <p className="text-xs text-slate-500">
              © {currentYear} Conexión América. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;