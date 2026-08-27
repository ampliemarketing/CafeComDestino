import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Supplier } from '../../types';
import { Truck, Plus, Edit2, Trash2, X, Search, Phone, Mail, User as UserIcon, AlertTriangle } from 'lucide-react';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, maskPhone, maskCpfCnpj, isValidCpfCnpj, isValidPhone, isValidEmail } from '../../lib/validation';

const EMPTY_FORM = {
  name: '',
  tradeName: '',
  cnpjCpf: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  suppliedCategories: [] as string[],
  active: true,
};

export const SupplierManagement: React.FC = () => {
  const { suppliers, ingredientCategories, saveSupplier, deleteSupplier, addToast, currentUser } = useApp();
  const can = (key: string) => hasPermission(currentUser, key);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  const query = searchQuery.trim().toLowerCase();
  const filteredSuppliers = suppliers
    .filter((s) => {
      if (statusFilter === 'ativos') return s.active;
      if (statusFilter === 'inativos') return !s.active;
      return true;
    })
    .filter((s) => {
      if (!query) return true;
      return (
        s.name.toLowerCase().includes(query) ||
        s.tradeName.toLowerCase().includes(query) ||
        s.cnpjCpf.toLowerCase().includes(query) ||
        s.contactPerson.toLowerCase().includes(query)
      );
    });

  const activeCount = suppliers.filter((s) => s.active).length;
  const inactiveCount = suppliers.length - activeCount;

  const categoryName = (id: string) => ingredientCategories.find((c) => c.id === id)?.name || id;

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      tradeName: supplier.tradeName,
      cnpjCpf: supplier.cnpjCpf,
      phone: supplier.phone,
      email: supplier.email,
      contactPerson: supplier.contactPerson,
      notes: supplier.notes || '',
      suppliedCategories: supplier.suppliedCategories,
      active: supplier.active,
    });
    setIsModalOpen(true);
  };

  const toggleCategory = (categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      suppliedCategories: prev.suppliedCategories.includes(categoryId)
        ? prev.suppliedCategories.filter((c) => c !== categoryId)
        : [...prev.suppliedCategories, categoryId],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      addToast('error', 'Nome obrigatório', 'Informe a razão social do fornecedor.');
      return;
    }
    if (form.cnpjCpf.trim() && !isValidCpfCnpj(form.cnpjCpf)) {
      addToast('error', 'CNPJ/CPF inválido', 'Verifique os dígitos informados.');
      return;
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      addToast('error', 'Telefone inválido', 'Use DDD + número (10 ou 11 dígitos).');
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      addToast('error', 'E-mail inválido', 'Verifique o endereço de e-mail.');
      return;
    }

    const supplier: Supplier = {
      id: editingId || 'sup-' + Date.now(),
      name: form.name.trim(),
      tradeName: form.tradeName.trim(),
      cnpjCpf: form.cnpjCpf.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      contactPerson: form.contactPerson.trim(),
      notes: form.notes.trim() || undefined,
      suppliedCategories: form.suppliedCategories,
      active: form.active,
    };

    saveSupplier(supplier);
    setIsModalOpen(false);
  };

  const handleToggleActive = (supplier: Supplier) => {
    saveSupplier({ ...supplier, active: !supplier.active });
  };

  const handleDelete = (supplier: Supplier) => {
    setDeletingSupplier(supplier);
  };

  const confirmDelete = () => {
    if (deletingSupplier) deleteSupplier(deletingSupplier.id);
    setDeletingSupplier(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 min-h-screen">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Fornecedores</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Cadastro de fornecedores de insumos e produtos ({suppliers.length}).
            </p>
          </div>
        </div>

        {can('fornecedores.criar') && (
        <button
          onClick={handleOpenCreate}
          className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Fornecedor</span>
        </button>
        )}
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            maxLength={60}
            placeholder="Buscar por nome, nome fantasia, CNPJ/CPF ou contato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
            className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs bg-white"
          />
        </div>

        <div className="flex gap-1.5 bg-stone-100 p-1.5 rounded-xl border border-stone-200 text-xs font-bold">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'todos' ? 'bg-stone-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Todos ({suppliers.length})
          </button>
          <button
            onClick={() => setStatusFilter('ativos')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'ativos' ? 'bg-emerald-700 text-white shadow' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Ativos ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('inativos')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'inativos' ? 'bg-stone-500 text-white shadow' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Inativos ({inactiveCount})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0 z-10">
              <tr>
                <th className="p-3.5">Fornecedor</th>
                <th className="p-3.5">CNPJ/CPF</th>
                <th className="p-3.5">Contato</th>
                <th className="p-3.5">Categorias Fornecidas</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-400 italic">
                    {suppliers.length === 0
                      ? 'Nenhum fornecedor cadastrado até o momento.'
                      : 'Nenhum fornecedor encontrado com esse filtro/termo de busca.'}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-stone-50 transition align-top">
                    <td className="p-3.5">
                      <p className="font-bold text-stone-900">{supplier.name}</p>
                      {supplier.tradeName && <p className="text-stone-500 text-[11px]">{supplier.tradeName}</p>}
                    </td>
                    <td className="p-3.5 text-stone-600 font-mono">{supplier.cnpjCpf || '—'}</td>
                    <td className="p-3.5 text-stone-600 space-y-0.5">
                      {supplier.contactPerson && (
                        <div className="flex items-center gap-1.5"><UserIcon className="w-3 h-3 text-stone-400" /> {supplier.contactPerson}</div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-stone-400" /> {supplier.phone}</div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-stone-400" /> {supplier.email}</div>
                      )}
                      {!supplier.contactPerson && !supplier.phone && !supplier.email && '—'}
                    </td>
                    <td className="p-3.5">
                      {supplier.suppliedCategories.length === 0 ? (
                        <span className="text-stone-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {supplier.suppliedCategories.map((catId) => (
                            <span key={catId} className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200">
                              {categoryName(catId)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleActive(supplier)}
                        disabled={!can('fornecedores.ativar_inativar')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 disabled:cursor-not-allowed ${
                          supplier.active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-stone-200 text-stone-600 border-stone-300'
                        }`}
                      >
                        {supplier.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {can('fornecedores.editar') && (
                        <button
                          onClick={() => handleOpenEdit(supplier)}
                          title="Editar fornecedor"
                          className="p-1.5 text-stone-600 hover:text-stone-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        )}
                        {can('fornecedores.excluir') && (
                        <button
                          onClick={() => handleDelete(supplier)}
                          title="Excluir fornecedor"
                          className="p-1.5 text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create/Edit Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">
                {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-semibold text-stone-700 block mb-1">Razão Social *</label>
                <input
                  type="text"
                  autoFocus
                  maxLength={MAXLEN.tradeName}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: sanitizeText(e.target.value, MAXLEN.tradeName) })}
                  className="w-full border rounded-xl p-2.5"
                  placeholder="Ex: Distribuidora Hortifruti Ltda"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-semibold text-stone-700 block mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  maxLength={MAXLEN.tradeName}
                  value={form.tradeName}
                  onChange={(e) => setForm({ ...form, tradeName: sanitizeText(e.target.value, MAXLEN.tradeName) })}
                  className="w-full border rounded-xl p-2.5"
                  placeholder="Ex: Hortifruti Bom Preço"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">CNPJ/CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={MAXLEN.cpfCnpj}
                  value={form.cnpjCpf}
                  onChange={(e) => setForm({ ...form, cnpjCpf: maskCpfCnpj(e.target.value) })}
                  className="w-full border rounded-xl p-2.5 font-mono"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Pessoa de Contato</label>
                <input
                  type="text"
                  maxLength={MAXLEN.personName}
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: sanitizeText(e.target.value, MAXLEN.personName) })}
                  className="w-full border rounded-xl p-2.5"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Telefone</label>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={MAXLEN.phone}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                  className="w-full border rounded-xl p-2.5"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">E-mail</label>
                <input
                  type="email"
                  maxLength={MAXLEN.email}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.slice(0, MAXLEN.email) })}
                  className="w-full border rounded-xl p-2.5"
                  placeholder="contato@fornecedor.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-stone-700 block mb-1">Categorias Fornecidas</label>
                {ingredientCategories.length === 0 ? (
                  <p className="text-stone-400 text-[11px]">
                    Nenhum grupo de insumo cadastrado ainda. Crie grupos em Produtos & Estoque → Grupos.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ingredientCategories.map((cat) => {
                      const selected = form.suppliedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                            selected
                              ? 'bg-amber-800 text-white border-amber-800'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-stone-700">Observações</label>
                  <span className="text-[10px] text-stone-400">{form.notes.length}/500</span>
                </div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: sanitizeText(e.target.value, MAXLEN.description) })}
                  className="w-full border rounded-xl p-2.5"
                  rows={2}
                  maxLength={MAXLEN.description}
                  placeholder="Ex: Entrega às terças e sextas, pedido mínimo R$ 200..."
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded text-amber-800"
                  />
                  <span>Fornecedor ativo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                {editingId ? 'Salvar' : 'Criar'} Fornecedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Exclusão */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Excluir Fornecedor</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Tem certeza que deseja excluir <span className="font-semibold text-stone-700">{deletingSupplier.name}</span>? Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingSupplier(null)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
