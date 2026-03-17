import { NextRequest, NextResponse } from 'next/server';
import { analyserChapitre } from '@/lib/claude/client';

export async function POST(req: NextRequest) {
  const { sujetThese, titreChapitre, contenu } = await req.json();

  if (!contenu) {
    return NextResponse.json({ error: 'Contenu requis' }, { status: 400 });
  }

  const analyse = await analyserChapitre(sujetThese, titreChapitre, contenu);
  return NextResponse.json({ analyse });
}
