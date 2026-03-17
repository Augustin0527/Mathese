import { NextRequest, NextResponse } from 'next/server';
import { resumeArticle } from '@/lib/claude/client';

export async function POST(req: NextRequest) {
  const { titre, contenu } = await req.json();

  if (!titre || !contenu) {
    return NextResponse.json({ error: 'Titre et contenu requis' }, { status: 400 });
  }

  const resume = await resumeArticle(titre, contenu);
  return NextResponse.json({ resume });
}
