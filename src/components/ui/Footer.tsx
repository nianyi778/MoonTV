'use client';

import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className='bg-zinc-950 border-t border-zinc-800'>
      <div className='container mx-auto px-4 py-12'>
        {/* 主要内容 */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-8 mb-12'>
          {/* 关于我们 */}
          <div>
            <h4 className='text-white font-semibold mb-4'>关于我们</h4>
            <ul className='space-y-2'>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  公司简介
                </Link>
              </li>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  联系我们
                </Link>
              </li>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  加入我们
                </Link>
              </li>
            </ul>
          </div>

          {/* 帮助中心 */}
          <div>
            <h4 className='text-white font-semibold mb-4'>帮助中心</h4>
            <ul className='space-y-2'>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  常见问题
                </Link>
              </li>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  用户协议
                </Link>
              </li>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  隐私政策
                </Link>
              </li>
            </ul>
          </div>

          {/* 产品服务 */}
          <div>
            <h4 className='text-white font-semibold mb-4'>产品服务</h4>
            <ul className='space-y-2'>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  会员服务
                </Link>
              </li>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  客户端下载
                </Link>
              </li>
              <li>
                <Link
                  href='#'
                  className='text-zinc-400 hover:text-white text-sm transition-colors'
                >
                  广告合作
                </Link>
              </li>
            </ul>
          </div>

          {/* 社交媒体 */}
          <div>
            <h4 className='text-white font-semibold mb-4'>关注我们</h4>
            <div className='flex items-center gap-3'>
              <Link
                href='#'
                className='w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all'
              >
                <Twitter className='w-4 h-4' />
              </Link>
              <Link
                href='#'
                className='w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all'
              >
                <Youtube className='w-4 h-4' />
              </Link>
              <Link
                href='#'
                className='w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all'
              >
                <Instagram className='w-4 h-4' />
              </Link>
              <Link
                href='#'
                className='w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all'
              >
                <Facebook className='w-4 h-4' />
              </Link>
            </div>
          </div>
        </div>

        {/* 底部版权 */}
        <div className='pt-8 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4'>
          <p className='text-zinc-500 text-sm'>
            © {new Date().getFullYear()} CineStream. All rights reserved.
          </p>
          <div className='flex items-center gap-4'>
            <Link
              href='#'
              className='text-zinc-500 hover:text-zinc-300 text-sm transition-colors'
            >
              服务条款
            </Link>
            <Link
              href='#'
              className='text-zinc-500 hover:text-zinc-300 text-sm transition-colors'
            >
              隐私政策
            </Link>
            <Link
              href='#'
              className='text-zinc-500 hover:text-zinc-300 text-sm transition-colors'
            >
              Cookie 设置
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
