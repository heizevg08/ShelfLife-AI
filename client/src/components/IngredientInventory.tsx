    import React, { useState } from 'react';
    import {
    Plus,
    Search,
    Filter,
    Edit2,
    Trash2,
    AlertTriangle,
    Package,
    Layers,
    X,
    Check,
    } from 'lucide-react';

    interface Ingredient {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    minThreshold: number;
    costPerUnit: number;
    supplier: string;
    lastRestocked: string;
    }

    // Initialized to empty so only user-created data appears
    const INITIAL_INGREDIENTS: Ingredient[] = [];

    export default function IngredientInventory() {
    const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

    // Form State
    const [formData, setFormData] = useState<Omit<Ingredient, 'id'>>({
        name: '',
        category: 'Dairy',
        quantity: 0,
        unit: 'kg',
        minThreshold: 0,
        costPerUnit: 0,
        supplier: '',
        lastRestocked: new Date().toISOString().split('T')[0],
    });

    // Calculate Summary Metrics
    const totalItems = ingredients.length;
    const lowStockItems = ingredients.filter((item) => item.quantity <= item.minThreshold);
    const totalInventoryValue = ingredients.reduce(
        (sum, item) => sum + item.quantity * item.costPerUnit,
        0
    );

    // Dynamic Categories extracted from created ingredients
    const categories = Array.from(new Set(ingredients.map((item) => item.category)));

    // Filter List
    const filteredIngredients = ingredients.filter((item) => {
        const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Handle Add / Edit Submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingIngredient) {
        setIngredients(
            ingredients.map((item) =>
            item.id === editingIngredient.id ? { ...formData, id: item.id } : item
            )
        );
        } else {
        const newIngredient: Ingredient = {
            ...formData,
            id: `ING-${String(ingredients.length + 1).padStart(3, '0')}`,
        };
        setIngredients([...ingredients, newIngredient]);
        }
        handleCloseModal();
    };

    // Open Modal for Edit
    const handleEdit = (ingredient: Ingredient) => {
        setEditingIngredient(ingredient);
        setFormData({
        name: ingredient.name,
        category: ingredient.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        minThreshold: ingredient.minThreshold,
        costPerUnit: ingredient.costPerUnit,
        supplier: ingredient.supplier,
        lastRestocked: ingredient.lastRestocked,
        });
        setIsModalOpen(true);
    };

    // Delete Ingredient
    const handleDelete = (id: string) => {
        setIngredients(ingredients.filter((item) => item.id !== id));
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingIngredient(null);
        setFormData({
        name: '',
        category: 'Dairy',
        quantity: 0,
        unit: 'kg',
        minThreshold: 0,
        costPerUnit: 0,
        supplier: '',
        lastRestocked: new Date().toISOString().split('T')[0],
        });
    };

    return (
        <div className="min-h-screen bg-white text-gray-800 p-6 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Ingredient Inventory
            </h1>
            <p className="text-xs text-gray-500 mt-1">
                Manage stock levels, suppliers, and ingredient tracking
            </p>
            </div>
            <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
            <Plus className="w-4 h-4" />
            Add Ingredient
            </button>
        </div>

        {/* Analytics / Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Package className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Total Ingredients
                </p>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">{totalItems}</h3>
            </div>
            </div>

            <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Low Stock Alert
                </p>
                <h3 className="text-lg font-bold text-amber-600 mt-0.5">
                {lowStockItems.length} items
                </h3>
            </div>
            </div>

            <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex items-center gap-4 shadow-xs">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Layers className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Total Value
                </p>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                ₱{totalInventoryValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
            </div>
            </div>
        </div>

        {/* Controls & Search */}
        <div className="bg-white border border-gray-200/80 rounded-xl p-4 mb-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                type="text"
                placeholder="Search ingredient or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-emerald-500"
                >
                <option value="All">All Categories</option>
                {categories.map((cat) => (
                    <option key={cat} value={cat}>
                    {cat}
                    </option>
                ))}
                </select>
            </div>
            </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50/70 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                    <th className="px-5 py-3.5 font-semibold">Ingredient</th>
                    <th className="px-5 py-3.5 font-semibold">Category</th>
                    <th className="px-5 py-3.5 font-semibold">Stock Quantity</th>
                    <th className="px-5 py-3.5 font-semibold">Min Threshold</th>
                    <th className="px-5 py-3.5 font-semibold">Cost / Unit</th>
                    <th className="px-5 py-3.5 font-semibold">Supplier</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {filteredIngredients.map((item) => {
                    const isLowStock = item.quantity <= item.minThreshold;
                    return (
                    <tr
                        key={item.id}
                        className="hover:bg-gray-50/80 transition-colors"
                    >
                        <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-[10px] text-gray-400">{item.id}</div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{item.category}</td>
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                        {item.quantity} {item.unit}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                        {item.minThreshold} {item.unit}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-700">
                        ₱{item.costPerUnit.toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{item.supplier}</td>
                        <td className="px-5 py-3.5">
                        {isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3" /> Optimal
                            </span>
                        )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                            <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            >
                            <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                            <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        </td>
                    </tr>
                    );
                })}

                {filteredIngredients.length === 0 && (
                    <tr>
                    <td
                        colSpan={8}
                        className="px-5 py-12 text-center text-gray-400 text-xs"
                    >
                        {ingredients.length === 0
                        ? "No ingredients added yet. Click 'Add Ingredient' to get started."
                        : "No ingredients found matching your search."}
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        </div>

        {/* Add / Edit Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-sm font-bold text-gray-900">
                    {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
                </h2>
                <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                <div>
                    <label className="block text-gray-600 font-medium mb-1">Ingredient Name</label>
                    <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Whole Milk"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                    <label className="block text-gray-600 font-medium mb-1">Category</label>
                    <input
                        type="text"
                        required
                        value={formData.category}
                        onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Dairy"
                    />
                    </div>
                    <div>
                    <label className="block text-gray-600 font-medium mb-1">Unit</label>
                    <input
                        type="text"
                        required
                        value={formData.unit}
                        onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Liters, kg, Bottles"
                    />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                    <label className="block text-gray-600 font-medium mb-1">Stock Quantity</label>
                    <input
                        type="number"
                        required
                        min="0"
                        value={formData.quantity}
                        onChange={(e) =>
                        setFormData({
                            ...formData,
                            quantity: parseFloat(e.target.value) || 0,
                        })
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                    />
                    </div>
                    <div>
                    <label className="block text-gray-600 font-medium mb-1">Min Threshold</label>
                    <input
                        type="number"
                        required
                        min="0"
                        value={formData.minThreshold}
                        onChange={(e) =>
                        setFormData({
                            ...formData,
                            minThreshold: parseFloat(e.target.value) || 0,
                        })
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                    />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                    <label className="block text-gray-600 font-medium mb-1">Cost per Unit (₱)</label>
                    <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        value={formData.costPerUnit}
                        onChange={(e) =>
                        setFormData({
                            ...formData,
                            costPerUnit: parseFloat(e.target.value) || 0,
                        })
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                    />
                    </div>
                    <div>
                    <label className="block text-gray-600 font-medium mb-1">Supplier</label>
                    <input
                        type="text"
                        required
                        value={formData.supplier}
                        onChange={(e) =>
                        setFormData({ ...formData, supplier: e.target.value })
                        }
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. DairyGold Co."
                    />
                    </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 mt-4">
                    <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                    Cancel
                    </button>
                    <button
                    type="submit"
                    className={`px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors ${editingIngredient ? 'sl-save-changes-ui' : ''}`}
                    >
                    {editingIngredient ? 'Save Changes' : 'Create Ingredient'}
                    </button>
                </div>
                </form>
            </div>
            </div>
        )}
        </div>
    );
    }