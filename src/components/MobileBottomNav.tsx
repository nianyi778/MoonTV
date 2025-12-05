/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Clover, Film, Home, Search, Star, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const pathname = usePathname();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  const [navItems, setNavItems] = useState([
    { icon: Home, label: '首页', href: '/' },
    { icon: Search, label: '搜索', href: '/search' },
    {
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
    },
    {
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
    },
    {
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
    },
  ]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setNavItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        },
      ]);
    }
  }, []);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <nav
      className='md:hidden fixed left-0 right-0 z-[600] glass'
      style={{
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 'calc(4rem + env(safe-area-inset-bottom))',
      }}
    >
      <ul className='flex items-center justify-around px-2'>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className='flex-1'>
              <Link
                href={item.href}
                className='relative flex flex-col items-center justify-center w-full py-2 gap-1'
              >
                {/* 激活指示器 */}
                {active && (
                  <div className='absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-brand-500' />
                )}
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                    active ? 'bg-brand-500/20' : 'hover:bg-white/10'
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 transition-colors duration-200 ${
                      active ? 'text-brand-500' : 'text-gray-400'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    active ? 'text-brand-500' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
