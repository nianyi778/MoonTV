/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Clover, Film, Home, Menu, Search, Star, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { useSite } from './SiteProvider';

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
});

export const useSidebar = () => useContext(SidebarContext);

// 可替换为你自己的 logo 图片
const Logo = () => {
  const { siteName } = useSite();
  return (
    <Link
      href='/'
      className='flex items-center gap-2 select-none hover:opacity-80 transition-opacity duration-200'
    >
      <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow'>
        <span className='text-white font-bold text-sm'>M</span>
      </div>
      <span className='text-xl font-bold bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent'>
        {siteName}
      </span>
    </Link>
  );
};

interface SidebarProps {
  onToggle?: (collapsed: boolean) => void;
  activePath?: string;
}

// 在浏览器环境下通过全局变量缓存折叠状态，避免组件重新挂载时出现初始值闪烁
declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
  }
}

const Sidebar = ({ onToggle, activePath = '/' }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 若同一次 SPA 会话中已经读取过折叠状态，则直接复用，避免闪烁
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.__sidebarCollapsed === 'boolean'
    ) {
      return window.__sidebarCollapsed;
    }
    return false; // 默认展开
  });

  // 首次挂载时读取 localStorage，以便刷新后仍保持上次的折叠状态
  useLayoutEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      const val = JSON.parse(saved);
      setIsCollapsed(val);
      window.__sidebarCollapsed = val;
    }
  }, []);

  // 当折叠状态变化时，同步到 <html> data 属性，供首屏 CSS 使用
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCollapsed) {
        document.documentElement.dataset.sidebarCollapsed = 'true';
      } else {
        delete document.documentElement.dataset.sidebarCollapsed;
      }
    }
  }, [isCollapsed]);

  const [active, setActive] = useState(activePath);

  useEffect(() => {
    // 优先使用传入的 activePath
    if (activePath) {
      setActive(activePath);
    } else {
      // 否则使用当前路径
      const getCurrentFullPath = () => {
        const queryString = searchParams.toString();
        return queryString ? `${pathname}?${queryString}` : pathname;
      };
      const fullPath = getCurrentFullPath();
      setActive(fullPath);
    }
  }, [activePath, pathname, searchParams]);

  const handleToggle = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    if (typeof window !== 'undefined') {
      window.__sidebarCollapsed = newState;
    }
    onToggle?.(newState);
  }, [isCollapsed, onToggle]);

  const handleSearchClick = useCallback(() => {
    router.push('/search');
  }, [router]);

  const contextValue = {
    isCollapsed,
  };

  const [menuItems, setMenuItems] = useState([
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
      setMenuItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        },
      ]);
    }
  }, []);

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* 在移动端隐藏侧边栏 */}
      <div className='hidden md:flex'>
        <aside
          data-sidebar
          className={`fixed top-0 left-0 h-screen glass transition-all duration-300 ease-out z-10 ${
            isCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          <div className='flex h-full flex-col'>
            {/* 顶部 Logo 区域 */}
            <div className='relative h-16 flex items-center justify-between px-4'>
              <div
                className={`flex items-center transition-all duration-300 ${
                  isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                }`}
              >
                {!isCollapsed && <Logo />}
              </div>
              <button
                onClick={handleToggle}
                className={`flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-all duration-200 ${
                  isCollapsed ? 'mx-auto' : ''
                }`}
              >
                <Menu className='h-5 w-5' />
              </button>
            </div>

            {/* 分隔线 */}
            <div className='mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent' />

            {/* 首页和搜索导航 */}
            <nav className='px-3 mt-6 space-y-2'>
              <Link
                href='/'
                onClick={() => setActive('/')}
                className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all duration-200 ${
                  active === '/'
                    ? 'bg-brand-500 text-white shadow-glow'
                    : 'text-gray-400 hover:bg-white/10'
                } ${isCollapsed ? 'justify-center px-3' : ''}`}
              >
                <Home
                  className={`h-5 w-5 flex-shrink-0 ${
                    active === '/'
                      ? 'text-white'
                      : 'text-gray-400 group-hover:text-brand-500'
                  }`}
                />
                {!isCollapsed && <span className='text-sm'>首页</span>}
              </Link>
              <Link
                href='/search'
                onClick={(e) => {
                  e.preventDefault();
                  handleSearchClick();
                  setActive('/search');
                }}
                className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all duration-200 ${
                  active === '/search'
                    ? 'bg-brand-500 text-white shadow-glow'
                    : 'text-gray-400 hover:bg-white/10'
                } ${isCollapsed ? 'justify-center px-3' : ''}`}
              >
                <Search
                  className={`h-5 w-5 flex-shrink-0 ${
                    active === '/search'
                      ? 'text-white'
                      : 'text-gray-400 group-hover:text-brand-500'
                  }`}
                />
                {!isCollapsed && <span className='text-sm'>搜索</span>}
              </Link>
            </nav>

            {/* 分类标题 */}
            {!isCollapsed && (
              <div className='px-6 mt-8 mb-2'>
                <span className='text-xs font-semibold uppercase tracking-wider text-gray-500'>
                  发现
                </span>
              </div>
            )}

            {/* 菜单项 */}
            <div className='flex-1 overflow-y-auto px-3'>
              <div className='space-y-2'>
                {menuItems.map((item) => {
                  const typeMatch = item.href.match(/type=([^&]+)/)?.[1];
                  const decodedActive = decodeURIComponent(active);
                  const decodedItemHref = decodeURIComponent(item.href);
                  const isActive =
                    decodedActive === decodedItemHref ||
                    (decodedActive.startsWith('/douban') &&
                      decodedActive.includes(`type=${typeMatch}`));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setActive(item.href)}
                      className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-brand-500 text-white shadow-glow'
                          : 'text-gray-400 hover:bg-white/10'
                      } ${isCollapsed ? 'justify-center px-3' : ''}`}
                    >
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${
                          isActive
                            ? 'text-white'
                            : 'text-gray-400 group-hover:text-brand-500'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className='text-sm'>{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 底部装饰 */}
            <div className='p-4'>
              <div className='h-1 rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 opacity-50' />
            </div>
          </div>
        </aside>
        <div
          className={`transition-all duration-300 ease-out sidebar-offset ${
            isCollapsed ? 'w-20' : 'w-64'
          }`}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
