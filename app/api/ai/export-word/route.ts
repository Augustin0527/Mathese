import { NextRequest, NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageOrientation, convertInchesToTwip,
  ShadingType, Header, Footer, PageNumber, NumberFormat,
  UnderlineType,
} from 'docx';

// ─── Parseur markdown → blocs structurés ─────────────────────────────────────

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'bullet'; text: string; depth: number }
  | { type: 'ordered'; text: string; index: number }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'code'; code: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' };

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  // Regex pour **gras**, *italique*, `code`
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
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

    // Titre
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith('## ')) { blocks.push({ type: 'h2', text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith('# ')) { blocks.push({ type: 'h1', text: line.slice(2).trim() }); i++; continue; }

    // Ligne horizontale
    if (/^---+$/.test(line.trim())) { blocks.push({ type: 'hr' }); i++; continue; }

    // Bloc code
    if (line.startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++;
      blocks.push({ type: 'code', code: codeLines.join('\n') });
      continue;
    }

    // Citation
    if (line.startsWith('> ')) { blocks.push({ type: 'blockquote', text: line.slice(2).trim() }); i++; continue; }

    // Tableau markdown (lignes avec |)
    if (line.includes('|') && lines[i + 1]?.includes('|') && lines[i + 1]?.match(/^\|[-| :]+\|/)) {
      const headers = line.split('|').map((c) => c.trim()).filter(Boolean);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map((c) => c.trim()).filter(Boolean));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Liste à puces
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2);
      blocks.push({ type: 'bullet', text: bulletMatch[2].trim(), depth });
      i++;
      continue;
    }

    // Liste ordonnée
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      blocks.push({ type: 'ordered', text: orderedMatch[2].trim(), index: Number(orderedMatch[1]) });
      i++;
      continue;
    }

    // Paragraphe (ligne non vide)
    if (line.trim()) {
      blocks.push({ type: 'paragraph', runs: parseInline(line.trim()) });
    }

    i++;
  }
  return blocks;
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const INDIGO = '4F46E5';
const INDIGO_LIGHT = 'EEF2FF';
const GRAY_DARK = '1F2937';
const GRAY = '6B7280';
const GRAY_LIGHT = 'F9FAFB';
const WHITE = 'FFFFFF';
const VIOLET = '7C3AED';

// ─── Convertisseur bloc → éléments docx ──────────────────────────────────────

function blockToDocx(block: Block): (Paragraph | Table)[] {
  switch (block.type) {

    case 'h1':
      return [new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INDIGO, space: 4 } },
        children: [new TextRun({ text: block.text, bold: true, color: INDIGO, size: 32 })],
      })];

    case 'h2':
      return [new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
        children: [new TextRun({ text: block.text, bold: true, color: INDIGO, size: 26 })],
      })];

    case 'h3':
      return [new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 280, after: 120 },
        children: [new TextRun({ text: block.text, bold: true, color: VIOLET, size: 22 })],
      })];

    case 'paragraph':
      return [new Paragraph({
        spacing: { before: 100, after: 120, line: 276 },
        children: block.runs.map((r) =>
          new TextRun({
            text: r.text,
            bold: r.bold,
            italics: r.italic,
            color: GRAY_DARK,
            size: 22,
            ...(r.code ? {
              font: 'Courier New',
              color: '7C3AED',
              shading: { type: ShadingType.SOLID, color: 'EDE9FE', fill: 'EDE9FE' },
            } : {}),
          })
        ),
      })];

    case 'bullet':
      return [new Paragraph({
        bullet: { level: block.depth },
        spacing: { before: 60, after: 60, line: 260 },
        children: [new TextRun({ text: block.text, color: GRAY_DARK, size: 22 })],
      })];

    case 'ordered':
      return [new Paragraph({
        numbering: { reference: 'numbered-list', level: 0 },
        spacing: { before: 60, after: 60, line: 260 },
        children: [new TextRun({ text: block.text, color: GRAY_DARK, size: 22 })],
      })];

    case 'blockquote':
      return [new Paragraph({
        spacing: { before: 160, after: 160, line: 276 },
        indent: { left: convertInchesToTwip(0.4), right: convertInchesToTwip(0.4) },
        border: { left: { style: BorderStyle.SINGLE, size: 16, color: INDIGO, space: 8 } },
        shading: { type: ShadingType.SOLID, color: INDIGO_LIGHT, fill: INDIGO_LIGHT },
        children: [new TextRun({ text: block.text, italics: true, color: INDIGO, size: 22 })],
      })];

    case 'code':
      return [new Paragraph({
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

    case 'hr':
      return [new Paragraph({
        spacing: { before: 200, after: 200 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB', space: 1 } },
        children: [],
      })];

    case 'table': {
      // En-tête
      const headerRow = new TableRow({
        tableHeader: true,
        children: block.headers.map((h) =>
          new TableCell({
            shading: { type: ShadingType.SOLID, color: INDIGO, fill: INDIGO },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: h, bold: true, color: WHITE, size: 20 })],
            })],
          })
        ),
      });

      // Lignes
      const dataRows = block.rows.map((row, rowIdx) =>
        new TableRow({
          children: row.map((cell, _colIdx) =>
            new TableCell({
              shading: rowIdx % 2 === 0
                ? { type: ShadingType.SOLID, color: WHITE, fill: WHITE }
                : { type: ShadingType.SOLID, color: GRAY_LIGHT, fill: GRAY_LIGHT },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: cell, color: GRAY_DARK, size: 20 })],
              })],
            })
          ),
        })
      );

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

      return [
        new Paragraph({ spacing: { before: 200 }, children: [] }),
        table,
        new Paragraph({ spacing: { after: 200 }, children: [] }),
      ];
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { contenu, titre, auteur, sujet } = await req.json();

  if (!contenu) {
    return NextResponse.json({ error: 'Contenu requis' }, { status: 400 });
  }

  const blocks = parseMarkdown(contenu);
  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    children.push(...blockToDocx(block));
  }

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'numbered-list',
        levels: [{
          level: 0,
          format: NumberFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: GRAY_DARK },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: {
              top: convertInchesToTwip(1.1),
              bottom: convertInchesToTwip(1.0),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.0),
            },
          },
        },

        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: INDIGO, space: 4 } },
                children: [
                  new TextRun({ text: titre ?? 'Document MaThèse', bold: true, color: INDIGO, size: 20 }),
                  new TextRun({ text: `\t${auteur ?? ''}`, color: GRAY, size: 18 }),
                ],
              }),
            ],
          }),
        },

        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
                children: [
                  new TextRun({ text: `MaThèse · ${dateStr}${sujet ? ' · ' + sujet : ''}  `, color: GRAY, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: GRAY, size: 16 }),
                  new TextRun({ text: ' / ', color: GRAY, size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRAY, size: 16 }),
                ],
              }),
            ],
          }),
        },

        children: [
          // Page de titre
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
              new TextRun({ text: titre ?? 'Document généré par MaThèse', bold: true, color: INDIGO, size: 40, break: 1 }),
              ...(auteur ? [new TextRun({ text: auteur, color: GRAY, size: 22, break: 2 })] : []),
              ...(sujet ? [new TextRun({ text: sujet, italics: true, color: VIOLET, size: 22, break: 1 })] : []),
              new TextRun({ text: dateStr, color: GRAY, size: 20, break: 2 }),
              new TextRun({ text: 'Agent IA de MaThèse', italics: true, color: INDIGO, size: 18, break: 1 }),
            ],
          }),

          // Saut de page
          new Paragraph({
            pageBreakBefore: true,
            children: [],
          }),

          // Contenu
          ...children,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);

  const filename = (titre ?? 'document-mathese')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}.docx"`,
    },
  });
}
