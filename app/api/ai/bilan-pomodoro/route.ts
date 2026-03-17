import { NextRequest, NextResponse } from 'next/server';
import { bilanPomodoro } from '@/lib/claude/client';

export async function POST(req: NextRequest) {
  const { objectif, accomplissements, blocages } = await req.json();

  if (!accomplissements) {
    return NextResponse.json({ error: 'Accomplissements requis' }, { status: 400 });
  }

  const bilan = await bilanPomodoro(objectif, accomplissements, blocages);
  return NextResponse.json({ bilan });
}
