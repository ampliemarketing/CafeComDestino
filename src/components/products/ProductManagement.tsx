import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Boxes, 
  CheckCircle2, 
  X, 
  FileText, 
  Sparkles,
  Utensils
} from 'lucide-react';
import { Product, ProductAddition, TechnicalSheet } from '../../types';

export const ProductManagement: React.FC = () => {
  const { products, categories, ingredients, technicalSheets, saveProduct, deleteProduct, addToast } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Product Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Technical Sheet Modal
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [activeSheetProduct, setActiveSheetProduct] = useState<Product | null>(null);
  const [sheetIngredients, setSheetIngredients] = useState<Array<{ ingredientId: string; quantityUsed: number; unit: string }>>([]);

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.includes(searchQuery);
    return matchCat && matchSearch;
  });

  const handleOpenCreate = () => {
    setEditingProduct({
      id: 'prod-' + Date.now(),
      code: String(100 + products.length + 1),
      name: '',
      categoryId: categories[0]?.id || 'cat-1',
      description: '',
      price: 29.90,
      costPrice: 10.00,
      unit: 'UN',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: true,
      trackStock: true,
      stockQuantity: 50,
      minStock: 10,
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
    if (!editingProduct?.name || !editingProduct?.price) {
      addToast('error', 'Campos obrigatórios', 'Preencha o nome e preço do produto.');
      return;
    }
    saveProduct(editingProduct as Product);
    setIsModalOpen(false);
  };

  const handleOpenSheet = (p: Product) => {
    setActiveSheetProduct(p);
    const existing = technicalSheets.find((ts) => ts.productId === p.id);
    setSheetIngredients(existing ? existing.ingredients : []);
    setIsSheetModalOpen(true);
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
            <h2 className="text-xl font-bold tracking-tight">Cadastro de Produtos & Ficha Técnica</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Gestão de cardápio, preços, adicionais, regras fiscais NCM e consumo automático de estoque.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Produto</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto text-xs font-semibold">
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
              <tr>
                <th className="p-3.5">Cód</th>
                <th className="p-3.5">Produto</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Preço Venda</th>
                <th className="p-3.5">Custo Aprox.</th>
                <th className="p-3.5">Estoque Saldo</th>
                <th className="p-3.5">Disponível</th>
                <th className="p-3.5 text-center">Ficha Técnica</th>
                <th className="p-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map((p) => {
                const category = categories.find((c) => c.id === p.categoryId);
                const hasSheet = technicalSheets.some((ts) => ts.productId === p.id);

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
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        p.stockQuantity <= p.minStock ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.stockQuantity} {p.unit}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        p.available ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {p.available ? 'SIM' : 'NÃO'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleOpenSheet(p)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          hasSheet ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-stone-100 text-stone-600 border'
                        }`}
                      >
                        <Utensils className="w-3 h-3" />
                        <span>{hasSheet ? 'Ficha Mapeada' : 'Criar Ficha'}</span>
                      </button>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-stone-600 hover:text-stone-900">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-rose-600 hover:text-rose-800">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                <label className="font-semibold text-stone-700 block mb-1">Código do Produto *</label>
                <input
                  type="text"
                  value={editingProduct.code || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Categoria *</label>
                <select
                  value={editingProduct.categoryId || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Preço de Venda (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProduct.price || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Custo Estimado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProduct.costPrice || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: Number(e.target.value) })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Preço Promocional (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProduct.promoPrice || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, promoPrice: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-stone-700 block mb-1">Descrição Comercial</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                  rows={2}
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">URL da Imagem</label>
                <input
                  type="text"
                  value={editingProduct.imageUrl || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">NCM Fiscal</label>
                <input
                  type="text"
                  value={editingProduct.fiscal?.ncm || '2106.90.90'}
                  onChange={(e) => setEditingProduct({ 
                    ...editingProduct, 
                    fiscal: { ...editingProduct.fiscal!, ncm: e.target.value } 
                  })}
                  className="w-full border rounded-xl p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.available || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, available: e.target.checked })}
                  className="rounded text-amber-800"
                />
                <span>Disponível para Venda</span>
              </label>

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

      {/* Technical Sheet Modal */}
      {isSheetModalOpen && activeSheetProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Ficha Técnica: {activeSheetProduct.name}</h3>
                <p className="text-xs text-stone-500">Mapeamento de insumos para baixa automática no estoque</p>
              </div>
              <button onClick={() => setIsSheetModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <span className="font-bold text-stone-700 block">Ingredientes Utilizados:</span>
              {sheetIngredients.map((ing, idx) => {
                const foundIng = ingredients.find((i) => i.id === ing.ingredientId);
                return (
                  <div key={idx} className="p-2.5 bg-stone-50 rounded-xl border flex items-center justify-between">
                    <span className="font-bold text-stone-900">{foundIng?.name || 'Insumo'}</span>
                    <span className="text-amber-800 font-semibold">{ing.quantityUsed} {ing.unit}</span>
                  </div>
                );
              })}

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold">
                Ao vender {activeSheetProduct.name}, os insumos da ficha serão reduzidos do Estoque automaticamente!
              </div>
            </div>

            <button
              onClick={() => {
                addToast('success', 'Ficha Técnica Atualizada!');
                setIsSheetModalOpen(false);
              }}
              className="w-full bg-amber-800 text-white py-2.5 rounded-xl font-bold text-xs shadow"
            >
              Salvar Ficha Técnica
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
