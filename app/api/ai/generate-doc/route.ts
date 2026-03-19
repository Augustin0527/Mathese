import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageOrientation, convertInchesToTwip,
  ShadingType, Header, Footer, PageNumber, NumberFormat,
  UnderlineType,
} from 'docx';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleRef {
  titre: string;
  auteurs?: string;
  annee?: string;
  doi?: string | null;
  abstract?: string | null;
}

// ─── Parseur Markdown → blocs ────────────────────────────────────────────────

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'bullet'; text: string; depth: number }
  | { type: 'ordered'; text: string; index: number }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code'; code: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' };

interface InlineRun { text: string; bold?: boolean; italic?: boolean; code?: boolean }

function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1]) runs.push({ text: m[2], bold: true });
    else if (m[3]) runs.push({ text: m[4], italic: true });
    else if (m[5]) runs.push({ text: m[6], code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.filter((r) => r.text);
}

function parseMarkdown(md: string): Block[] {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith('## '))  { blocks.push({ type: 'h2', text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith('# '))   { blocks.push({ type: 'h1', text: line.slice(2).trim() }); i++; continue; }
    if (/^---+$/.test(line.trim())) { blocks.push({ type: 'hr' }); i++; continue; }
    if (line.startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++;
      blocks.push({ type: 'code', code: codeLines.join('\n') });
      continue;
    }
    if (line.startsWith('> ')) { blocks.push({ type: 'blockquote', text: line.slice(2).trim() }); i++; continue; }
    if (line.includes('|') && lines[i + 1]?.includes('|') && lines[i + 1]?.match(/^\|[-| :]+\|/)) {
      const headers = line.split('|').map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map((c) => c.trim()).filter(Boolean));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', text: bulletMatch[2].trim(), depth: Math.floor(bulletMatch[1].length / 2) });
      i++; continue;
    }
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      blocks.push({ type: 'ordered', text: orderedMatch[2].trim(), index: Number(orderedMatch[1]) });
      i++; continue;
    }
    if (line.trim()) blocks.push({ type: 'paragraph', runs: parseInline(line.trim()) });
    i++;
  }
  return blocks;
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const INDIGO = '4F46E5', INDIGO_LIGHT = 'EEF2FF', GRAY_DARK = '1F2937';
const GRAY = '6B7280', GRAY_LIGHT = 'F9FAFB', WHITE = 'FFFFFF', VIOLET = '7C3AED';

function blockToDocx(block: Block): (Paragraph | Table)[] {
  switch (block.type) {
    case 'h1': return [new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INDIGO, space: 4 } },
      children: [new TextRun({ text: block.text, bold: true, color: INDIGO, size: 32 })],
    })];
    case 'h2': return [new Paragraph({
      heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 },
      children: [new TextRun({ text: block.text, bold: true, color: INDIGO, size: 26 })],
    })];
    case 'h3': return [new Paragraph({
      heading: HeadingLevel.HEADING_3, spacing: { before: 280, after: 120 },
      children: [new TextRun({ text: block.text, bold: true, color: VIOLET, size: 22 })],
    })];
    case 'paragraph': return [new Paragraph({
      spacing: { before: 100, after: 120, line: 276 },
      children: block.runs.map((r) => new TextRun({
        text: r.text, bold: r.bold, italics: r.italic, color: GRAY_DARK, size: 22,
        ...(r.code ? { font: 'Courier New', color: '7C3AED', shading: { type: ShadingType.SOLID, color: 'EDE9FE', fill: 'EDE9FE' } } : {}),
      })),
    })];
    case 'bullet': return [new Paragraph({
      bullet: { level: block.depth }, spacing: { before: 60, after: 60, line: 260 },
      children: [new TextRun({ text: block.text, color: GRAY_DARK, size: 22 })],
    })];
    case 'ordered': return [new Paragraph({
      numbering: { reference: 'numbered-list', level: 0 }, spacing: { before: 60, after: 60, line: 260 },
      children: [new TextRun({ text: block.text, color: GRAY_DARK, size: 22 })],
    })];
    case 'blockquote': return [new Paragraph({
      spacing: { before: 160, after: 160, line: 276 },
      indent: { left: convertInchesToTwip(0.4), right: convertInchesToTwip(0.4) },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: INDIGO, space: 8 } },
      shading: { type: ShadingType.SOLID, color: INDIGO_LIGHT, fill: INDIGO_LIGHT },
      children: [new TextRun({ text: block.text, italics: true, color: INDIGO, size: 22 })],
    })];
    case 'code': return [new Paragraph({
      spacing: { before: 160, after: 160 },
      shading: { type: ShadingType.SOLID, color: GRAY_LIGHT, fill: GRAY_LIGHT },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 },
      },
      children: [new TextRun({ text: block.code, font: 'Courier New', size: 18, color: GRAY_DARK })],
    })];
    case 'hr': return [new Paragraph({
      spacing: { before: 200, after: 200 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB', space: 1 } },
      children: [],
    })];
    case 'table': {
      const headerRow = new TableRow({
        tableHeader: true,
        children: block.headers.map((h) => new TableCell({
          shading: { type: ShadingType.SOLID, color: INDIGO, fill: INDIGO },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: h, bold: true, color: WHITE, size: 20 })] })],
        })),
      });
      const dataRows = block.rows.map((row, rowIdx) => new TableRow({
        children: row.map((cell) => new TableCell({
          shading: rowIdx % 2 === 0
            ? { type: ShadingType.SOLID, color: WHITE, fill: WHITE }
            : { type: ShadingType.SOLID, color: GRAY_LIGHT, fill: GRAY_LIGHT },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: cell, color: GRAY_DARK, size: 20 })] })],
        })),
      }));
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
        },
      });
      return [new Paragraph({ spacing: { before: 200 }, children: [] }), table, new Paragraph({ spacing: { after: 200 }, children: [] })];
    }
  }
}

function markdownToDocx(markdown: string, titre: string, auteur?: string, sujet?: string): Document {
  const blocks = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];
  for (const block of blocks) children.push(...blockToDocx(block));

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return new Document({
    numbering: {
      config: [{ reference: 'numbered-list', levels: [{ level: 0, format: NumberFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22, color: GRAY_DARK }, paragraph: { spacing: { line: 276 } } } },
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: convertInchesToTwip(1.1), bottom: convertInchesToTwip(1.0), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.0) },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: INDIGO, space: 4 } },
          children: [
            new TextRun({ text: titre, bold: true, color: INDIGO, size: 20 }),
            new TextRun({ text: `\t${auteur ?? ''}`, color: GRAY, size: 18 }),
          ],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
          children: [
            new TextRun({ text: `MaThèse · ${dateStr}${sujet ? ' · ' + sujet : ''}  `, color: GRAY, size: 16 }),
            new TextRun({ children: [PageNumber.CURRENT], color: GRAY, size: 16 }),
            new TextRun({ text: ' / ', color: GRAY, size: 16 }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRAY, size: 16 }),
          ],
        })] }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: convertInchesToTwip(1.5), after: 400 },
          shading: { type: ShadingType.SOLID, color: INDIGO_LIGHT, fill: INDIGO_LIGHT },
          border: {
            top: { style: BorderStyle.SINGLE, size: 12, color: INDIGO },
            bottom: { style: BorderStyle.SINGLE, size: 12, color: INDIGO },
            left: { style: BorderStyle.SINGLE, size: 12, color: INDIGO },
            right: { style: BorderStyle.SINGLE, size: 12, color: INDIGO },
          },
          children: [
            new TextRun({ text: titre, bold: true, color: INDIGO, size: 40, break: 1 }),
            ...(auteur ? [new TextRun({ text: auteur, color: GRAY, size: 22, break: 2 })] : []),
            ...(sujet ? [new TextRun({ text: sujet, italics: true, color: VIOLET, size: 22, break: 1 })] : []),
            new TextRun({ text: dateStr, color: GRAY, size: 20, break: 2 }),
            new TextRun({ text: 'Agent IA de MaThèse', italics: true, color: INDIGO, size: 18, break: 1 }),
          ],
        }),
        new Paragraph({ pageBreakBefore: true, children: [] }),
        ...children,
      ],
    }],
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { titre, userRequest, articles, sujetThese, auteur } = await req.json();

  if (!titre) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });

  try {
    // Limiter les articles à 6 max avec abstracts courts pour ne pas surcharger le contexte
    const articlesLimites = ((articles as ArticleRef[] | undefined) ?? []).slice(0, 6);
    const articlesContext = articlesLimites.length
      ? `\n\nArticles académiques disponibles :\n${
          articlesLimites.map((a, i) =>
            `[${i + 1}] "${a.titre}" — ${a.auteurs || 'Auteur inconnu'} (${a.annee || '?'})` +
            (a.doi ? ` DOI: ${a.doi}` : '') +
            (a.abstract ? `\n    Résumé: ${a.abstract.slice(0, 200)}` : '')
          ).join('\n')
        }`
      : '';

    // ── Appel Claude pour générer le contenu ──
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: 'Tu es expert en rédaction académique. Tu produis uniquement du contenu markdown structuré, sans commentaire ni préambule. Le document commence directement.',
      messages: [{
        role: 'user',
        content: `Rédige un document académique structuré en markdown.

**Titre :** "${titre}"
${sujetThese ? `**Contexte :** ${sujetThese}` : ''}
**Demande :** ${userRequest || titre}
${articlesContext}

Structure requise : Introduction → Sections (## titres) → Conclusion → Références
- Intègre les articles en citation [X] dans le texte et en bibliographie
- Niveau académique, 1000-1500 mots
- Markdown pur : ## ### **gras** - listes`,
      }],
    });

    const markdown = response.content[0]?.type === 'text' ? response.content[0].text : '';

    if (!markdown || markdown.length < 50) {
      console.error('[generate-doc] Markdown vide ou insuffisant');
      return NextResponse.json({ error: 'Contenu insuffisant' }, { status: 500 });
    }

    // ── Convertir markdown → Word ──
    const doc = markdownToDocx(markdown, titre, auteur, sujetThese);
    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);
    const filename = titre.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    });

  } catch (err) {
    console.error('[generate-doc] Erreur:', err);
    return NextResponse.json({ error: 'Erreur serveur lors de la génération' }, { status: 500 });
  }
}
