import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Tags, Boxes, Package, MapPin, Plus, Edit2, Trash2, X } from 'lucide-react';
import { Category, IngredientCategory, TableSector } from '../../types';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText } from '../../lib/validation';

export const GroupManagement: React.FC = () => {
  const {
    categories,
    ingredientCategories,
    tableSectors,
    products,
    ingredients,
    tables,
    saveCategory,
    deleteCategory,
    saveIngredientCategory,
    deleteIngredientCategory,
    saveTableSector,
    deleteTableSector,
    addToast,
    confirmDialog,
    currentUser
  } = useApp();
  const canManage = hasPermission(currentUser, 'grupos.gerenciar');

  const [groupType, setGroupType] = useState<'ingredient' | 'product' | 'area'>('ingredient');

  // Create/Edit modal (shared for both types)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [showsInStockInput, setShowsInStockInput] = useState(true);

  const handleOpenCreate = () => {
    setEditingId(null);
    setNameInput('');
    setShowsInStockInput(true);
    setIsModalOpen(true);
  };

  const handleOpenEditProductCategory = (cat: Category) => {
    setEditingId(cat.id);
    setNameInput(cat.name);
    setShowsInStockInput(cat.showsInStock !== false);
    setIsModalOpen(true);
  };

  const handleOpenEditIngredientCategory = (cat: IngredientCategory) => {
    setEditingId(cat.id);
    setNameInput(cat.name);
    setIsModalOpen(true);
  };

  const handleOpenEditTableSector = (sector: TableSector) => {
    setEditingId(sector.id);
    setNameInput(sector.name);
    setIsModalOpen(true);
  };

  const handleSaveGroup = () => {
    if (!nameInput.trim()) {
      addToast('error', 'Nome obrigatório', 'Informe o nome do grupo.');
      return;
    }

    if (groupType === 'product') {
      const existing = editingId ? categories.find((c) => c.id === editingId) : undefined;
      const saved: Category = {
        id: editingId || 'cat-' + Date.now(),
        name: nameInput.trim(),
        icon: existing?.icon || 'Utensils',
        description: existing?.description,
        order: existing?.order ?? categories.length + 1,
        active: existing?.active ?? true,
        showsInStock: showsInStockInput,
      };
      saveCategory(saved);
    } else if (groupType === 'area') {
      const saved: TableSector = {
        id: editingId || 'sector-' + Date.now(),
        name: nameInput.trim(),
      };
      saveTableSector(saved);
    } else {
      const saved: IngredientCategory = {
        id: editingId || 'ingcat-' + Date.now(),
        name: nameInput.trim(),
      };
      saveIngredientCategory(saved);
    }

    setIsModalOpen(false);
  };

  const handleDeleteProductCategory = async (cat: Category) => {
    const usageCount = products.filter((p) => p.categoryId === cat.id).length;
    const usageWarning = usageCount > 0 ? ` ${usageCount} produto(s) cadastrado(s) nesse grupo ficarão sem categoria.` : '';
    const ok = await confirmDialog({ title: 'Excluir grupo de produto', message: `Excluir o grupo de produto "${cat.name}"?${usageWarning}` });
    if (ok) deleteCategory(cat.id);
  };

  const handleDeleteIngredientCategory = async (cat: IngredientCategory) => {
    const usageCount = ingredients.filter((i) => i.category === cat.id).length;
    const usageWarning = usageCount > 0 ? ` ${usageCount} insumo(s) cadastrado(s) nesse grupo ficarão sem categoria.` : '';
    const ok = await confirmDialog({ title: 'Excluir grupo de insumo', message: `Excluir o grupo de insumo "${cat.name}"?${usageWarning}` });
    if (ok) deleteIngredientCategory(cat.id);
  };

  const handleDeleteTableSector = async (sector: TableSector) => {
    const usageCount = tables.filter((t) => t.sector === sector.name).length;
    const usageWarning = usageCount > 0 ? ` ${usageCount} mesa(s) cadastrada(s) nessa área continuarão existindo, só deixam de aparecer nesse filtro.` : '';
    const ok = await confirmDialog({ title: 'Excluir área', message: `Excluir a área "${sector.name}"?${usageWarning}` });
    if (ok) deleteTableSector(sector.id);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Tags className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Grupos</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Categorias de insumos, de produtos e áreas do salão usadas em Produtos, Estoque e Mesas & Comandas.
            </p>
          </div>
        </div>

        {canManage && (
        <button
          onClick={handleOpenCreate}
          className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>
            {groupType === 'ingredient' && 'Novo Grupo de Insumo'}
            {groupType === 'product' && 'Nova Categoria de Produto'}
            {groupType === 'area' && 'Nova Área do Restaurante'}
          </span>
        </button>
        )}
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200 text-xs font-bold">
        <button
          onClick={() => setGroupType('ingredient')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            groupType === 'ingredient' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Insumos ({ingredientCategories.length})</span>
        </button>

        <button
          onClick={() => setGroupType('product')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            groupType === 'product' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Produtos ({categories.length})</span>
        </button>

        <button
          onClick={() => setGroupType('area')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            groupType === 'area' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Áreas do Restaurante ({tableSectors.length})</span>
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0 z-10">
              <tr>
                <th className="p-3.5">Nome do Grupo</th>
                {groupType === 'product' && <th className="p-3.5">Vai para o Estoque</th>}
                <th className="p-3.5">Itens Cadastrados</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groupType === 'ingredient' ? (
                ingredientCategories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-stone-400 italic">
                      Nenhum grupo de insumo cadastrado até o momento.
                    </td>
                  </tr>
                ) : (
                  ingredientCategories.map((cat) => {
                    const usageCount = ingredients.filter((i) => i.category === cat.id).length;
                    return (
                      <tr key={cat.id} className="hover:bg-stone-50 transition">
                        <td className="p-3.5 font-bold text-stone-900">{cat.name}</td>
                        <td className="p-3.5 text-stone-600 font-semibold">{usageCount} insumo(s)</td>
                        <td className="p-3.5 text-center">
                          {canManage && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditIngredientCategory(cat)}
                              title="Editar grupo"
                              className="p-1.5 text-stone-600 hover:text-stone-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteIngredientCategory(cat)}
                              title="Excluir grupo"
                              className="p-1.5 text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : groupType === 'product' ? (
                categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-stone-400 italic">
                      Nenhuma categoria de produto cadastrada até o momento.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const usageCount = products.filter((p) => p.categoryId === cat.id).length;
                    return (
                      <tr key={cat.id} className="hover:bg-stone-50 transition">
                        <td className="p-3.5 font-bold text-stone-900">{cat.name}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            cat.showsInStock !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                          }`}>
                            {cat.showsInStock !== false ? 'SIM' : 'NÃO'}
                          </span>
                        </td>
                        <td className="p-3.5 text-stone-600 font-semibold">{usageCount} produto(s)</td>
                        <td className="p-3.5 text-center">
                          {canManage && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditProductCategory(cat)}
                              title="Editar categoria"
                              className="p-1.5 text-stone-600 hover:text-stone-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProductCategory(cat)}
                              title="Excluir categoria"
                              className="p-1.5 text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : tableSectors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-stone-400 italic">
                    Nenhuma área cadastrada até o momento. Crie a primeira área para poder cadastrar mesas.
                  </td>
                </tr>
              ) : (
                tableSectors.map((sector) => {
                  const usageCount = tables.filter((t) => t.sector === sector.name).length;
                  return (
                    <tr key={sector.id} className="hover:bg-stone-50 transition">
                      <td className="p-3.5 font-bold text-stone-900">{sector.name}</td>
                      <td className="p-3.5 text-stone-600 font-semibold">{usageCount} mesa(s)</td>
                      <td className="p-3.5 text-center">
                        {canManage && (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditTableSector(sector)}
                            title="Editar área"
                            className="p-1.5 text-stone-600 hover:text-stone-900"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTableSector(sector)}
                            title="Excluir área"
                            className="p-1.5 text-rose-600 hover:text-rose-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create/Edit Group */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-stone-900 text-base">
                {editingId ? 'Editar' : 'Novo'}{' '}
                {groupType === 'ingredient' && 'Grupo de Insumo'}
                {groupType === 'product' && 'Categoria de Produto'}
                {groupType === 'area' && 'Área do Restaurante'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-stone-700 block mb-1">
                {groupType === 'area' ? 'Nome da Área *' : 'Nome do Grupo *'}
              </label>
              <input
                type="text"
                autoFocus
                maxLength={MAXLEN.name}
                placeholder={
                  groupType === 'ingredient' ? 'Ex: Carnes' : groupType === 'product' ? 'Ex: Bebidas & Sucos' : 'Ex: Salão Principal'
                }
                value={nameInput}
                onChange={(e) => setNameInput(sanitizeText(e.target.value, MAXLEN.name))}
                className="w-full border rounded-xl p-2.5"
              />
            </div>

            {groupType === 'product' && (
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" title="Desmarque para categorias de pratos prontos, cujo estoque já é controlado pela ficha técnica dos insumos — os produtos dela não aparecem na tela de Gestão de Estoque.">
                <input
                  type="checkbox"
                  checked={showsInStockInput}
                  onChange={(e) => setShowsInStockInput(e.target.checked)}
                  className="rounded text-amber-800"
                />
                <span>Ir para o Estoque</span>
              </label>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGroup}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                {editingId ? 'Salvar' : 'Criar'} {groupType === 'area' ? 'Área' : 'Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
