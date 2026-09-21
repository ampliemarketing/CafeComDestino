import React from 'react';
import type { FiscalData } from '../../types';
import { toBoundedNumber, maskNCM, onlyDigits } from '../../lib/validation';
import {
  ORIGEM_OPTIONS,
  CSOSN_OPTIONS,
  CST_ICMS_OPTIONS,
  CST_PIS_COFINS_OPTIONS,
  CFOP_SAIDA_SUGESTOES,
  fiscalFieldErrors,
} from '../../lib/fiscal';

interface Props {
  value: FiscalData;
  onChange: (next: FiscalData) => void;
  disabled?: boolean;
  /** Quando true, destaca em vermelho os campos obrigatórios ainda inválidos. */
  showErrors?: boolean;
}

const labelCls = 'block mb-1 font-medium text-stone-700';
const baseInput =
  'w-full border rounded-lg px-3 py-2 disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-[11px] font-bold uppercase tracking-wide text-stone-500 border-b border-stone-200 pb-1">
      {title}
    </h4>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">{children}</div>
  </div>
);

/**
 * Formulário de dados fiscais do item — só os campos realmente usados na
 * emissão da NFC-e (NCM, CFOP, CEST, origem, CST/CSOSN, PIS/COFINS, cBenef).
 * Alíquota de ICMS/FCP e o grupo de IPI foram removidos: ICMS no Simples
 * Nacional vem embutido no DAS (CSOSN cuida disso sozinho) e IPI só se aplica
 * a indústria/importador, não a revenda de bar/café.
 * Reaproveitado na aba Fiscal do produto e no editor de Grupos Tributários.
 * `disabled` deixa tudo somente-leitura.
 */
export const FiscalFieldsForm: React.FC<Props> = ({ value, onChange, disabled, showErrors }) => {
  const set = (patch: Partial<FiscalData>) => onChange({ ...value, ...patch });
  const pct = (v: string) => toBoundedNumber(v, 0, 100);
  const errs = showErrors ? fiscalFieldErrors(value) : {};
  const ring = (bad?: boolean) => (bad ? ' border-rose-400 ring-2 ring-rose-200' : '');
  const inp = (bad?: boolean) => baseInput + ring(bad);

  return (
    <fieldset disabled={disabled} className="space-y-6 text-xs">
      <Section title="Classificação fiscal">
        <div className="col-span-2 lg:col-span-3">
          <label className={labelCls}>Origem da mercadoria *</label>
          <select value={value.origem} onChange={(e) => set({ origem: e.target.value })} className={inp(errs.origem)}>
            {ORIGEM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>NCM *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000.00.00"
            value={value.ncm}
            onChange={(e) => set({ ncm: maskNCM(e.target.value) })}
            className={inp(errs.ncm) + ' font-mono'}
          />
        </div>

        <div>
          <label className={labelCls}>CEST</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000000"
            maxLength={7}
            value={value.cest || ''}
            onChange={(e) => set({ cest: onlyDigits(e.target.value).slice(0, 7) })}
            className={inp(errs.cest) + ' font-mono'}
          />
        </div>

        <div>
          <label className={labelCls}>CFOP *</label>
          <input
            type="text"
            inputMode="numeric"
            list="cfop-sugestoes"
            placeholder="5102"
            maxLength={4}
            value={value.cfop}
            onChange={(e) => set({ cfop: onlyDigits(e.target.value).slice(0, 4) })}
            className={inp(errs.cfop) + ' font-mono'}
          />
          <datalist id="cfop-sugestoes">
            {CFOP_SAIDA_SUGESTOES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </datalist>
        </div>

        <div>
          <label className={labelCls}>GTIN / Código de barras</label>
          <input
            type="text"
            maxLength={14}
            value={value.gtin || ''}
            onChange={(e) => set({ gtin: e.target.value.replace(/\s/g, '').slice(0, 14) })}
            className={inp() + ' font-mono'}
          />
        </div>

        <div>
          <label className={labelCls}>Unidade tributável</label>
          <input
            type="text"
            maxLength={6}
            value={value.unidadeTributavel || ''}
            onChange={(e) => set({ unidadeTributavel: e.target.value.toUpperCase().slice(0, 6) })}
            className={inp() + ' font-mono'}
          />
        </div>
      </Section>

      <Section title="ICMS">
        <div className="col-span-2 lg:col-span-3">
          <label className={labelCls}>CST / CSOSN de ICMS *</label>
          <select value={value.cstCsosn} onChange={(e) => set({ cstCsosn: e.target.value })} className={inp(errs.cstCsosn)}>
            <optgroup label="CSOSN — Simples Nacional">
              {CSOSN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
            <optgroup label="CST — Regime Normal (Lucro Presumido / Real)">
              {CST_ICMS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={!!value.temSt}
              onChange={(e) => set({ temSt: e.target.checked })}
              className="rounded text-amber-800 w-4 h-4"
            />
            <span>Substituição Tributária (ST)</span>
          </label>
        </div>
      </Section>

      <Section title="PIS / COFINS">
        <div className="lg:col-span-2">
          <label className={labelCls}>CST de PIS *</label>
          <select value={value.cstPis} onChange={(e) => set({ cstPis: e.target.value })} className={inp(errs.cstPis)}>
            {CST_PIS_COFINS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Alíquota de PIS (%) *</label>
          <input
            type="number" step="0.0001" min="0" max="100"
            value={value.aliqPis ?? 0}
            onChange={(e) => set({ aliqPis: pct(e.target.value) })}
            className={inp(errs.aliqPis)}
          />
        </div>
        <div className="lg:col-span-2">
          <label className={labelCls}>CST de COFINS *</label>
          <select value={value.cstCofins} onChange={(e) => set({ cstCofins: e.target.value })} className={inp(errs.cstCofins)}>
            {CST_PIS_COFINS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Alíquota de COFINS (%) *</label>
          <input
            type="number" step="0.0001" min="0" max="100"
            value={value.aliqCofins ?? 0}
            onChange={(e) => set({ aliqCofins: pct(e.target.value) })}
            className={inp(errs.aliqCofins)}
          />
        </div>
      </Section>

      <Section title="Outras informações">
        <div>
          <label className={labelCls}>Código de benefício fiscal (cBenef)</label>
          <input
            type="text" maxLength={10}
            value={value.cBenef || ''}
            onChange={(e) => set({ cBenef: e.target.value.replace(/\s/g, '').slice(0, 10) })}
            className={inp() + ' font-mono'}
          />
        </div>
        <div className="col-span-2 lg:col-span-3">
          <label className={labelCls}>Informação adicional do item</label>
          <textarea
            rows={2} maxLength={300}
            value={value.infAdicional || ''}
            onChange={(e) => set({ infAdicional: e.target.value.slice(0, 300) })}
            className={inp()}
          />
        </div>
      </Section>
    </fieldset>
  );
};
