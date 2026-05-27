/**
 * Type declarations voor CDN-gebaseerde bibliotheken (geladen via <script> in index.html).
 * Deze libs worden niet via npm geïnstalleerd maar als globale variabelen beschikbaar gesteld.
 */

// ---------------------------------------------------------------------------
// pdf.js  (https://cdnjs.cloudflare.com/ajax/libs/pdf.js/...)
// ---------------------------------------------------------------------------
interface PdfTextItem {
    str: string;
}

interface PdfTextContent {
    items: PdfTextItem[];
}

interface PdfPage {
    getTextContent(): Promise<PdfTextContent>;
}

interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfLoadingTask {
    promise: Promise<PdfDocument>;
}

declare const pdfjsLib: {
    getDocument(src: string): PdfLoadingTask;
};

// ---------------------------------------------------------------------------
// mammoth.js  (https://cdnjs.cloudflare.com/ajax/libs/mammoth/...)
// ---------------------------------------------------------------------------
declare const mammoth: {
    extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};

// ---------------------------------------------------------------------------
// SheetJS / xlsx  (https://cdnjs.cloudflare.com/ajax/libs/xlsx/...)
// ---------------------------------------------------------------------------
interface XlsxWorksheet {
    [cell: string]: unknown;
}

interface XlsxWorkbook {
    SheetNames: string[];
    Sheets: Record<string, XlsxWorksheet>;
}

declare const XLSX: {
    read(data: ArrayBuffer, opts?: { type?: string }): XlsxWorkbook;
    utils: {
        sheet_to_json<T = string[]>(
            worksheet: XlsxWorksheet,
            opts?: { header?: number | string[] | 'A'; defval?: unknown }
        ): T[];
    };
};

// ---------------------------------------------------------------------------
// html2canvas  (https://cdnjs.cloudflare.com/ajax/libs/html2canvas/...)
// ---------------------------------------------------------------------------
interface Html2CanvasOptions {
    scale?: number;
    useCORS?: boolean;
    logging?: boolean;
    backgroundColor?: string | null;
}

declare function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions
): Promise<HTMLCanvasElement>;

// ---------------------------------------------------------------------------
// jsPDF  (https://cdnjs.cloudflare.com/ajax/libs/jspdf/...)
// ---------------------------------------------------------------------------
interface JsPDFOptions {
    orientation?: 'p' | 'l' | 'portrait' | 'landscape';
    unit?: 'pt' | 'mm' | 'cm' | 'in' | 'px';
    format?: string | number[];
}

interface JsPDFInstance {
    internal: {
        pageSize: {
            getWidth(): number;
            getHeight(): number;
        };
    };
    addPage(): JsPDFInstance;
    addImage(
        imageData: string,
        format: string,
        x: number,
        y: number,
        width: number,
        height: number
    ): JsPDFInstance;
    setFontSize(size: number): JsPDFInstance;
    setFont(fontName: string, fontStyle?: string): JsPDFInstance;
    setTextColor(r: number, g?: number, b?: number): JsPDFInstance;
    text(
        text: string | string[],
        x: number,
        y: number,
        options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }
    ): JsPDFInstance;
    line(x1: number, y1: number, x2: number, y2: number): JsPDFInstance;
    setLineWidth(width: number): JsPDFInstance;
    setDrawColor(r: number, g?: number, b?: number): JsPDFInstance;
    setFillColor(r: number, g?: number, b?: number): JsPDFInstance;
    rect(x: number, y: number, w: number, h: number, style?: string): JsPDFInstance;
    save(filename: string): void;
    splitTextToSize(text: string, maxWidth: number): string[];
    getStringUnitWidth(text: string): number;
    getNumberOfPages(): number;
    setPage(page: number): JsPDFInstance;
    getImageProperties(imageData: string): { width: number; height: number };
    getTextDimensions(text: string | string[], options?: { fontSize?: number }): { w: number; h: number };
}

declare const jspdf: {
    jsPDF: new (options?: JsPDFOptions) => JsPDFInstance;
};
