import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const { error } = await supabase.from('utilisateurs').select('id', { count: 'exact', head: true });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message, details: error.details, hint: error.hint, code: error.code }, { status: 500 });
  }
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
