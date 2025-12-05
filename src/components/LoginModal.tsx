/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Mail, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useSite } from '@/components/SiteProvider';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  redirectUrl?: string;
}

type AuthMode = 'login' | 'register';

export function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  redirectUrl,
}: LoginModalProps) {
  const router = useRouter();
  const { siteName } = useSite();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 配置状态
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [enableRegister, setEnableRegister] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageType = (window as any).RUNTIME_CONFIG?.STORAGE_TYPE;
      setShouldAskUsername(storageType && storageType !== 'localstorage');
      setEnableRegister(
        Boolean((window as any).RUNTIME_CONFIG?.ENABLE_REGISTER)
      );
    }
  }, []);

  // 重置表单
  const resetForm = useCallback(() => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setMode('login');
  }, []);

  // 关闭时重置
  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  // 阻止滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 登录处理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) {
      setError('请填写完整信息');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        handleClose();
        onSuccess?.();
        if (redirectUrl) {
          router.replace(redirectUrl);
        } else {
          router.refresh();
        }
      } else if (res.status === 401) {
        setError('密码错误');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 邮箱注册
  const handleEmailRegister = async () => {
    setError(null);
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    // 简单邮箱验证
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password, isEmail: true }),
      });

      if (res.ok) {
        handleClose();
        onSuccess?.();
        if (redirectUrl) {
          router.replace(redirectUrl);
        } else {
          router.refresh();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '注册失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div
      className='fixed inset-0 z-[9999] flex items-center justify-center p-4'
      onClick={handleClose}
    >
      {/* 背景遮罩 */}
      <div className='absolute inset-0 bg-black/70 backdrop-blur-sm' />

      {/* 弹窗内容 */}
      <div
        className='relative w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className='absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors z-10'
        >
          <X className='w-4 h-4 text-zinc-400' />
        </button>

        {/* 头部 */}
        <div className='px-8 pt-8 pb-4 text-center'>
          <h2 className='text-2xl font-bold text-orange-500'>{siteName}</h2>
          <p className='text-zinc-400 text-sm mt-2'>
            {mode === 'login' && '登录以享受完整功能'}
            {mode === 'register' && '使用邮箱注册新账户'}
          </p>
        </div>

        {/* 表单 */}
        <div className='px-8 pb-8'>
          <form onSubmit={handleLogin} className='space-y-4'>
            {/* 登录模式 */}
            {mode === 'login' && (
              <>
                {shouldAskUsername && (
                  <div className='relative'>
                    <User className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500' />
                    <input
                      type='text'
                      placeholder='用户名'
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className='w-full pl-12 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all'
                    />
                  </div>
                )}
                <div className='relative'>
                  <input
                    type='password'
                    placeholder='密码'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all'
                  />
                </div>
              </>
            )}

            {/* 邮箱注册模式 */}
            {mode === 'register' && (
              <>
                <div className='relative'>
                  <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500' />
                  <input
                    type='email'
                    placeholder='邮箱地址'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className='w-full pl-12 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all'
                  />
                </div>
                <div className='relative'>
                  <input
                    type='password'
                    placeholder='密码'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all'
                  />
                </div>
                <div className='relative'>
                  <input
                    type='password'
                    placeholder='确认密码'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className='w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all'
                  />
                </div>
              </>
            )}

            {/* 错误提示 */}
            {error && (
              <p className='text-sm text-red-400 text-center'>{error}</p>
            )}

            {/* 按钮 */}
            {mode === 'login' && (
              <button
                type='submit'
                disabled={
                  loading || !password || (shouldAskUsername && !username)
                }
                className='w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? '登录中...' : '登录'}
              </button>
            )}

            {mode === 'register' && (
              <button
                type='button'
                onClick={handleEmailRegister}
                disabled={loading || !password || !email}
                className='w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? '注册中...' : '注册'}
              </button>
            )}
          </form>

          {/* 模式切换 */}
          {shouldAskUsername && enableRegister && (
            <div className='mt-6 pt-6 border-t border-zinc-800'>
              {mode === 'login' && (
                <button
                  onClick={() => {
                    setError(null);
                    setMode('register');
                  }}
                  className='w-full py-2.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all flex items-center justify-center gap-2'
                >
                  <Mail className='w-4 h-4' />
                  邮箱注册
                </button>
              )}

              {mode === 'register' && (
                <button
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className='w-full py-2.5 text-sm text-zinc-400 hover:text-white transition-colors'
                >
                  已有账户？返回登录
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// 登录弹窗全局状态管理
let loginModalState = {
  isOpen: false,
  onSuccess: undefined as (() => void) | undefined,
  redirectUrl: undefined as string | undefined,
};

let loginModalListeners: Array<() => void> = [];

export function openLoginModal(options?: {
  onSuccess?: () => void;
  redirectUrl?: string;
}) {
  loginModalState = {
    isOpen: true,
    onSuccess: options?.onSuccess,
    redirectUrl: options?.redirectUrl,
  };
  loginModalListeners.forEach((listener) => listener());
}

export function closeLoginModal() {
  loginModalState = {
    isOpen: false,
    onSuccess: undefined,
    redirectUrl: undefined,
  };
  loginModalListeners.forEach((listener) => listener());
}

export function useLoginModal() {
  const [state, setState] = useState(loginModalState);

  useEffect(() => {
    const listener = () => {
      setState({ ...loginModalState });
    };
    loginModalListeners.push(listener);
    return () => {
      loginModalListeners = loginModalListeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    ...state,
    open: openLoginModal,
    close: closeLoginModal,
  };
}

// 全局登录弹窗组件（放在 layout 中）
export function GlobalLoginModal() {
  const { isOpen, onSuccess, redirectUrl, close } = useLoginModal();

  return (
    <LoginModal
      isOpen={isOpen}
      onClose={close}
      onSuccess={onSuccess}
      redirectUrl={redirectUrl}
    />
  );
}
