import { NextRequest, NextResponse } from 'next/server';
import { traduireEnFrancais } from '@/lib/claude/client';

export async function POST(req: NextRequest) {
  const { texte } = await req.json();
  if (!texte) return NextResponse.json({ error: 'Texte requis' }, { status: 400 });
  const traduction = await traduireEnFrancais(texte);
  return NextResponse.json({ traduction });
}
