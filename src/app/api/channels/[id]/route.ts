import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const channel = await db.channel.findUnique({ where: { id: parseInt(id) } });
    if (!channel) return NextResponse.json({ error: 'القناة غير موجودة' }, { status: 404 });
    return NextResponse.json(channel);
  } catch (error) {
    console.error('Get channel error:', error);
    return NextResponse.json({ error: 'خطأ في جلب القناة' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 });
    }

    const { id } = await params;
    const data = await req.json();

    const channel = await db.channel.update({
      where: { id: parseInt(id) },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.category && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.streamUrl !== undefined && { streamUrl: data.streamUrl }),
      },
    });

    return NextResponse.json(channel);
  } catch (error) {
    console.error('Update channel error:', error);
    return NextResponse.json({ error: 'خطأ في تعديل القناة' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 });
    }

    const { id } = await params;
    await db.channel.delete({ where: { id: parseInt(id) } });

    return NextResponse.json({ message: 'تم حذف القناة بنجاح' });
  } catch (error) {
    console.error('Delete channel error:', error);
    return NextResponse.json({ error: 'خطأ في حذف القناة' }, { status: 500 });
  }
}
