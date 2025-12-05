/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Bell, Menu, Search, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useSite } from './SiteProvider';
import { UserMenu } from './UserMenu';

interface TopNavProps {
  transparent?: boolean;
}

export default function TopNav({ transparent = true }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { siteName } = useSite();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 监听滚动
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: '首页', href: '/' },
    { label: '电影', href: '/douban?type=movie' },
    { label: '电视剧', href: '/douban?type=tv' },
    { label: '动漫', href: '/douban?type=show' },
    { label: '我的片单', href: '/?tab=favorites' },
  ];

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') {
        return pathname === '/' && !href.includes('tab=favorites');
      }
      return pathname.startsWith(href.split('?')[0]);
    },
    [pathname]
  );

  const handleSearch = useCallback(() => {
    router.push('/search');
  }, [router]);

  return (
    <>
      {/* 主导航 */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled || !transparent
            ? 'bg-[#0a0a0a]/95 backdrop-blur-xl shadow-lg'
            : 'bg-gradient-to-b from-black/80 to-transparent'
        }`}
      >
        <nav className='flex items-center justify-between px-4 md:px-8 lg:px-12 h-16'>
          {/* Logo */}
          <div className='flex items-center gap-8'>
            <Link
              href='/'
              className='text-2xl font-bold text-brand-500 tracking-tight hover:opacity-80 transition-opacity'
            >
              {siteName || 'CineStream'}
            </Link>

            {/* 桌面端导航链接 */}
            <ul className='hidden md:flex items-center gap-1'>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      isActive(link.href)
                        ? 'text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 右侧操作 */}
          <div className='flex items-center gap-3'>
            {/* 搜索按钮 */}
            <button
              onClick={handleSearch}
              className='w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors'
            >
              <Search className='w-5 h-5' />
            </button>

            {/* 通知按钮 - 装饰性 */}
            <button className='hidden md:flex w-10 h-10 items-center justify-center text-gray-400 hover:text-white transition-colors'>
              <Bell className='w-5 h-5' />
            </button>

            {/* 用户菜单 */}
            <div className='hidden md:block'>
              <UserMenu />
            </div>

            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className='md:hidden w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors'
            >
              <Menu className='w-6 h-6' />
            </button>
          </div>
        </nav>
      </header>

      {/* 移动端抽屉菜单 */}
      {isMobileMenuOpen && (
        <div className='fixed inset-0 z-[100] md:hidden'>
          {/* 遮罩 */}
          <div
            className='absolute inset-0 bg-black/60 backdrop-blur-sm'
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* 抽屉 */}
          <div className='absolute right-0 top-0 bottom-0 w-72 bg-[#141414] shadow-2xl animate-slide-in-right'>
            <div className='flex items-center justify-between p-4 border-b border-white/10'>
              <span className='text-lg font-bold text-white'>菜单</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className='w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors'
              >
                <X className='w-6 h-6' />
              </button>
            </div>

            <nav className='p-4'>
              <ul className='space-y-2'>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                        isActive(link.href)
                          ? 'bg-brand-500/20 text-brand-500'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className='mt-6 pt-6 border-t border-white/10'>
                <Link
                  href='/search'
                  onClick={() => setIsMobileMenuOpen(false)}
                  className='flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
                >
                  <Search className='w-5 h-5' />
                  搜索
                </Link>
                <Link
                  href='/login'
                  onClick={() => setIsMobileMenuOpen(false)}
                  className='flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
                >
                  <User className='w-5 h-5' />
                  账户
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
