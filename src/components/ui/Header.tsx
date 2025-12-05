'use client';

import { Bell, Menu, Search, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { openLoginModal } from '@/components/LoginModal';
import { useSite } from '@/components/SiteProvider';
import { UserMenu } from '@/components/UserMenu';

interface HeaderProps {
  transparent?: boolean;
}

export function Header({ transparent = true }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { siteName } = useSite();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 检查登录状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = getAuthInfoFromBrowserCookie();
      setIsLoggedIn(!!auth?.username);
    }
  }, []);

  // 监听滚动
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const baseNavLinks = [
    { label: '首页', href: '/' },
    { label: '电影', href: '/douban?type=movie' },
    { label: '电视剧', href: '/douban?type=tv' },
    { label: '动漫', href: '/douban?type=show' },
  ];

  // 只有登录时才显示"我的片单"
  const navLinks = isLoggedIn
    ? [...baseNavLinks, { label: '我的片单', href: '/favorites' }]
    : baseNavLinks;

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') {
        return pathname === '/';
      }
      return pathname.startsWith(href.split('?')[0]);
    },
    [pathname]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        router.push(
          `/search?keyword=${encodeURIComponent(searchQuery.trim())}`
        );
        setIsSearchExpanded(false);
        setSearchQuery('');
      }
    },
    [router, searchQuery]
  );

  return (
    <>
      {/* 主导航 */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled || !transparent
            ? 'bg-zinc-950/95 backdrop-blur-xl shadow-lg'
            : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
        }`}
      >
        <nav className='flex items-center justify-between px-4 md:px-8 lg:px-12 h-16'>
          {/* Logo */}
          <div className='flex items-center gap-8'>
            <Link
              href='/'
              className='text-2xl font-bold text-orange-500 tracking-tight hover:opacity-80 transition-opacity'
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
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 右侧操作 */}
          <div className='flex items-center gap-2'>
            {/* 搜索框 */}
            <form onSubmit={handleSearch} className='relative'>
              <div
                className={`flex items-center transition-all duration-300 ${
                  isSearchExpanded ? 'w-64' : 'w-10'
                }`}
              >
                <button
                  type='button'
                  onClick={() => {
                    if (isSearchExpanded && searchQuery.trim()) {
                      router.push(
                        `/search?keyword=${encodeURIComponent(
                          searchQuery.trim()
                        )}`
                      );
                    } else {
                      setIsSearchExpanded(!isSearchExpanded);
                    }
                  }}
                  className='absolute left-0 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-10'
                >
                  <Search className='w-5 h-5' />
                </button>
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='搜索...'
                  className={`w-full h-10 pl-10 pr-4 bg-zinc-800/80 border border-zinc-700 rounded-full text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 transition-all ${
                    isSearchExpanded
                      ? 'opacity-100'
                      : 'opacity-0 pointer-events-none'
                  }`}
                  onBlur={() => {
                    if (!searchQuery.trim()) {
                      setIsSearchExpanded(false);
                    }
                  }}
                />
              </div>
            </form>

            {/* 通知按钮 */}
            <button className='hidden md:flex w-10 h-10 items-center justify-center text-zinc-400 hover:text-white transition-colors'>
              <Bell className='w-5 h-5' />
            </button>

            {/* 用户菜单 */}
            <div className='hidden md:block'>
              {isLoggedIn ? (
                <UserMenu />
              ) : (
                <button
                  onClick={() => openLoginModal()}
                  className='flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors'
                >
                  <User className='w-4 h-4' />
                  登录
                </button>
              )}
            </div>

            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className='md:hidden w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors'
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
          <div className='absolute right-0 top-0 bottom-0 w-72 bg-zinc-900 shadow-2xl'>
            {/* 抽屉头部 */}
            <div className='flex items-center justify-between p-4 border-b border-zinc-800'>
              <span className='text-lg font-semibold text-white'>菜单</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className='w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white'
              >
                <X className='w-6 h-6' />
              </button>
            </div>

            {/* 抽屉内容 */}
            <div className='p-4'>
              {/* 搜索框 */}
              <form onSubmit={handleSearch} className='mb-6'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400' />
                  <input
                    type='text'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='搜索电影、电视剧...'
                    className='w-full h-11 pl-10 pr-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500'
                  />
                </div>
              </form>

              {/* 导航链接 */}
              <nav className='space-y-1'>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-orange-500/10 text-orange-500'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {/* 用户操作 */}
              <div className='mt-6 pt-6 border-t border-zinc-800'>
                {isLoggedIn ? (
                  <UserMenu />
                ) : (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openLoginModal();
                    }}
                    className='flex items-center justify-center gap-2 w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors'
                  >
                    <User className='w-5 h-5' />
                    登录 / 注册
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
