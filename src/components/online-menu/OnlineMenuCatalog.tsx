import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, MapPin, Search, X } from 'lucide-react';
import { Product } from '../../types';

/**
 * "Cardápio Online" dentro do painel administrativo — SOMENTE CONSULTA.
 * Pedir/adicionar item é exclusivo da rota pública /pedir (PublicOnlineMenu.tsx);
 * aqui é só pro garçom/atendente visualizar o cardápio e pesquisar um item na
 * hora de atender o cliente (sem carrinho, checkout ou pagamento).
 */
export const OnlineMenuCatalog: React.FC = () => {
  const { companyProfile, categories, products } = useApp();

  const findPratoFeitoCategoryId = (cats: typeof categories) =>
    cats.find((c) => c.name.trim().toLowerCase() === 'prato feito')?.id;

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => findPratoFeitoCategoryId(categories) || categories[0]?.id || ''
  );
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Assim que as categorias carregarem (ex: primeiro acesso antes do fetch
  // terminar), abre o cardápio já em "Prato Feito" — só respeita a escolha
  // manual depois que o usuário trocar de categoria.
  useEffect(() => {
    if (hasManuallySelectedCategory || selectedCategory) return;
    const pratoFeitoId = findPratoFeitoCategoryId(categories);
    if (pratoFeitoId) {
      setSelectedCategory(pratoFeitoId);
    } else if (categories[0]) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, hasManuallySelectedCategory, selectedCategory]);

  const isSearching = searchQuery.trim().length > 0;
  const filteredProducts = products.filter((p) => {
    const matchesCat = isSearching || !selectedCategory || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch && p.available;
  });

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-stone-900 pb-6">
      <div className="relative h-40 sm:h-56 w-full bg-stone-900 overflow-hidden">
        <img
          src={companyProfile.coverUrl}
          alt="Capa Restaurante"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 max-w-5xl mx-auto flex items-end gap-4 text-white">
          {companyProfile.logoUrl && (
            <img
              src={companyProfile.logoUrl}
              alt="Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white/80 object-cover shadow-lg shrink-0"
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{companyProfile.tradeName}</h1>
            <p className="text-xs text-stone-300 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Preparo médio: {companyProfile.avgPrepTimeMinutes} min
            </p>
            <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>{companyProfile.address.street}, {companyProfile.address.number} - {companyProfile.address.neighborhood}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto lg:px-4">
        <div className="sticky top-0 z-20 bg-[#F6F1EA] px-4 lg:px-0 py-3 border-b border-stone-200/70">
          <div className="relative max-w-md mb-2.5">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={60}
              placeholder="Buscar pratos, bebidas ou sobremesas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
              className="w-full bg-white border border-stone-300 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setHasManuallySelectedCategory(true); }}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-amber-800 text-white shadow-sm'
                    : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 lg:px-0 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => setSelectedProduct(prod)}
                className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-amber-700/50 transition cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center justify-between gap-4 group"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  {prod.promoPrice && (
                    <span className="inline-block bg-rose-100 text-rose-700 font-bold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded mb-1">Promoção</span>
                  )}
                  <h3 className="font-bold text-sm text-stone-900 group-hover:text-amber-800 transition">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-stone-500 line-clamp-2">{prod.description}</p>
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">
                      R$ {(prod.promoPrice || prod.price).toFixed(2)}
                    </span>
                    {prod.promoPrice && (
                      <span className="text-xs text-stone-400 line-through">
                        R$ {prod.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                  <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <p className="text-center text-stone-400 text-xs py-12">Nenhum item encontrado.</p>
          )}
        </div>
      </div>

      {/* Só visualização: sem quantidade, sem adicionar ao carrinho — pedir é
          exclusivamente pela rota pública /pedir. */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200">
            <div className="relative h-48 w-full bg-stone-100">
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 bg-stone-900/70 text-white p-2 rounded-full hover:bg-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                {selectedProduct.promoPrice && (
                  <span className="inline-block bg-rose-100 text-rose-700 font-bold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded mb-1">Promoção</span>
                )}
                <h3 className="font-bold text-lg text-stone-900">{selectedProduct.name}</h3>
                <p className="text-xs text-stone-500 mt-1">{selectedProduct.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-base font-bold text-amber-800">
                    R$ {(selectedProduct.promoPrice || selectedProduct.price).toFixed(2)}
                  </span>
                  {selectedProduct.promoPrice && (
                    <span className="text-xs text-stone-400 line-through">
                      R$ {selectedProduct.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {selectedProduct.additions && selectedProduct.additions.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t">
                  <span className="font-semibold text-xs text-stone-700 block uppercase tracking-wider">
                    Adicionais disponíveis
                  </span>
                  {selectedProduct.additions.map((add) => (
                    <div key={add.id} className="flex items-center justify-between text-xs text-stone-600">
                      <span>{add.name}</span>
                      <span>+ R$ {add.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 text-right">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
