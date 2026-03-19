import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

interface ParsedSlide {
  title: string;
  bullets: string[];
  references?: string;
  notes?: string;
}

function parseContenu(markdown: string): ParsedSlide[] {
  const slides: ParsedSlide[] = [];

  // Trouver les sections principales
  const planStart = markdown.search(/^# Plan de présentation/im);
  const notesStart = markdown.search(/^# Notes pour le discours/im);
  const conseilsStart = markdown.search(/^# Conseils/im);

  const planText = planStart >= 0
    ? markdown.slice(planStart, notesStart > planStart ? notesStart : undefined)
    : markdown;

  // Extraire chaque diapositive
  const parts = planText.split(/(?=^## Diapositive)/im);

  for (const part of parts) {
    const titleMatch = part.match(/^## Diapositive \d+\s*[—–\-]\s*(.+)$/im);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const bullets = [...part.matchAll(/^[-•*]\s+(.+)$/gm)].map((m) => m[1].trim());
    const refsMatch = part.match(/\*\*Références[^*]*\*\*[:\s]*(.+)/i);
    const references = refsMatch?.[1]?.replace(/\*/g, '').trim();

    slides.push({
      title,
      bullets,
      references: references && !references.toLowerCase().includes('aucune') ? references : undefined,
    });
  }

  // Extraire les notes et les associer aux slides
  if (notesStart >= 0) {
    const notesEnd = conseilsStart > notesStart ? conseilsStart : undefined;
    const notesText = markdown.slice(notesStart, notesEnd);
    const noteParts = notesText.split(/(?=^## )/m).filter((p) => p.trim() && !p.startsWith('# Notes'));

    noteParts.forEach((part, i) => {
      if (slides[i]) {
        const noteText = part.replace(/^## [^\n]+\n/m, '').trim();
        if (noteText) slides[i].notes = noteText;
      }
    });
  }

  return slides;
}

export async function POST(req: NextRequest) {
  const { contenu, sujet, auteur } = await req.json();

  if (!contenu) {
    return NextResponse.json({ error: 'Contenu requis' }, { status: 400 });
  }

  const slides = parseContenu(contenu);

  if (slides.length === 0) {
    return NextResponse.json({ error: 'Aucune diapositive trouvée dans le contenu' }, { status: 400 });
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = auteur ?? 'MaThèse';
  pptx.subject = sujet ?? '';
  pptx.title = sujet ?? 'Présentation MaThèse';

  // Couleurs
  const INDIGO = '4F46E5';
  const VIOLET = '7C3AED';
  const WHITE = 'FFFFFF';
  const DARK = '111827';
  const GRAY = '6B7280';
  const LIGHT = 'F5F3FF';

  // ── Diapositive de titre ──────────────────────────────────────────
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: INDIGO };

  // Bande décorative en bas
  titleSlide.addShape('rect' as Parameters<typeof titleSlide.addShape>[0], {
    x: 0, y: 6.5, w: 10, h: 1.13,
    fill: { color: VIOLET },
    line: { color: VIOLET, width: 0 },
  });

  // Accent ligne blanche
  titleSlide.addShape('rect' as Parameters<typeof titleSlide.addShape>[0], {
    x: 3.5, y: 2.0, w: 3, h: 0.04,
    fill: { color: 'C4B5FD' },
    line: { color: 'C4B5FD', width: 0 },
  });

  titleSlide.addText(sujet ?? 'Présentation', {
    x: 0.8, y: 2.3, w: 8.4, h: 2.8,
    fontSize: slides.length > 0 && (sujet ?? '').length > 60 ? 28 : 36,
    bold: true, color: WHITE,
    align: 'center', valign: 'middle',
    wrap: true,
  });

  titleSlide.addText('Agent IA de MaThèse', {
    x: 0.8, y: 5.5, w: 8.4, h: 0.5,
    fontSize: 13, color: 'C4B5FD',
    align: 'center', italic: true,
  });

  titleSlide.addText(
    new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }),
    { x: 0.8, y: 6.05, w: 8.4, h: 0.4, fontSize: 11, color: 'A5B4FC', align: 'center' }
  );

  // ── Diapositives de contenu ───────────────────────────────────────
  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: WHITE };

    // Bande de titre en haut
    s.addShape('rect' as Parameters<typeof s.addShape>[0], {
      x: 0, y: 0, w: 10, h: 1.15,
      fill: { color: INDIGO },
      line: { color: INDIGO, width: 0 },
    });

    // Accent violet à droite du titre
    s.addShape('rect' as Parameters<typeof s.addShape>[0], {
      x: 9.5, y: 0, w: 0.5, h: 1.15,
      fill: { color: VIOLET },
      line: { color: VIOLET, width: 0 },
    });

    // Titre de la diapositive
    s.addText(slide.title, {
      x: 0.3, y: 0.12, w: 9.0, h: 0.9,
      fontSize: 22, bold: true, color: WHITE,
      valign: 'middle',
    });

    // Bullets
    if (slide.bullets.length > 0) {
      const hasRefs = !!slide.references;
      const bulletH = hasRefs ? 4.5 : 5.0;

      const bulletItems = slide.bullets.map((b, i) => ({
        text: b,
        options: {
          bullet: { type: 'bullet' as const, code: '25CF', indent: 15 },
          color: i === 0 ? DARK : '374151',
          fontSize: slide.bullets.length > 6 ? 14 : 17,
          paraSpaceAfter: slide.bullets.length > 6 ? 4 : 8,
        },
      }));

      s.addText(bulletItems, {
        x: 0.5, y: 1.3, w: 9.0, h: bulletH,
        valign: 'top',
        lineSpacingMultiple: 1.25,
      });
    }

    // Zone des références
    if (slide.references) {
      s.addShape('rect' as Parameters<typeof s.addShape>[0], {
        x: 0, y: 6.4, w: 10, h: 1.13,
        fill: { color: LIGHT },
        line: { color: 'DDD6FE', width: 1 },
      });
      s.addText(`📚 ${slide.references}`, {
        x: 0.3, y: 6.45, w: 9.4, h: 0.6,
        fontSize: 9, color: '5B21B6', italic: true, wrap: true,
      });
    }

    // Numéro de diapositive
    s.addText(`${slides.indexOf(slide) + 1} / ${slides.length}`, {
      x: 9.0, y: 7.1, w: 0.8, h: 0.3,
      fontSize: 8, color: GRAY, align: 'right',
    });

    // Notes du discours
    if (slide.notes) {
      s.addNotes(slide.notes);
    }
  }

  // ── Diapositive de conclusion ─────────────────────────────────────
  const endSlide = pptx.addSlide();
  endSlide.background = { color: INDIGO };
  endSlide.addShape('rect' as Parameters<typeof endSlide.addShape>[0], {
    x: 3.5, y: 3.3, w: 3, h: 0.04,
    fill: { color: 'C4B5FD' },
    line: { color: 'C4B5FD', width: 0 },
  });
  endSlide.addText('Merci pour votre attention', {
    x: 0.8, y: 2.0, w: 8.4, h: 1.5,
    fontSize: 32, bold: true, color: WHITE, align: 'center', valign: 'middle',
  });
  endSlide.addText('Questions & Discussion', {
    x: 0.8, y: 3.8, w: 8.4, h: 0.8,
    fontSize: 18, color: 'C4B5FD', align: 'center',
  });
  if (auteur) {
    endSlide.addText(auteur, {
      x: 0.8, y: 5.2, w: 8.4, h: 0.5,
      fontSize: 13, color: 'A5B4FC', align: 'center', italic: true,
    });
  }

  // Générer le buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="presentation-mathese.pptx"`,
    },
  });
}
