import React from 'react';
import { X, ScrollText } from 'lucide-react';
import { TermsAndPrivacy, LegalCompanyInfo } from './TermsAndPrivacy';

interface LegalModalProps {
  onClose: () => void;
  company?: LegalCompanyInfo;
}

export const LegalModal: React.FC<LegalModalProps> = ({ onClose, company }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-amber-800" />
            Termos de Uso e Política de Privacidade
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          <TermsAndPrivacy company={company} />
        </div>

        <div className="flex justify-end px-5 py-3.5 border-t">
          <button
            onClick={onClose}
            className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2 rounded-lg font-bold text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
