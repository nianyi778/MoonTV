'use client';

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onChange: (category: string) => void;
}

export default function CategoryTabs({
  categories,
  activeCategory,
  onChange,
}: CategoryTabsProps) {
  return (
    <div className='flex gap-3 overflow-x-auto py-4 scrollbar-hide'>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onChange(category)}
          className={`px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
            activeCategory === category
              ? 'bg-brand-500 text-white shadow-glow'
              : 'bg-transparent text-gray-400 border border-white/10 hover:text-white hover:border-white/30'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
