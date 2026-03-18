import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, sujetThese } = await req.json();

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `Tu es un assistant académique spécialisé en recherche doctorale. ${sujetThese ? `Le sujet de thèse de l'étudiant est : "${sujetThese}".` : ''}
Tu aides l'étudiant à comprendre des concepts, explorer sa bibliographie, structurer ses idées, formuler des hypothèses et trouver des pistes de recherche.
Sois précis, bienveillant et utilise un vocabulaire académique en français.`,
    messages,
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
