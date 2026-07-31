'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User as UserIcon, Lock, Shield, Clock, Star, Heart, Loader2, Save } from 'lucide-react';

export function ProfileView() {
  const { token, user, showToast, setAuth } = useStore();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setProfile(data);
          setName(data.name);
          setEmail(data.email);
        }
      })
      .catch(() => {});
  }, [token]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      showToast(data.message, 'success');
      if (data.user && user) {
        setAuth(token!, { ...user, name: data.user.name, email: data.user.email });
      }
    } catch { showToast('خطأ في التحديث', 'error'); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      showToast(data.message, 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch { showToast('خطأ في تغيير كلمة المرور', 'error'); }
    finally { setPasswordLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <UserIcon className="w-6 h-6" />
        الملف الشخصي
      </h1>

      {/* Stats Cards */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'المشاهدات', value: profile.historyCount, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'التقييمات', value: profile.ratingsCount, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { label: 'المفضلة', value: profile.favoritesCount, icon: Heart, color: 'text-[#e50914]', bg: 'bg-[#e50914]/10' },
            { label: 'الصلاحية', value: profile.role === 'admin' ? 'مدير' : 'مستخدم', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          ].map((stat, i) => (
            <Card key={i} className="border-border/50 bg-card">
              <CardContent className="p-3 text-center">
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2 mx-auto`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="font-bold text-lg">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Update Profile */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Save className="w-4 h-4" />
            تعديل المعلومات
          </h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">الاسم</Label>
              <Input id="profile-name" value={name} onChange={e => setName(e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">البريد الإلكتروني</Label>
              <Input id="profile-email" type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" disabled={loading} className="bg-[#e50914] hover:bg-[#c40812] text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4" />
            تغيير كلمة المرور
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">كلمة المرور الحالية</Label>
              <Input id="current-pw" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">كلمة المرور الجديدة</Label>
              <Input id="new-pw" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" disabled={passwordLoading} className="bg-[#e50914] hover:bg-[#c40812] text-white">
              {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تغيير كلمة المرور'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {profile && (
        <p className="text-xs text-muted-foreground text-center">
          تاريخ الانضمام: {new Date(profile.createdAt).toLocaleDateString('ar-SA')}
        </p>
      )}
    </div>
  );
}