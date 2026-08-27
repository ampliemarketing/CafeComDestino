import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Boxes,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Product, ProductAddition, Category, SaleUnit } from '../../types';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, toBoundedNumber, maskNCM, isValidNCM, isValidImageUrl } from '../../lib/validation';

export const ProductManagement: React.FC = () => {
  const { products, categories, saleUnits, saveProduct, deleteProduct, saveCategory, saveSaleUnit, addToast, currentUser } = useApp();
  const can = (key: string) => hasPermission(currentUser, key);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [searchQuery, setSearchQuery] = useState('');

  // Product Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Category Modal (create or edit)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryShowsInStock, setNewCategoryShowsInStock] = useState(true);

  const handleOpenCategoryModal = () => {
    const selected = categories.find((c) => c.id === editingProduct?.categoryId);
    setEditingCategory(selected || null);
    setNewCategoryName(selected?.name || '');
    setNewCategoryShowsInStock(selected ? selected.showsInStock !== false : true);
    setIsCategoryModalOpen(true);
  };

  // New Sale Unit Modal
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState('');

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.includes(searchQuery);
    const matchStatus = statusFilter === 'todos' || (statusFilter === 'ativos' ? p.available : !p.available);
    return matchCat && matchSearch && matchStatus;
  });

  const handleDeleteProduct = (p: Product) => {
    if (confirm(`Excluir o produto "${p.name}"? Essa ação não pode ser desfeita. Para apenas ocultá-lo do PDV/Cardápio, use "Desativar" em vez de excluir.`)) {
      deleteProduct(p.id);
    }
  };

  const getNextProductCode = () => {
    const maxCode = products.reduce((max, p) => {
      const num = parseInt(p.code, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 100);
    return String(maxCode + 1);
  };

  const handleOpenCreate = () => {
    setEditingProduct({
      id: 'prod-' + Date.now(),
      code: getNextProductCode(),
      name: '',
      categoryId: categories[0]?.id || '',
      description: '',
      price: 29.90,
      costPrice: 10.00,
      unit: saleUnits[0]?.abbreviation || '',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: true,
      requiresPreparation: true,
      trackStock: categories[0] ? categories[0].showsInStock !== false : true,
      stockQuantity: 0,
      minStock: 0,
      additions: [],
      fiscal: {
        ncm: '2106.90.90',
        cfop: '5102',
        cstCsosn: '102',
        taxPercentage: 4.5,
      }
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingProduct?.name?.trim()) {
      addToast('error', 'Campos obrigatórios', 'Preencha o nome do produto.');
      return;
    }
    if (typeof editingProduct.price !== 'number' || editingProduct.price <= 0) {
      addToast('error', 'Preço inválido', 'Informe um preço de venda maior que zero.');
      return;
    }
    if ((editingProduct.costPrice ?? 0) < 0) {
      addToast('error', 'Custo inválido', 'O custo não pode ser negativo.');
      return;
    }
    if (editingProduct.promoPrice != null && editingProduct.promoPrice >= editingProduct.price) {
      addToast('error', 'Promoção inválida', 'O preço promocional precisa ser menor que o preço de venda.');
      return;
    }
    if (editingProduct.imageUrl && !isValidImageUrl(editingProduct.imageUrl)) {
      addToast('error', 'URL de imagem inválida', 'Use um link http(s) ou deixe em branco.');
      return;
    }
    if (editingProduct.fiscal?.ncm && !isValidNCM(editingProduct.fiscal.ncm)) {
      addToast('error', 'NCM inválido', 'O NCM deve ter 8 dígitos (0000.00.00).');
      return;
    }
    if (!editingProduct?.categoryId) {
      addToast('error', 'Categoria obrigatória', 'Selecione ou crie uma categoria para o produto.');
      return;
    }
    if (!editingProduct?.unit) {
      addToast('error', 'Unidade de venda obrigatória', 'Selecione ou crie uma unidade de venda para o produto.');
      return;
    }

    // trackStock é herdado da categoria: categorias marcadas "Ir para o Estoque"
    // controlam estoque no produto; categorias desmarcadas (ex: pratos prontos
    // feitos na hora) não controlam, mesmo que o produto já tivesse sido salvo
    // com outro valor antes.
    const category = categories.find((c) => c.id === editingProduct.categoryId);
    const trackStock = category ? category.showsInStock !== false : true;

    saveProduct({ ...editingProduct, trackStock } as Product);
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Cadastro de Produtos</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Gestão de cardápio, preços, adicionais e regras fiscais NCM.
            </p>
          </div>
        </div>

        {can('produtos.criar') && (
        <button
          onClick={handleOpenCreate}
          className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Produto</span>
        </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              maxLength={60}
              placeholder="Buscar por nome ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
              className="w-full border rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700"
            />
          </div>

          <div className="flex gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-bold shrink-0">
            {(['ativos', 'inativos', 'todos'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  statusFilter === s ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto w-full text-xs font-semibold">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              selectedCategory === 'all' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Todas as Categorias
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                selectedCategory === c.id ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0 z-10">
              <tr>
                <th className="p-3.5">Cód</th>
                <th className="p-3.5">Produto</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Preço Venda</th>
                <th className="p-3.5">Custo Aprox.</th>
                <th className="p-3.5">Unidade de Venda</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map((p) => {
                const category = categories.find((c) => c.id === p.categoryId);

                return (
                  <tr key={p.id} className="hover:bg-stone-50 transition">
                    <td className="p-3.5 font-bold font-mono text-stone-700">{p.code}</td>
                    <td className="p-3.5 font-semibold text-stone-900 flex items-center gap-3">
                      <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border" />
                      <div>
                        <p>{p.name}</p>
                        <p className="text-[10px] text-stone-400 font-normal">NCM: {p.fiscal.ncm}</p>
                      </div>
                    </td>
                    <td className="p-3.5 text-stone-600 font-medium">{category?.name || 'Geral'}</td>
                    <td className="p-3.5 font-bold text-stone-900">R$ {p.price.toFixed(2)}</td>
                    <td className="p-3.5 text-stone-600">R$ {p.costPrice.toFixed(2)}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-stone-100 text-stone-700 border border-stone-200">
                        {saleUnits.find((u) => u.abbreviation === p.unit)?.name || p.unit || 'Não definida'}
                        {p.unit ? ` (${p.unit})` : ''}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        p.available ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {p.available ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {can('produtos.editar') && (
                        <button onClick={() => handleOpenEdit(p)} title="Editar produto" className="p-1.5 text-stone-600 hover:text-stone-900">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        )}
                        {can('produtos.excluir') && (
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          title="Excluir produto"
                          className="p-1.5 text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Cadastro de Produto</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Código do Produto</label>
                <input
                  type="text"
                  value={editingProduct.code || ''}
                  readOnly
                  disabled
                  title="Código fixo, gerado automaticamente em sequência."
                  className="w-full border rounded-xl p-2.5 bg-stone-100 text-stone-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  maxLength={MAXLEN.name}
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: sanitizeText(e.target.value, MAXLEN.name) })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-stone-700">Categoria *</label>
                  <button
                    type="button"
                    onClick={handleOpenCategoryModal}
                    className="text-amber-800 font-bold hover:underline flex items-center gap-1"
                  >
                    {editingProduct.categoryId ? <Edit2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{editingProduct.categoryId ? 'Editar categoria' : 'Nova categoria'}</span>
                  </button>
                </div>
                <select
                  value={editingProduct.categoryId || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                >
                  <option value="">Selecione...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-stone-700">Unidade de Venda *</label>
                  <button
                    type="button"
                    onClick={() => { setNewUnitName(''); setNewUnitAbbreviation(''); setIsUnitModalOpen(true); }}
                    className="text-amber-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova unidade</span>
                  </button>
                </div>
                <select
                  value={editingProduct.unit || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                >
                  <option value="">Selecione...</option>
                  {saleUnits.map((u) => (
                    <option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Preço de Venda (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.price ?? 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: toBoundedNumber(e.target.value, 0, 1_000_000) })}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Custo Estimado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.costPrice ?? 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: toBoundedNumber(e.target.value, 0, 1_000_000) })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Preço Promocional (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.promoPrice ?? ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, promoPrice: e.target.value ? toBoundedNumber(e.target.value, 0, 1_000_000) : undefined })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-stone-700 block mb-1">Descrição Comercial</label>
                <textarea
                  maxLength={MAXLEN.description}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: sanitizeText(e.target.value, MAXLEN.description) })}
                  className="w-full border rounded-xl p-2.5"
                  rows={2}
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">URL da Imagem</label>
                <input
                  type="url"
                  maxLength={MAXLEN.url}
                  placeholder="https://..."
                  value={editingProduct.imageUrl || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value.slice(0, MAXLEN.url) })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">NCM Fiscal</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={MAXLEN.ncm}
                  placeholder="0000.00.00"
                  value={editingProduct.fiscal?.ncm || '2106.90.90'}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    fiscal: { ...editingProduct.fiscal!, ncm: maskNCM(e.target.value) }
                  })}
                  className="w-full border rounded-xl p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" title="Produto inativo some do PDV e do Cardápio Online, mas continua cadastrado (histórico de vendas preservado). Use em vez de excluir.">
                  <input
                    type="checkbox"
                    checked={editingProduct.available || false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, available: e.target.checked })}
                    className="rounded text-amber-800"
                  />
                  <span>Produto Ativo</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" title="Desmarque para itens que não passam pela cozinha, como bebidas prontas — entram direto como Pronto na comanda.">
                  <input
                    type="checkbox"
                    checked={editingProduct.requiresPreparation ?? true}
                    onChange={(e) => setEditingProduct({ ...editingProduct, requiresPreparation: e.target.checked })}
                    className="rounded text-amber-800"
                  />
                  <span>Precisa de Preparo?</span>
                </label>
              </div>

              <button
                onClick={handleSave}
                className="bg-amber-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow"
              >
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h3>
            <div className="text-xs">
              <label className="font-semibold text-stone-700 block mb-1">Nome da Categoria *</label>
              <input
                type="text"
                autoFocus
                maxLength={MAXLEN.name}
                placeholder="Ex: Bebidas & Sucos"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(sanitizeText(e.target.value, MAXLEN.name))}
                className="w-full border rounded-xl p-2.5"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" title="Desmarque para categorias de pratos prontos, cujo estoque já é controlado pela ficha técnica dos insumos — os produtos dela não aparecem na tela de Gestão de Estoque.">
              <input
                type="checkbox"
                checked={newCategoryShowsInStock}
                onChange={(e) => setNewCategoryShowsInStock(e.target.checked)}
                className="rounded text-amber-800"
              />
              <span>Ir para o Estoque</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newCategoryName.trim()) {
                    addToast('error', 'Nome obrigatório', 'Informe o nome da categoria.');
                    return;
                  }
                  const savedCategory: Category = {
                    id: editingCategory?.id || 'cat-' + Date.now(),
                    name: newCategoryName.trim(),
                    icon: editingCategory?.icon || 'Utensils',
                    description: editingCategory?.description,
                    order: editingCategory?.order ?? categories.length + 1,
                    active: editingCategory?.active ?? true,
                    showsInStock: newCategoryShowsInStock,
                  };
                  saveCategory(savedCategory);
                  setEditingProduct((prev) => (prev ? { ...prev, categoryId: savedCategory.id } : prev));
                  setIsCategoryModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                {editingCategory ? 'Salvar Categoria' : 'Criar Categoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Sale Unit Modal */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Nova Unidade de Venda</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Nome *</label>
                <input
                  type="text"
                  autoFocus
                  maxLength={40}
                  placeholder="Ex: Quilograma"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(sanitizeText(e.target.value, 40))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Abreviação *</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Ex: KG"
                  value={newUnitAbbreviation}
                  onChange={(e) => setNewUnitAbbreviation(sanitizeText(e.target.value, 6).toUpperCase())}
                  className="w-full border rounded-xl p-2.5 font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsUnitModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newUnitName.trim() || !newUnitAbbreviation.trim()) {
                    addToast('error', 'Campos obrigatórios', 'Informe nome e abreviação da unidade.');
                    return;
                  }
                  const newUnit: SaleUnit = {
                    id: 'unit-' + Date.now(),
                    name: newUnitName.trim(),
                    abbreviation: newUnitAbbreviation.trim(),
                  };
                  saveSaleUnit(newUnit);
                  setEditingProduct((prev) => (prev ? { ...prev, unit: newUnit.abbreviation } : prev));
                  setIsUnitModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Criar Unidade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
