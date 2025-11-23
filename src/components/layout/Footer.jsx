import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-slate-500">
        <p>&copy; {currentYear} Conexión América. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;