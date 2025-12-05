/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Clapperboard, Heart, Home, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: '/search' },
    { icon: Clapperboard, label: '电影', href: '/douban?type=movie' },
    { icon: Tv, label: '剧集', href: '/douban?type=tv' },
    { icon: Heart, label: '收藏', href: '/favorites' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href.includes('?')) {
      return pathname.startsWith(href.split('?')[0]);
    }
    return pathname === href;
  };

  return (
    <nav className='md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5'>
      <div
        className='flex justify-around items-center px-2'
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className='flex flex-col items-center py-2 px-3'
            >
              <item.icon
                className={`w-5 h-5 mb-1 transition-colors ${
                  active ? 'text-brand-500' : 'text-gray-500'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  active ? 'text-brand-500' : 'text-gray-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
