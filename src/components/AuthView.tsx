'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tv, Loader2 } from 'lucide-react';

// ============================================================
// AUTH VIEW
// ============================================================
export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth, setView, showToast, channels, setChannels, recommendations, setRecommendations, user } = useStore();

  // Seed on mount
  useEffect(() => {
    fetch('/api/seed').then(r => r.json()).then(d => {
      console.log('Seed:', d.message);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { name, email, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      setAuth(data.token, data.user);
      showToast(`مرحباً ${data.user.name}!`, 'success');
      // Load channels
      const chRes = await fetch('/api/channels');
      const chData = await chRes.json();
      setChannels(chData);
      // Load recommendations
      const recRes = await fetch(`/api/recommendations/${data.user.id}`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData);
      }
      setView('home');
    } catch {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#1a0a10] to-[#0a0a1a]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#e50914] rounded-full blur-[150px] opacity-10" />

      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#e50914]/10 mb-4">
              <Tv className="w-8 h-8 text-[#e50914]" />
            </div>
            <h1 className="text-2xl font-bold">منصة IPTV الذكية</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {isLogin ? 'سجّل دخول للمتابعة' : 'أنشئ حساباً جديداً'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="أحمد محمد" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" dir="ltr" />
            </div>
            <Button type="submit" className="w-full bg-[#e50914] hover:bg-[#c40812] text-white h-11" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? 'تسجيل الدخول' : 'إنشاء حساب')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
            <button onClick={() => setIsLogin(!isLogin)} className="text-[#e50914] font-medium hover:underline mr-1">
              {isLogin ? 'أنشئ حساباً' : 'سجّل دخول'}
            </button>
          </div>

          {/* Demo accounts info */}
          <div className="mt-6 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-2">حسابات تجريبية:</p>
            <p>أدمن: admin@iptv.com / admin123</p>
            <p>مستخدم: ahmed@test.com / 123456</p>
            <p>مستخدم: sara@test.com / 123456</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// TOAST
// ============================================================
export function Toast() {
  const { toastMessage, toastType } = useStore();
  if (!toastMessage) return null;
  const bg = toastType === 'error' ? 'bg-destructive' : toastType === 'success' ? 'bg-green-600' : 'bg-card border';
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] toast-animate">
      <div className={`${bg} text-white px-6 py-3 rounded-lg shadow-2xl text-sm font-medium`}>
        {toastMessage}
      </div>
    </div>
  );
}
