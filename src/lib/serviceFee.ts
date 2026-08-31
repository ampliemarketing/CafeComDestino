import { CompanyProfileData, Comanda } from '../types';

// Taxa de serviço de uma comanda. Mesma regra do servidor (close_comanda_and_pay):
// aplica quando a empresa tem a taxa habilitada e a comanda não marcou
// serviceFeeApplied === false (garçom removeu). Base = subtotal de itens ativos.
export function comandaServiceFee(
  comanda: Pick<Comanda, 'subtotal' | 'serviceFeeApplied'>,
  profile: Pick<CompanyProfileData, 'serviceFeeEnabled' | 'serviceFeePercent'>
): number {
  if (!profile.serviceFeeEnabled) return 0;
  if (comanda.serviceFeeApplied === false) return 0;
  const pct = profile.serviceFeePercent || 0;
  return Math.round(comanda.subtotal * pct) / 100;
}

// Couvert de uma comanda (valor por pessoa × nº de couverts / convidados).
export function comandaCouvert(
  comanda: Pick<Comanda, 'couvertQty' | 'guestCount'>,
  profile: Pick<CompanyProfileData, 'couvertEnabled' | 'couvertValue'>
): number {
  if (!profile.couvertEnabled) return 0;
  const qty = comanda.couvertQty ?? comanda.guestCount ?? 0;
  return Math.round((profile.couvertValue || 0) * qty * 100) / 100;
}
