import React, { useState } from 'react';
import {
  X, KeyRound, Minus, Plus,
  LayoutDashboard, ShoppingBag, Smartphone, Grid2X2, ChefHat, Monitor,
  History, Receipt, Package, Boxes, Tags, Truck, FileText, Wallet,
  Printer, BarChart3, Building2, Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { PERMISSION_CATALOG, ROLE_DEFAULT_PERMISSIONS, ScreenPermissionGroup } from '../../lib/permissions';
import { MAXLEN, sanitizeText, maskPhone, maskCPF, isValidCPF, isValidPhone, isValidEmail } from '../../lib/validation';

const ROLES: UserRole[] = ['admin', 'gerente', 'caixa', 'garcom', 'cozinha', 'estoque', 'financeiro'];

const SCREEN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  'online-menu': ShoppingBag,
  waiter: Smartphone,
  tables: Grid2X2,
  kitchen: ChefHat,
  pdv: Monitor,
  caixas: History,
  sales: Receipt,
  products: Package,
  inventory: Boxes,
  groups: Tags,
  suppliers: Truck,
  deliveries: Truck,
  fiscal: FileText,
  finance: Wallet,
  printers: Printer,
  reports: BarChart3,
  company: Building2,
  users: Users,
};

interface UserFormModalProps {
  user?: User; // presente = modo edição
  onClose: () => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ user, onClose }) => {
  const { createUser, updateUserProfile, currentUser, addToast } = useApp();
  const isEdit = !!user;
  const isSelf = isEdit && user!.id === currentUser.id;

  const [activeTab, setActiveTab] = useState<'conta' | 'permissoes'>('conta');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState(user?.cpf ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'garcom');
  const [active, setActive] = useState(user?.active ?? true);
  const [code, setCode] = useState(user?.code ?? '');
  const [permissions, setPermissions] = useState<string[]>(user?.permissions ?? ROLE_DEFAULT_PERMISSIONS.garcom);
  const [saving, setSaving] = useState(false);

  const isAdminRole = role === 'admin';
  const allGroups = PERMISSION_CATALOG.flatMap((s) => s.groups);

  const togglePermission = (key: string) => {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const applyRoleDefaults = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(ROLE_DEFAULT_PERMISSIONS[newRole]);
  };

  const groupKeys = (group: ScreenPermissionGroup) => [group.access, ...group.actions.map((a) => a.key)];

  const isGroupFullyChecked = (group: ScreenPermissionGroup) => groupKeys(group).every((k) => permissions.includes(k));
  const isGroupPartiallyChecked = (group: ScreenPermissionGroup) => {
    const keys = groupKeys(group);
    const checkedCount = keys.filter((k) => permissions.includes(k)).length;
    return checkedCount > 0 && checkedCount < keys.length;
  };

  const toggleGroup = (group: ScreenPermissionGroup) => {
    const keys = groupKeys(group);
    const allChecked = isGroupFullyChecked(group);
    setPermissions((prev) =>
      allChecked ? prev.filter((p) => !keys.includes(p)) : Array.from(new Set([...prev, ...keys]))
    );
  };

  const toggleExpanded = (screenId: string) => {
    setExpanded((prev) => ({ ...prev, [screenId]: !prev[screenId] }));
  };

  const checkedGroupsCount = allGroups.filter((g) => permissions.includes(g.access)).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast('error', 'Nome obrigatório', 'Informe o nome do funcionário.');
      return;
    }
    if (!isEdit && !isValidEmail(email)) {
      addToast('error', 'E-mail inválido', 'Informe um e-mail válido.');
      return;
    }
    if (!isEdit && password.length < 6) {
      addToast('error', 'Senha muito curta', 'A senha provisória precisa de ao menos 6 caracteres.');
      return;
    }
    if (cpf.trim() && !isValidCPF(cpf)) {
      addToast('error', 'CPF inválido', 'Verifique os dígitos do CPF.');
      return;
    }
    if (isEdit && code.trim() && (code.trim().length < 4 || code.trim().length > 6)) {
      addToast('error', 'PIN inválido', 'O PIN deve ter de 4 a 6 dígitos.');
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      addToast('error', 'Telefone inválido', 'Use DDD + número (10 ou 11 dígitos).');
      return;
    }

    setSaving(true);

    if (isEdit) {
      await updateUserProfile(user!.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        cpf: cpf.trim() || undefined,
        code: code.trim() || undefined,
        ...(isSelf ? {} : { role, active, permissions }),
      });
      setSaving(false);
      onClose();
      return;
    }

    const { error } = await createUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      phone: phone.trim() || undefined,
      cpf: cpf.trim() || undefined,
      permissions,
    });
    setSaving(false);
    if (error) {
      addToast('error', 'Erro ao criar usuário', error);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-stone-900 text-sm">{isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
            <p className="text-[11px] text-stone-400">Usuário: <span className="font-semibold text-stone-600">{isEdit ? user!.name : '(novo)'}</span></p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-4 px-5 border-b text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('conta')}
            className={`py-2.5 border-b-2 transition ${activeTab === 'conta' ? 'border-amber-800 text-amber-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            Conta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('permissoes')}
            className={`py-2.5 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'permissoes' ? 'border-amber-800 text-amber-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
          >
            Permissões
            {!isAdminRole && (
              <span className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full font-bold">
                {checkedGroupsCount}/{allGroups.length}
              </span>
            )}
          </button>
        </div>

        <form id="user-form-modal" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 text-xs">
          {activeTab === 'conta' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase">Nome</label>
                <input
                  type="text"
                  required
                  maxLength={MAXLEN.name}
                  value={name}
                  onChange={(e) => setName(sanitizeText(e.target.value, MAXLEN.name))}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase">Email</label>
                <input
                  type="email"
                  required
                  maxLength={MAXLEN.email}
                  disabled={isEdit}
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, MAXLEN.email))}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs disabled:bg-stone-100 disabled:text-stone-500"
                />
              </div>
              {!isEdit && (
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase">Senha Provisória</label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.slice(0, 72))}
                    placeholder="mín. 6 caracteres"
                    className="w-full border rounded-lg px-2 py-1.5 text-xs"
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase">CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full border rounded-lg px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase">Telefone</label>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={MAXLEN.phone}
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase">Cargo</label>
                <select
                  value={role}
                  disabled={isSelf}
                  onChange={(e) => applyRoleDefaults(e.target.value as UserRole)}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs uppercase font-bold disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {isEdit && (
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={isSelf}
                    onClick={() => setActive((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                      active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-stone-200 text-stone-600 border-stone-300'
                    }`}
                  >
                    {active ? 'Usuário Ativo' : 'Usuário Inativo'}
                  </button>
                </div>
              )}
              {isEdit && (
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> PIN de Fechamento de Caixa
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Digite para definir/alterar"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono tracking-widest"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">4 a 6 dígitos. Por segurança o PIN atual não é exibido — deixe em branco para mantê-lo. Só administradores podem alterar PIN.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'permissoes' && (
            <div className="space-y-3">
              <p className="text-stone-500">Selecione as telas e ações que este funcionário terá acesso.</p>

              {isAdminRole ? (
                <p className="text-[11px] text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Admin tem acesso total ao sistema automaticamente.
                </p>
              ) : isSelf ? (
                <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                  Você não pode alterar suas próprias permissões.
                </p>
              ) : (
                <div className="border rounded-xl divide-y overflow-hidden">
                  {allGroups.map((group) => {
                    const Icon = SCREEN_ICONS[group.screenId] ?? Package;
                    const isOpen = !!expanded[group.screenId];
                    const fullyChecked = isGroupFullyChecked(group);
                    const partiallyChecked = isGroupPartiallyChecked(group);

                    return (
                      <div key={group.screenId} className="bg-white">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(group.screenId)}
                            className="w-5 h-5 shrink-0 flex items-center justify-center rounded bg-stone-100 hover:bg-stone-200 text-stone-600"
                          >
                            {isOpen ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          </button>
                          <input
                            type="checkbox"
                            checked={fullyChecked}
                            ref={(el) => { if (el) el.indeterminate = partiallyChecked; }}
                            onChange={() => toggleGroup(group)}
                          />
                          <Icon className="w-4 h-4 text-stone-500" />
                          <span className="font-bold text-stone-800 text-xs flex-1">{group.screenLabel}</span>
                          {group.actions.length > 0 && (
                            <span className="text-[9px] text-stone-400">{group.actions.length} ações</span>
                          )}
                        </div>

                        {isOpen && group.actions.length > 0 && (
                          <div className="px-3 pb-2.5 pl-10 space-y-1.5 bg-stone-50/60">
                            {group.actions.map((action) => (
                              <label key={action.key} className="flex items-center gap-1.5 text-stone-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={permissions.includes(action.key)}
                                  onChange={() => togglePermission(action.key)}
                                />
                                {action.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-bold text-xs text-stone-600 hover:bg-stone-100">
            Cancelar
          </button>
          <button
            type="submit"
            form="user-form-modal"
            disabled={saving}
            className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-60"
          >
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
          </button>
        </div>
      </div>
    </div>
  );
};
