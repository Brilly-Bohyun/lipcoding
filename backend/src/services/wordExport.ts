import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
} from 'docx';

interface TimelineEntry {
  datetime: string;
  event: string;
  source: string;
}

interface RCADocument {
  summary: string;
  timeline: TimelineEntry[];
  rootCause: string;
  resolution: string;
  preventiveAction: string;
  openQuestions: string[];
}

/**
 * Generate a Word document (.docx) from an RCA document.
 */
export async function generateWordDocument(
  rca: RCADocument,
  ticketSubject: string,
): Promise<Buffer> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Malgun Gothic', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Root Cause Analysis (RCA) 보고서', bold: true, size: 36 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: ticketSubject, size: 24, color: '666666' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `생성일: ${new Date().toLocaleDateString('ko-KR')}`,
                size: 20,
                color: '999999',
              }),
            ],
          }),

          // 1. Summary
          createSectionHeading('1. 장애 요약'),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: rca.summary })] }),

          // 2. Timeline
          createSectionHeading('2. 타임라인'),
          createTimelineTable(rca.timeline),

          // 3. Root Cause
          createSectionHeading('3. 근본 원인'),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: rca.rootCause })] }),

          // 4. Resolution
          createSectionHeading('4. 조치 내역'),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: rca.resolution })] }),

          // 5. Preventive Action
          createSectionHeading('5. 재발 방지 대책'),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: rca.preventiveAction })] }),

          // 6. Open Questions
          createSectionHeading('6. 미해결 사항'),
          ...rca.openQuestions.map(
            (q) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: q })],
              }),
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function createSectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });
}

function createTimelineTable(timeline: TimelineEntry[]): Table {
  const headerRow = new TableRow({
    children: [
      createHeaderCell('일시'),
      createHeaderCell('이벤트'),
      createHeaderCell('근거'),
    ],
  });

  const dataRows = timeline.map(
    (entry) =>
      new TableRow({
        children: [
          createDataCell(entry.datetime, 2000),
          createDataCell(entry.event, 5500),
          createDataCell(entry.source, 1500),
        ],
      }),
  );

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
  });
}

function createHeaderCell(text: string): TableCell {
  return new TableCell({
    width: { size: 3000, type: WidthType.DXA },
    shading: { fill: '4472C4' },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })],
      }),
    ],
  });
}

function createDataCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
  });
}
