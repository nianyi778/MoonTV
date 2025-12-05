'use client';

import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import Link from 'next/link';

import { useSite } from './SiteProvider';

export default function Footer() {
  const { siteName } = useSite();

  const footerLinks = {
    browse: [
      { label: '电影', href: '/douban?type=movie' },
      { label: '电视剧', href: '/douban?type=tv' },
      { label: '动漫', href: '/douban?type=show' },
      { label: '纪录片', href: '/douban?type=documentary' },
    ],
    help: [
      { label: '常见问题', href: '#' },
      { label: '联系我们', href: '#' },
      { label: '隐私政策', href: '#' },
      { label: '服务条款', href: '#' },
    ],
    account: [
      { label: '我的账户', href: '/login' },
      { label: '观看历史', href: '/' },
      { label: '我的片单', href: '/favorites' },
      { label: '会员订阅', href: '#' },
    ],
  };

  return (
    <footer className='bg-[#141414] border-t border-white/5 mt-16'>
      <div className='px-[5%] py-12'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12'>
          {/* Logo和描述 */}
          <div className='lg:col-span-1'>
            <Link href='/' className='text-2xl font-bold text-brand-500'>
              {siteName || 'CineStream'}
            </Link>
            <p className='mt-4 text-sm text-gray-500 leading-relaxed'>
              发现和观看最新热门电影，提供高清流媒体播放体验。
            </p>
            <div className='flex gap-3 mt-6'>
              <a
                href='#'
                className='w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-brand-500 hover:text-white transition-all'
              >
                <Facebook className='w-4 h-4' />
              </a>
              <a
                href='#'
                className='w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-brand-500 hover:text-white transition-all'
              >
                <Twitter className='w-4 h-4' />
              </a>
              <a
                href='#'
                className='w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-brand-500 hover:text-white transition-all'
              >
                <Instagram className='w-4 h-4' />
              </a>
              <a
                href='#'
                className='w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-brand-500 hover:text-white transition-all'
              >
                <Youtube className='w-4 h-4' />
              </a>
            </div>
          </div>

          {/* 浏览 */}
          <div>
            <h3 className='text-base font-semibold text-white mb-4'>浏览</h3>
            <ul className='space-y-3'>
              {footerLinks.browse.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className='text-sm text-gray-500 hover:text-white transition-colors'
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 帮助 */}
          <div>
            <h3 className='text-base font-semibold text-white mb-4'>帮助</h3>
            <ul className='space-y-3'>
              {footerLinks.help.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className='text-sm text-gray-500 hover:text-white transition-colors'
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 账户 */}
          <div>
            <h3 className='text-base font-semibold text-white mb-4'>账户</h3>
            <ul className='space-y-3'>
              {footerLinks.account.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className='text-sm text-gray-500 hover:text-white transition-colors'
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 底部版权 */}
        <div className='pt-8 border-t border-white/5 text-center'>
          <p className='text-sm text-gray-600'>
            © {new Date().getFullYear()} {siteName || 'CineStream'}.
            保留所有权利。
          </p>
        </div>
      </div>
    </footer>
  );
}
