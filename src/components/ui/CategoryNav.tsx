'use client';

// 豆瓣电影分类映射
const categories = [
  { id: 'all', name: '全部', doubanCategory: '热门', doubanType: '全部' },
  { id: 'action', name: '动作', doubanCategory: '动作', doubanType: '动作' },
  { id: 'scifi', name: '科幻', doubanCategory: '科幻', doubanType: '科幻' },
  { id: 'comedy', name: '喜剧', doubanCategory: '喜剧', doubanType: '喜剧' },
  { id: 'drama', name: '剧情', doubanCategory: '剧情', doubanType: '剧情' },
  { id: 'romance', name: '爱情', doubanCategory: '爱情', doubanType: '爱情' },
  { id: 'horror', name: '恐怖', doubanCategory: '恐怖', doubanType: '恐怖' },
  { id: 'animation', name: '动画', doubanCategory: '动画', doubanType: '动画' },
  {
    id: 'documentary',
    name: '纪录片',
    doubanCategory: '纪录片',
    doubanType: '纪录片',
  },
];

export interface CategoryInfo {
  id: string;
  name: string;
  doubanCategory: string;
  doubanType: string;
}

interface CategoryNavProps {
  activeId?: string;
  onCategoryChange?: (category: CategoryInfo) => void;
}

export function CategoryNav({
  activeId = 'all',
  onCategoryChange,
}: CategoryNavProps) {
  const handleCategoryClick = (category: (typeof categories)[0]) => {
    onCategoryChange?.(category);
  };

  return (
    <div className='container mx-auto px-4 py-6'>
      <div className='flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide'>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeId === category.id
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export { categories };
