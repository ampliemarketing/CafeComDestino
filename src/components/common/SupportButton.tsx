import React from 'react';
import { MessageCircle } from 'lucide-react';

const SUPPORT_WHATSAPP_NUMBER = '5564992792438';
const SUPPORT_MESSAGE = 'Olá! Preciso de suporte com o sistema Café Com Destino.';

export const SupportButton: React.FC = () => {
  const href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Falar com o suporte no WhatsApp"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition hover:scale-105"
    >
      <MessageCircle className="w-6 h-6" fill="currentColor" strokeWidth={0} />
      <span className="sr-only">Suporte via WhatsApp</span>
    </a>
  );
};
