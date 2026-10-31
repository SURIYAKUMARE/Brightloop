import React, { useState, useEffect } from 'react';
import { Package, Search, Plus, Layers, DollarSign, Tag, Check, Sparkles } from 'lucide-react';
import { fetchProducts, apiRequest } from '../api/client';
import { Product, ProductVariant } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // New Product Form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [productType, setProductType] = useState('recurring_service');
  const [description, setDescription] = useState('');

  // New Variant Form
  const [variantName, setVariantName] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantPrice, setVariantPrice] = useState('560.00'); // Odoo example default

  // Variant price calculator preview
  const [previewVariantPrice, setPreviewVariantPrice] = useState<number>(0);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/products/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sku,
          sales_price: parseFloat(salesPrice),
          cost_price: parseFloat(costPrice || '0'),
          product_type: productType,
          description,
          variants: [
            { name: 'Standard Base', sku: `${sku}-STD`, additional_price: 0, status: 'active' }
          ]
        })
      });
      setIsModalOpen(false);
      setName('');
      setSku('');
      setSalesPrice('');
      setCostPrice('');
      setDescription('');
      await loadProducts();
    } catch (err: any) {
      alert(`Error creating product: ${err.message}`);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await apiRequest(`/products/${selectedProduct.id}/variants`, {
        method: 'POST',
        body: JSON.stringify({
          name: variantName,
          sku: variantSku,
          additional_price: parseFloat(variantPrice),
          status: 'active'
        })
      });
      setIsVariantModalOpen(false);
      setVariantName('');
      setVariantSku('');
      setVariantPrice('560.00');
      await loadProducts();
    } catch (err: any) {
      alert(`Error adding variant: ${err.message}`);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || p.product_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Product & Variant Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure enterprise software lines, license tiers, and incremental variant add-ons.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Types</option>
            <option value="recurring_service">Recurring Service</option>
            <option value="digital">Digital Cloud License</option>
            <option value="physical">Physical Asset</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((prod) => (
          <div
            key={prod.id}
            className="flex flex-col justify-between p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {prod.sku}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {prod.name}
                  </h3>
                </div>
                <StatusBadge status={prod.status} size="sm" />
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                {prod.description || 'Enterprise grade solution.'}
              </p>

              {/* Base Price */}
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-xs text-slate-400">Base Sales Price:</span>
                <span className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  ₹{prod.sales_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Variants Section */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-brand-600" />
                    Available Variants ({prod.variants.length})
                  </span>
                  <button
                    onClick={() => {
                      setSelectedProduct(prod);
                      setIsVariantModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Add Variant
                  </button>
                </div>

                <div className="space-y-1.5">
                  {prod.variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{v.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 ml-1.5">({v.sku})</span>
                      </div>
                      <span className="font-mono font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                        {v.additional_price > 0 ? `+₹${v.additional_price.toLocaleString('en-IN')}` : 'Included'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Price Calculator Callout */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Variants dynamically compute total on quote creation</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Create Product Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Product Line">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Brightloop ERP"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU Code *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. BL-ERP-01"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Sales Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
                placeholder="2499.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="800.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Product Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enterprise financial suite with multi-tier features..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              Create Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Variant Modal */}
      {selectedProduct && (
        <Modal
          isOpen={isVariantModalOpen}
          onClose={() => setIsVariantModalOpen(false)}
          title={`Add Variant to ${selectedProduct.name}`}
        >
          <form onSubmit={handleAddVariant} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Variant Name *</label>
              <input
                type="text"
                required
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="e.g. Odoo Connector, Enterprise AI, Multi-Branch"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Variant SKU *</label>
                <input
                  type="text"
                  required
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value.toUpperCase())}
                  placeholder="e.g. BL-ODOO-MOD"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Additional Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={variantPrice}
                  onChange={(e) => setVariantPrice(e.target.value)}
                  placeholder="560.00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            {/* Dynamic Price Preview */}
            <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800">
              <p className="text-[11px] text-brand-700 dark:text-brand-300 font-medium">Automatic Price Calculation Preview:</p>
              <p className="text-xs text-slate-700 dark:text-slate-200 mt-1">
                Base Price ₹{selectedProduct.sales_price.toLocaleString('en-IN')} + Variant ₹{parseFloat(variantPrice || '0').toLocaleString('en-IN')} ={' '}
                <strong className="font-mono text-sm text-brand-600 dark:text-brand-400">
                  ₹{(selectedProduct.sales_price + parseFloat(variantPrice || '0')).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
              >
                Save Variant
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
