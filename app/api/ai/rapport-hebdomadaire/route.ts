import { NextRequest, NextResponse } from 'next/server';
import { rapportHebdomadaire } from '@/lib/claude/client';

export async function POST(req: NextRequest) {
  const { nomEtudiant, journaux } = await req.json();

  if (!nomEtudiant || !journaux?.length) {
    return NextResponse.json({ error: 'Données insuffisantes' }, { status: 400 });
  }

  const rapport = await rapportHebdomadaire(nomEtudiant, journaux);
  return NextResponse.json({ rapport });
}
