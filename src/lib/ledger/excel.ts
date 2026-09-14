import { zipSync, strToU8 } from "fflate";
import {
  ASSET_CATEGORY_LABEL,
  CURRENCY_META,
  STATUS_LABEL,
  fyMonths,
  type CurrencyCode,
  type FyStartMonth,
  type LedgerState,
  type Student,
} from "./types";
import {
  assetPosition,
  computeTax,
  currentFyMonthIndex,
  enrolmentForMonth,
  licenseFeeSeries,
  monthPnL,
  studentGross,
  sum,
  taxDepreciationForAsset,
  yearPnL,
} from "./calc";
import { fyLabel, fyYearOf } from "./format";
import { kitOf, offeringLabel } from "./kits";
import { census, levelMix, royaltyReport, subjectMix } from "./reports";
import { buildDesk, formatDay, kindLabel, relativeDue } from "./reminders";

const NS = {
  main: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  rel: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  pkgRel: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
};

/** Locked Settings cells other sheets formula against. */
const SET = {
  centre: "Settings!$B$5",
  owner: "Settings!$B$6",
  fy: "Settings!$B$9",
  sibling: "Settings!$B$13",
  licenseMode: "Settings!$B$18",
  licenseRate: "Settings!$B$19",
  licenseBase: "Settings!$B$20",
  taxRate: "Settings!$B$23",
  cessRate: "Settings!$B$24",
};

function xml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function ref(c: number, r: number): string {
  return `${colLetter(c)}${r}`;
}

function currencyFormat(code: CurrencyCode): string {
  const symbol = CURRENCY_META[code].symbol.replace(/"/g, "");
  return `"${symbol}"#,##0.00;[Red]\\-"${symbol}"#,##0.00`;
}

function excelSerial(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const serial = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
  return serial > 0 ? serial : null;
}

type Cell = {
  c: number;
  v?: string | number;
  f?: string;
  s?: number;
};

type Row = { r: number; ht?: number; cells: Cell[] };

type Sheet = {
  name: string;
  rows: Row[];
  merges: string[];
  cols: { min: number; max: number; width: number }[];
  freeze?: { col: number; row: number };
  tabColor: string;
  grid: boolean;
  autoFilter?: string;
  printTitles?: string;
  cf?: { sqref: string; operator: string; formula: string }[];
};

function cellXml(row: number, cell: Cell): string {
  const r = ref(cell.c, row);
  const s = cell.s != null ? ` s="${cell.s}"` : "";
  if (cell.f) {
    const v =
      typeof cell.v === "number" && Number.isFinite(cell.v)
        ? `<v>${cell.v}</v>`
        : "";
    return `<c r="${r}"${s}><f>${xml(cell.f)}</f>${v}</c>`;
  }
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
    return `<c r="${r}"${s} t="n"><v>${cell.v}</v></c>`;
  }
  const text = cell.v == null ? "" : String(cell.v);
  if (!text) return `<c r="${r}"${s}/>`;
  return `<c r="${r}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
}

function sheetXml(sheet: Sheet, header: string, footer: string): string {
  const maxRow = Math.max(1, ...sheet.rows.map((r) => r.r));
  const maxCol = Math.max(
    1,
    ...sheet.rows.flatMap((r) => r.cells.map((c) => c.c + 1)),
  );
  const dim = `A1:${colLetter(maxCol - 1)}${maxRow}`;
  const colXml = sheet.cols
    .map(
      (c) =>
        `<col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"/>`,
    )
    .join("");
  const freezeXml = sheet.freeze
    ? sheet.freeze.col > 0
      ? `<pane xSplit="${sheet.freeze.col}" ySplit="${sheet.freeze.row}" topLeftCell="${ref(sheet.freeze.col, sheet.freeze.row + 1)}" activePane="bottomRight" state="frozen"/>`
      : `<pane ySplit="${sheet.freeze.row}" topLeftCell="A${sheet.freeze.row + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const rowXml = [...sheet.rows]
    .sort((a, b) => a.r - b.r)
    .map((row) => {
      const ht = row.ht ? ` ht="${row.ht}" customHeight="1"` : "";
      return `<row r="${row.r}"${ht}>${row.cells.map((c) => cellXml(row.r, c)).join("")}</row>`;
    })
    .join("");
  const autoXml = sheet.autoFilter
    ? `<autoFilter ref="${sheet.autoFilter}"/>`
    : "";
  const mergeXml = sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";
  const cfXml = (sheet.cf ?? [])
    .map(
      (rule) =>
        `<conditionalFormatting sqref="${xml(rule.sqref)}"><cfRule type="cellIs" dxfId="0" priority="1" operator="${xml(rule.operator)}"><formula>${xml(rule.formula)}</formula></cfRule></conditionalFormatting>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS.main}" xmlns:r="${NS.rel}">
  <sheetPr>
    <tabColor rgb="${sheet.tabColor}"/>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <dimension ref="${dim}"/>
  <sheetViews>
    <sheetView workbookViewId="0" showGridLines="${sheet.grid ? "1" : "0"}" view="normal" zoomScale="100">${freezeXml}</sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18" defaultColWidth="12"/>
  <cols>${colXml}</cols>
  <sheetData>${rowXml}</sheetData>
  ${autoXml}
  ${mergeXml}
  ${cfXml}
  <printOptions horizontalCentered="1" gridLines="0"/>
  <pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/>
  <pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" pageOrder="downThenOver"/>
  <headerFooter>
    <oddHeader>${xml(header)}</oddHeader>
    <oddFooter>${xml(footer)}</oddFooter>
  </headerFooter>
</worksheet>`;
}

function stylesXml(numFmt: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS.main}">
  <numFmts count="4">
    <numFmt numFmtId="164" formatCode="${xml(numFmt)}"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
    <numFmt numFmtId="166" formatCode="d-mmm-yyyy"/>
    <numFmt numFmtId="167" formatCode="#,##0"/>
  </numFmts>
  <fonts count="11">
    <font><sz val="11"/><color rgb="FF1C1412"/><name val="Calibri"/></font>
    <font><b/><sz val="20"/><color rgb="FFFBF7EF"/><name val="Calibri"/></font>
    <font><sz val="11"/><color rgb="FFD9D0C0"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1C1412"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FFFBF7EF"/><name val="Calibri"/></font>
    <font><b/><sz val="22"/><color rgb="FFFBF7EF"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FF1C1412"/><name val="Calibri"/></font>
    <font><sz val="9"/><color rgb="FF6F6458"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1F6B45"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF9B1B2E"/><name val="Calibri"/></font>
    <font><i/><sz val="10"/><color rgb="FF6F6458"/><name val="Calibri"/></font>
  </fonts>
  <fills count="13">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF241C1A"/><bgColor rgb="FF241C1A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9B1B2E"/><bgColor rgb="FF9B1B2E"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F6B45"/><bgColor rgb="FF1F6B45"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFE6D5"/><bgColor rgb="FFEFE6D5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4ECE0"/><bgColor rgb="FFF4ECE0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFBF7EF"/><bgColor rgb="FFFBF7EF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8E6E8"/><bgColor rgb="FFF8E6E8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3EDE2"/><bgColor rgb="FFF3EDE2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8DCC8"/><bgColor rgb="FFE8DCC8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF6E8D0"/><bgColor rgb="FFF6E8D0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EC"/><bgColor rgb="FFE8F1EC"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9D0C0"/></left>
      <right style="thin"><color rgb="FFD9D0C0"/></right>
      <top style="thin"><color rgb="FFD9D0C0"/></top>
      <bottom style="thin"><color rgb="FFD9D0C0"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFD9D0C0"/></left>
      <right style="thin"><color rgb="FFD9D0C0"/></right>
      <top style="thin"><color rgb="FF241C1A"/></top>
      <bottom style="medium"><color rgb="FF241C1A"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFD9D0C0"/></left>
      <right style="thin"><color rgb="FFD9D0C0"/></right>
      <top style="thin"><color rgb="FF1F6B45"/></top>
      <bottom style="double"><color rgb="FF1F6B45"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="32">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="6" fillId="5" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="8" fillId="12" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="9" fillId="8" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="167" fontId="5" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="167" fontId="0" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="6" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="9" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="9" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="10" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="10" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="10" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="10" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <dxfs count="1">
    <dxf><font><b/><color rgb="FF9B1B2E"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFF8E6E8"/><bgColor rgb="FFF8E6E8"/></patternFill></fill></dxf>
  </dxfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

const S = {
  none: 0,
  banner: 1,
  bannerSub: 2,
  colHead: 3,
  section: 4,
  num: 5,
  numBold: 6,
  numProfit: 7,
  numLoss: 8,
  text: 9,
  kpiWineLabel: 10,
  kpiWineValue: 11,
  kpiDarkLabel: 12,
  kpiDarkValue: 13,
  kpiGreenLabel: 14,
  kpiGreenValue: 15,
  note: 16,
  sectionLoose: 17,
  kpiDarkInt: 18,
  date: 19,
  int: 20,
  pct: 21,
  zebraText: 22,
  zebraNum: 23,
  zebraDate: 24,
  familyText: 25,
  familyNum: 26,
  familyDate: 27,
  totalLabel: 28,
  kvLabel: 29,
  kvValue: 30,
  italic: 31,
};

function monthHeaders(fy: number, fyStartMonth: FyStartMonth = 3): string[] {
  return fyMonths(fyStartMonth).map(
    (m, i) => `${m}-${String(fyYearOf(fy, fyStartMonth, i)).slice(-2)}`,
  );
}

function numberRow(
  r: number,
  label: string,
  values: number[],
  style: number,
  labelStyle = S.text,
): Row {
  return {
    r,
    cells: [
      { c: 0, v: label, s: labelStyle },
      ...values.map((v, i) => ({ c: i + 1, v, s: style })),
      {
        c: 13,
        f: `SUM(B${r}:M${r})`,
        v: values.reduce((a, b) => a + b, 0),
        s: style === S.num ? S.numBold : style,
      },
    ],
  };
}

function formulaMonthRow(
  r: number,
  label: string,
  formulaForCol: (colLetter: string) => string,
  values: number[],
  style: number,
  labelStyle = S.section,
): Row {
  return {
    r,
    cells: [
      { c: 0, v: label, s: labelStyle },
      ...values.map((v, i) => ({
        c: i + 1,
        f: formulaForCol(colLetter(i + 1)),
        v,
        s: style,
      })),
      {
        c: 13,
        f: `SUM(B${r}:M${r})`,
        v: values.reduce((a, b) => a + b, 0),
        s: style,
      },
    ],
  };
}

function upsertRow(rows: Row[], r: number, ht?: number): Row {
  let row = rows.find((x) => x.r === r);
  if (!row) {
    row = { r, ht, cells: [] };
    rows.push(row);
  } else if (ht && !row.ht) {
    row.ht = ht;
  }
  return row;
}

function kpiBlock(
  rows: Row[],
  merges: string[],
  startCol: number,
  startRow: number,
  label: string,
  value: number,
  formula: string | undefined,
  hint: string,
  kind: "wine" | "dark" | "green",
  integer = false,
) {
  const labelS = kind === "wine" ? S.kpiWineLabel : kind === "green" ? S.kpiGreenLabel : S.kpiDarkLabel;
  const valueS = integer
    ? S.kpiDarkInt
    : kind === "wine"
      ? S.kpiWineValue
      : kind === "green"
        ? S.kpiGreenValue
        : S.kpiDarkValue;
  const endCol = startCol + 2;
  merges.push(`${ref(startCol, startRow)}:${ref(endCol, startRow)}`);
  merges.push(`${ref(startCol, startRow + 1)}:${ref(endCol, startRow + 1)}`);
  merges.push(`${ref(startCol, startRow + 2)}:${ref(endCol, startRow + 2)}`);
  upsertRow(rows, startRow, 18).cells.push({ c: startCol, v: label, s: labelS });
  const valueCell: Cell = { c: startCol, v: value, s: valueS };
  if (formula) valueCell.f = formula;
  upsertRow(rows, startRow + 1, 32).cells.push(valueCell);
  upsertRow(rows, startRow + 2, 18).cells.push({ c: startCol, v: hint, s: labelS });
}

function sortRegister(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const fa = a.familyName.trim().toLowerCase();
    const fb = b.familyName.trim().toLowerCase();
    if (fa !== fb) return fa.localeCompare(fb);
    if (a.isPrimaryInFamily !== b.isPrimaryInFamily) return a.isPrimaryInFamily ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function dateCell(c: number, iso: string | null | undefined, style: number): Cell {
  const serial = excelSerial(iso);
  if (serial == null) return { c, v: iso ?? "", s: style === S.date || style === S.zebraDate || style === S.familyDate ? S.text : style };
  return { c, v: serial, s: style };
}

function buildSettings(state: LedgerState): Sheet {
  const kit = kitOf(state.settings.tradeId);
  const fy = fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3);
  const s = state.settings;
  const rows: Row[] = [];
  const merges = ["A1:D1", "A2:D2"];

  rows.push({ r: 1, ht: 28, cells: [{ c: 0, v: "Settings — the rules this workbook is built on", s: S.banner }] });
  rows.push({
    r: 2,
    ht: 20,
    cells: [
      {
        c: 0,
        v: "Change a rate here and P&L royalty, tax and the dashboard recalculate. The register itself is a snapshot — change people in Paper Ledger, then export again.",
        s: S.bannerSub,
      },
    ],
  });

  const kv = (r: number, label: string, value: string | number, numberStyle?: number) => {
    rows.push({
      r,
      cells: [
        { c: 0, v: label, s: S.kvLabel },
        { c: 1, v: value, s: numberStyle ?? S.kvValue },
      ],
    });
  };
  const section = (r: number, title: string) => {
    rows.push({ r, cells: [{ c: 0, v: title, s: S.section }] });
    merges.push(`A${r}:B${r}`);
  };

  section(4, "Business");
  kv(5, "Centre / business name", s.centreName);
  kv(6, kit.owner, s.instructorName);
  kv(7, "City", s.city);
  kv(8, "Kit", kit.name);
  kv(9, "Financial year", fy);
  kv(10, "Currency", s.currency);

  section(12, "Revenue rules");
  kv(13, `${kit.discount} %`, s.siblingDiscountPct, S.num);
  kv(14, `Default ${kit.offerings[0]?.label ?? kit.offering} fee`, s.defaultMathFee, S.num);
  kv(15, `Default ${kit.offerings[1]?.label ?? "second"} fee`, s.defaultEnglishFee, S.num);

  section(17, kit.royalty);
  kv(18, "Mode", s.licenseFeeMode === "percent" ? "% per subject" : "amount per subject");
  kv(19, s.licenseFeeMode === "percent" ? "Royalty % per subject" : `Amount per ${kit.offering.toLowerCase()}`, s.licenseFeeRate, S.num);
  kv(20, "Charged on", s.licenseFeeBase === "net" ? "net after family discount" : "each subject's fee");
  rows.push({
    r: 21,
    cells: [
      {
        c: 0,
        v:
          s.licenseFeeMode === "percent"
            ? `${s.licenseFeeRate}% of each billed ${kit.offering.toLowerCase()} fee. Dual-subject students pay twice. Edit B19 and the PnL royalty row follows.`
            : `${s.licenseFeeRate} per billed ${kit.offering.toLowerCase()}. Enrolment lives on Register — re-export after the roll changes.`,
        s: S.italic,
      },
    ],
  });
  merges.push("A21:D21");

  section(26, "Initial licence (one-off)");
  kv(27, "This year (from PnL)", sum(state.initialLicenseValues ?? []), S.num);
  rows.push({
    r: 28,
    cells: [
      {
        c: 0,
        v: "A lump sum paid at the start — not the monthly royalty. Type it on the PnL in the month you paid.",
        s: S.italic,
      },
    ],
  });
  merges.push("A28:D28");

  section(22, "Tax");
  kv(23, "Income tax %", s.taxRatePct, S.num);
  kv(24, "Cess %", s.cessPct, S.num);
  rows.push({
    r: 25,
    cells: [
      {
        c: 0,
        v: "Tax is a working paper, not a filed return. B23 and B24 feed Tax!B9 and Tax!B10.",
        s: S.italic,
      },
    ],
  });
  merges.push("A25:D25");

  section(26, "Centre operations");
  kv(27, "Renewal notice (days)", s.renewalNoticeDays, S.int);
  const summer = excelSerial(s.summerReturnDate);
  rows.push({
    r: 28,
    cells: [
      { c: 0, v: kit.showSummer ? "Summer return date" : "Pause return date", s: S.kvLabel },
      summer != null
        ? { c: 1, v: summer, s: S.date }
        : { c: 1, v: s.summerReturnDate || "—", s: S.kvValue },
    ],
  });
  kv(29, "Payment grace (days)", s.paymentGraceDays, S.int);

  section(31, kit.offeringsLabel);
  rows.push({
    r: 32,
    cells: ["Code", "Label"].map((h, i) => ({ c: i, v: h, s: S.colHead })),
  });
  const offerings = s.offerings?.length ? s.offerings : kit.offerings;
  offerings.forEach((o, i) => {
    rows.push({
      r: 33 + i,
      cells: [
        { c: 0, v: o.id, s: S.text },
        { c: 1, v: o.label, s: S.text },
      ],
    });
  });

  const foot = 33 + offerings.length + 1;
  rows.push({
    r: foot,
    cells: [
      {
        c: 0,
        v: "Named cells: CentreName B5, SiblingDiscount B13, LicenseRate B19, TaxRate B23, CessRate B24. Other sheets point here on purpose.",
        s: S.note,
      },
    ],
  });
  merges.push(`A${foot}:D${foot}`);

  return {
    name: "Settings",
    rows,
    merges,
    cols: [
      { min: 1, max: 1, width: 36 },
      { min: 2, max: 2, width: 28 },
      { min: 3, max: 4, width: 18 },
    ],
    freeze: { col: 0, row: 2 },
    tabColor: "FF6F6458",
    grid: false,
    printTitles: "$1:$2",
  };
}

function buildPnL(state: LedgerState): { sheet: Sheet; rows: Record<string, number> } {
  const fy = state.settings.fyStartYear;
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const kit = kitOf(state.settings.tradeId);
  const months = Array.from({ length: 12 }, (_, i) => monthPnL(state, i));
  const y = yearPnL(state);
  const heads = monthHeaders(fy, fyStartMonth);
  const rows: Row[] = [];
  const merges = ["A1:N1", "A2:N2"];
  const percentLicense = state.settings.licenseFeeMode === "percent";

  rows.push({
    r: 1,
    ht: 28,
    cells: [{ c: 0, v: `${state.settings.centreName}  ·  profit and loss  ·  ${fyLabel(fy, fyStartMonth)}`, s: S.banner }],
  });
  rows.push({
    r: 2,
    ht: 18,
    cells: [
      {
        c: 0,
        v: "Type over a month to work in Excel. YTD, royalty (if % of fees), operating profit and the Dashboard are formulas. Register changes still need a fresh export.",
        s: S.bannerSub,
      },
    ],
  });
  rows.push({
    r: 3,
    ht: 22,
    cells: [
      { c: 0, v: "Account", s: S.colHead },
      ...heads.map((h, i) => ({ c: i + 1, v: h, s: S.colHead })),
      { c: 13, v: "YTD", s: S.colHead },
    ],
  });

  let r = 4;
  const map: Record<string, number> = {};
  const pushValues = (
    key: string,
    label: string,
    pick: (m: ReturnType<typeof monthPnL>) => number,
    style = S.num,
    ls = S.text,
  ) => {
    map[key] = r;
    rows.push(numberRow(r, label, months.map(pick), style, ls));
    r += 1;
  };

  rows.push({ r, cells: [{ c: 0, v: "Revenue", s: S.section }] });
  merges.push(`A${r}:N${r}`);
  r += 1;

  pushValues("tuition", `${kit.revenue} (gross)`, (m) => m.grossTuition);
  pushValues("discount", kit.discount, (m) => -m.siblingDiscount);
  pushValues("reg", kit.extra.registration, (m) => m.registration);
  pushValues("mat", kit.extra.materials, (m) => m.materials);
  pushValues("other", kit.extra.other, (m) => m.otherIncome);

  map.net = r;
  rows.push(
    formulaMonthRow(
      r,
      "Net revenue",
      (col) => `${col}${map.tuition}+${col}${map.discount}+${col}${map.reg}+${col}${map.mat}+${col}${map.other}`,
      months.map((m) => m.netRevenue),
      S.numBold,
    ),
  );
  r += 2;

  rows.push({ r, cells: [{ c: 0, v: "Costs", s: S.section }] });
  merges.push(`A${r}:N${r}`);
  r += 1;

  map.initialLicense = r;
  rows.push(
    numberRow(
      r,
      "Initial licence fee (one-off)",
      months.map((m) => m.initialLicense),
      S.num,
    ),
  );
  r += 1;

  const licenseLabel =
    state.settings.licenseFeeMode === "percent"
      ? `${kit.royalty} (${state.settings.licenseFeeRate}% per ${kit.offering.toLowerCase()})`
      : `${kit.royalty} (${state.settings.licenseFeeRate} per ${kit.offering.toLowerCase()})`;
  map.license = r;
  if (percentLicense) {
    const licenseValues = licenseFeeSeries(state);
    rows.push(
      formulaMonthRow(
        r,
        licenseLabel,
        (col) =>
          `IF(${SET.licenseBase}="net",(${col}${map.tuition}+${col}${map.discount})*${SET.licenseRate}/100,${col}${map.tuition}*${SET.licenseRate}/100)`,
        licenseValues,
        S.num,
        S.text,
      ),
    );
  } else {
    rows.push(numberRow(r, licenseLabel, months.map((m) => m.licenseFee), S.num));
  }
  r += 1;

  state.expenses.forEach((row, idx) => {
    rows.push(numberRow(r, row.name, months.map((m) => m.operatingExpenses[idx]?.amount ?? 0), S.num));
    r += 1;
  });
  map.amort = r;
  rows.push(numberRow(r, "Amortisation", months.map((m) => m.amortisation), S.num));
  r += 1;

  map.costs = r;
  rows.push(
    formulaMonthRow(
      r,
      "Total costs",
      (col) => `SUM(${col}${map.initialLicense ?? map.license}:${col}${map.amort})`,
      months.map((m) => m.totalCosts),
      S.numBold,
    ),
  );
  r += 2;

  map.profit = r;
  const profitStyle = y.operatingProfit >= 0 ? S.numProfit : S.numLoss;
  rows.push(
    formulaMonthRow(
      r,
      "Operating profit",
      (col) => `${col}${map.net}-${col}${map.costs}`,
      months.map((m) => m.operatingProfit),
      profitStyle,
      S.section,
    ),
  );
  r += 1;
  map.margin = r;
  const marginValues = months.map((m) => (m.netRevenue === 0 ? 0 : m.operatingProfit / m.netRevenue));
  rows.push(
    formulaMonthRow(
      r,
      "Operating margin",
      (col) => `IF(${col}${map.net}=0,0,${col}${map.profit}/${col}${map.net})`,
      marginValues,
      S.pct,
      S.text,
    ),
  );
  r += 2;
  rows.push({
    r,
    cells: [
      {
        c: 0,
        v: "YTD is SUM of the twelve months. Royalty in percent mode reads Settings!B19 / B20. This is a working model, not a CSV dump.",
        s: S.italic,
      },
    ],
  });
  merges.push(`A${r}:N${r}`);

  return {
    sheet: {
      name: "PnL",
      rows,
      merges,
      cols: [
        { min: 1, max: 1, width: 44 },
        { min: 2, max: 13, width: 13.2 },
        { min: 14, max: 14, width: 15 },
      ],
      freeze: { col: 1, row: 3 },
      tabColor: "FF1F6B45",
      grid: true,
      printTitles: "$1:$3",
      cf: [{ sqref: `B${map.profit}:N${map.profit}`, operator: "lessThan", formula: "0" }],
    },
    rows: map,
  };
}

function buildDashboard(
  state: LedgerState,
  pnlRows: Record<string, number>,
  register: { statusCol: string; primaryCol: string; feeCol: string; first: number; last: number },
): Sheet {
  const fy = state.settings.fyStartYear;
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const kit = kitOf(state.settings.tradeId);
  const y = yearPnL(state);
  const tax = computeTax(state);
  const monthIndex = currentFyMonthIndex(new Date(), fy, fyStartMonth);
  const enrol = enrolmentForMonth(state.students, state.settings, monthIndex);
  const pop = census(state);
  const desk = buildDesk(state).filter((i) => !i.done).slice(0, 8);
  const months = Array.from({ length: 12 }, (_, i) => monthPnL(state, i));
  const heads = monthHeaders(fy, fyStartMonth);
  const rows: Row[] = [];
  const merges = ["A1:N1", "A2:N2"];
  const range = (col: string) => `${col}${register.first}:${col}${register.last}`;

  rows.push({
    r: 1,
    ht: 32,
    cells: [{ c: 0, v: state.settings.centreName, s: S.banner }],
  });
  rows.push({
    r: 2,
    ht: 20,
    cells: [
      {
        c: 0,
        v: `${state.settings.instructorName}  ·  ${state.settings.city}  ·  ${fyLabel(fy, fyStartMonth)}  ·  ${state.settings.currency}  ·  Paper Ledger`,
        s: S.bannerSub,
      },
    ],
  });

  kpiBlock(
    rows,
    merges,
    0,
    4,
    "NET REVENUE (YTD)",
    y.netRevenue,
    `PnL!N${pnlRows.net}`,
    `After ${kit.discount.toLowerCase()}`,
    "wine",
  );
  kpiBlock(
    rows,
    merges,
    3,
    4,
    "OPERATING PROFIT",
    y.operatingProfit,
    `PnL!N${pnlRows.profit}`,
    y.operatingProfit >= 0 ? "After costs" : "Currently a YTD loss",
    y.operatingProfit >= 0 ? "green" : "wine",
  );
  kpiBlock(
    rows,
    merges,
    6,
    4,
    "TAX PAYABLE",
    tax.taxPayable,
    "Tax!B14",
    `${state.settings.taxRatePct}% + ${state.settings.cessPct}% cess`,
    "dark",
  );
  kpiBlock(
    rows,
    merges,
    9,
    4,
    kit.customers.toUpperCase(),
    pop.active,
    `COUNTIF(Register!${range(register.statusCol)},"Active")`,
    `${enrol.subjectCount} ${kit.offeringsLabel.toLowerCase()} · ${pop.families} ${kit.group.toLowerCase()}${pop.families === 1 ? "" : "s"}`,
    "dark",
    true,
  );

  rows.push({
    r: 8,
    cells: [{ c: 0, v: "Monthly performance (reads PnL)", s: S.sectionLoose }],
  });
  merges.push("A8:N8");
  rows.push({
    r: 9,
    ht: 22,
    cells: [
      { c: 0, v: "", s: S.colHead },
      ...heads.map((h, i) => ({ c: i + 1, v: h, s: S.colHead })),
      { c: 13, v: "YTD", s: S.colHead },
    ],
  });
  rows.push(
    formulaMonthRow(
      10,
      "Net revenue",
      (col) => `PnL!${col}${pnlRows.net}`,
      months.map((m) => m.netRevenue),
      S.num,
      S.text,
    ),
  );
  rows.push(
    formulaMonthRow(
      11,
      "Total costs",
      (col) => `PnL!${col}${pnlRows.costs}`,
      months.map((m) => m.totalCosts),
      S.num,
      S.text,
    ),
  );
  rows.push(
    formulaMonthRow(
      12,
      "Operating profit",
      (col) => `PnL!${col}${pnlRows.profit}`,
      months.map((m) => m.operatingProfit),
      y.operatingProfit >= 0 ? S.numProfit : S.numLoss,
      S.section,
    ),
  );
  rows.push(
    formulaMonthRow(
      13,
      "Operating margin",
      (col) => `IF(${col}10=0,0,${col}12/${col}10)`,
      months.map((m) => (m.netRevenue === 0 ? 0 : m.operatingProfit / m.netRevenue)),
      S.pct,
      S.text,
    ),
  );

  rows.push({
    r: 15,
    cells: [{ c: 0, v: "On the desk (as of export)", s: S.sectionLoose }],
  });
  merges.push("A15:F15");
  rows.push({
    r: 16,
    cells: ["Due", "Item", "Type", "Who", "Status"].map((h, i) => ({ c: i, v: h, s: S.colHead })),
  });
  if (desk.length === 0) {
    rows.push({ r: 17, cells: [{ c: 0, v: "Nothing open", s: S.italic }] });
  } else {
    desk.forEach((item, i) => {
      const stripe = i % 2 === 1;
      rows.push({
        r: 17 + i,
        cells: [
          dateCell(0, item.dueOn, stripe ? S.zebraDate : S.date),
          { c: 1, v: item.title, s: stripe ? S.zebraText : S.text },
          { c: 2, v: kindLabel(item.kind, kit.showSummer), s: stripe ? S.zebraText : S.text },
          { c: 3, v: item.parentName || item.studentName || "", s: stripe ? S.zebraText : S.text },
          { c: 4, v: relativeDue(item.dueOn), s: stripe ? S.zebraText : S.text },
        ],
      });
    });
  }

  const noteRow = 17 + Math.max(desk.length, 1) + 1;
  rows.push({
    r: noteRow,
    cells: [
      {
        c: 0,
        v: "Live Excel model. Change a month on PnL or a rate on Settings — this page recalculates. People, levels and the desk are a snapshot: update them in Paper Ledger, then download again. JSON backup (not this file) restores the live books on another computer.",
        s: S.italic,
      },
    ],
  });
  merges.push(`A${noteRow}:N${noteRow}`);

  return {
    name: "Dashboard",
    rows,
    merges,
    cols: [
      { min: 1, max: 1, width: 28 },
      { min: 2, max: 13, width: 13.2 },
      { min: 14, max: 14, width: 14 },
    ],
    freeze: { col: 0, row: 3 },
    tabColor: "FF9B1B2E",
    grid: false,
    printTitles: "$1:$3",
    cf: [{ sqref: "B12:N12", operator: "lessThan", formula: "0" }],
  };
}

type ColKind = "text" | "money" | "date" | "int";

function tableSheet(opts: {
  name: string;
  title: string;
  subtitle?: string;
  headers: string[];
  data: (string | number | { v: string | number; kind: ColKind })[][];
  tabColor: string;
  kinds: ColKind[];
  widths?: number[];
  freezeCol?: number;
  familyBand?: boolean;
}): Sheet {
  const { name, title, headers, data, tabColor, kinds } = opts;
  const lastCol = colLetter(Math.max(headers.length - 1, 0));
  const rows: Row[] = [
    { r: 1, ht: 26, cells: [{ c: 0, v: title, s: S.banner }] },
  ];
  const merges = [`A1:${lastCol}1`];
  let headerRow = 2;
  if (opts.subtitle) {
    rows.push({ r: 2, ht: 18, cells: [{ c: 0, v: opts.subtitle, s: S.bannerSub }] });
    merges.push(`A2:${lastCol}2`);
    headerRow = 3;
  }
  rows.push({
    r: headerRow,
    ht: 22,
    cells: headers.map((h, i) => ({ c: i, v: h, s: S.colHead })),
  });

  const styleOf = (kind: ColKind, band: "plain" | "zebra" | "family"): number => {
    if (kind === "money") return band === "family" ? S.familyNum : band === "zebra" ? S.zebraNum : S.num;
    if (kind === "date") return band === "family" ? S.familyDate : band === "zebra" ? S.zebraDate : S.date;
    if (kind === "int") return S.int;
    return band === "family" ? S.familyText : band === "zebra" ? S.zebraText : S.text;
  };

  let familyToggle = false;
  let lastFamily = "";
  data.forEach((line, idx) => {
    const familyKey = opts.familyBand ? String(line[0] ?? "") : "";
    if (opts.familyBand && familyKey !== lastFamily) {
      familyToggle = !familyToggle;
      lastFamily = familyKey;
    }
    const band: "plain" | "zebra" | "family" = opts.familyBand
      ? familyToggle
        ? "family"
        : "plain"
      : idx % 2 === 1
        ? "zebra"
        : "plain";
    rows.push({
      r: headerRow + 1 + idx,
      cells: line.map((raw, i) => {
        const kind = kinds[i] ?? "text";
        const style = styleOf(kind, band);
        if (raw && typeof raw === "object" && "kind" in raw) {
          return { c: i, v: raw.v, s: styleOf(raw.kind, band) };
        }
        return { c: i, v: raw as string | number, s: style };
      }),
    });
  });

  const firstData = headerRow + 1;
  const lastData = headerRow + Math.max(data.length, 1);
  if (data.length === 0) {
    rows.push({
      r: firstData,
      cells: [{ c: 0, v: "Nothing on this sheet yet.", s: S.italic }],
    });
  }

  const widths =
    opts.widths ??
    headers.map((_, i) => (i === 0 ? 26 : kinds[i] === "money" ? 14 : kinds[i] === "date" ? 13 : 16));

  return {
    name,
    rows,
    merges,
    cols: widths.map((width, i) => ({ min: i + 1, max: i + 1, width })),
    freeze: { col: opts.freezeCol ?? 0, row: headerRow },
    tabColor,
    grid: true,
    autoFilter: `A${headerRow}:${lastCol}${lastData}`,
    printTitles: `$1:$${headerRow}`,
  };
}

function buildRegister(state: LedgerState): {
  sheet: Sheet;
  statusCol: string;
  primaryCol: string;
  feeCol: string;
  first: number;
  last: number;
} {
  const kit = kitOf(state.settings.tradeId);
  const isTuition = kit.id === "tuition";
  const students = sortRegister(state.students);
  const headerRow = 3;
  const first = headerRow + 1;

  if (isTuition) {
    const headers = [
      kit.group,
      "Name",
      "Primary",
      "Status",
      kit.offeringsLabel,
      "Levels",
      "Fee / month",
      "Days/wk",
      "From",
      "To",
      "Renewal",
      "Restart",
      kit.contact,
      "Phone",
      "Email",
      "Last paid",
      "Arrears",
      "Away",
      "Source",
      "Goal",
      "Notes",
    ];
    const kinds: ColKind[] = [
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "money",
      "int",
      "date",
      "date",
      "date",
      "date",
      "text",
      "text",
      "text",
      "date",
      "text",
      "text",
      "text",
      "date",
      "text",
    ];
    const data = students.map((s) => [
      s.familyName,
      s.name,
      s.isPrimaryInFamily ? "Yes" : "No",
      STATUS_LABEL[s.status],
      s.subjects.map((id) => offeringLabel(state.settings, id)).join(" + "),
      Object.entries(s.levelBySubject ?? {})
        .filter(([, v]) => v)
        .map(([id, v]) => `${offeringLabel(state.settings, id)} ${v}`)
        .join(" / "),
      studentGross(s),
      s.daysPerWeek || "",
      excelSerial(s.enrolledFrom) ?? "",
      excelSerial(s.enrolledTo) ?? "",
      excelSerial(s.renewalOn) ?? "",
      excelSerial(s.restartOn) ?? "",
      s.parentName ?? "",
      s.parentPhone ?? "",
      s.parentEmail ?? "",
      excelSerial(s.lastPaidOn) ?? "",
      s.arrears ? "Yes" : "No",
      s.awayForSummer ? "Yes" : "No",
      s.source ?? "",
      excelSerial(s.goalDate) ?? "",
      s.notes ?? "",
    ]);
    const sheet = tableSheet({
      name: "Register",
      title: `${kit.customers} register`,
      subtitle: `Grouped by ${kit.group.toLowerCase()}. Filter a column. Dates are real Excel dates. Fee / month is the billed amount used on the P&L.`,
      headers,
      data,
      tabColor: "FF3D4A6B",
      kinds,
      familyBand: true,
      freezeCol: 2,
      widths: [16, 18, 10, 12, 16, 18, 14, 10, 13, 13, 13, 13, 18, 14, 24, 13, 10, 10, 14, 13, 28],
    });

    const last = first + Math.max(students.length, 1) - 1;
    const totalsRow = last + 2;
    sheet.rows.push({
      r: totalsRow,
      cells: [
        { c: 0, v: "On the books (formulas)", s: S.totalLabel },
        { c: 1, v: "Active", s: S.text },
        {
          c: 2,
          f: `COUNTIF(D${first}:D${last},"Active")`,
          v: students.filter((s) => s.status === "active").length,
          s: S.int,
        },
        { c: 3, v: `${kit.group}s (primary)`, s: S.text },
        {
          c: 4,
          f: `COUNTIFS(D${first}:D${last},"Active",C${first}:C${last},"Yes")`,
          v: students.filter((s) => s.status === "active" && s.isPrimaryInFamily).length,
          s: S.int,
        },
        { c: 5, v: "Monthly fees", s: S.text },
        {
          c: 6,
          f: `SUMIF(D${first}:D${last},"Active",G${first}:G${last})`,
          v: students.filter((s) => s.status === "active").reduce((a, s) => a + studentGross(s), 0),
          s: S.numBold,
        },
      ],
    });
    sheet.merges.push(`A${totalsRow}:B${totalsRow}`);

    return {
      sheet,
      statusCol: "D",
      primaryCol: "C",
      feeCol: "G",
      first,
      last,
    };
  }

  const headers = [
    "Name",
    kit.group,
    "Primary",
    kit.offeringsLabel,
    `Fee / ${kit.offering.toLowerCase()}`,
    "Status",
    "From",
    "To",
    kit.contact,
    "Phone",
    "Renewal",
    "Away",
    "Notes",
  ];
  const kinds: ColKind[] = [
    "text",
    "text",
    "text",
    "text",
    "money",
    "text",
    "date",
    "date",
    "text",
    "text",
    "date",
    "text",
    "text",
  ];
  const data = students.map((s) => [
    s.name,
    s.familyName,
    s.isPrimaryInFamily ? "Yes" : "No",
    s.subjects.map((id) => offeringLabel(state.settings, id)).join(" + "),
    s.feePerSubject,
    STATUS_LABEL[s.status],
    excelSerial(s.enrolledFrom) ?? "",
    excelSerial(s.enrolledTo) ?? "",
    s.parentName ?? "",
    s.parentPhone ?? "",
    excelSerial(s.renewalOn) ?? "",
    s.awayForSummer ? "Yes" : "No",
    s.notes ?? "",
  ]);
  const sheet = tableSheet({
    name: "Register",
    title: `${kit.customers} register`,
    subtitle: "Snapshot of who is billed. Filter a column. Change people in Paper Ledger, then export again.",
    headers,
    data,
    tabColor: "FF3D4A6B",
    kinds,
    freezeCol: 1,
    widths: [20, 16, 10, 18, 14, 12, 13, 13, 18, 14, 13, 10, 28],
  });
  const last = first + Math.max(students.length, 1) - 1;
  return {
    sheet,
    statusCol: "F",
    primaryCol: "C",
    feeCol: "E",
    first,
    last,
  };
}

function buildDeskSheet(state: LedgerState): Sheet {
  const kit = kitOf(state.settings.tradeId);
  const items = buildDesk(state);
  return tableSheet({
    name: "Desk",
    title: "Desk",
    subtitle: `Follow-ups as of export. Renewals, ${kit.showSummer ? "summer" : "pause"} calls, missed fees. Marking done here does not update Paper Ledger.`,
    headers: ["Due", "When", "Type", "Title", kit.customer, kit.contact, "Phone", "Open?", "Notes"],
    kinds: ["date", "text", "text", "text", "text", "text", "text", "text", "text"],
    data: items.map((item) => [
      excelSerial(item.dueOn) ?? item.dueOn,
      item.done ? "Done" : relativeDue(item.dueOn),
      kindLabel(item.kind, kit.showSummer),
      item.title,
      item.studentName ?? "",
      item.parentName ?? "",
      item.parentPhone ?? "",
      item.done ? "No" : "Yes",
      item.detail,
    ]),
    tabColor: "FFB4532A",
    freezeCol: 1,
    widths: [13, 16, 14, 32, 16, 18, 14, 10, 36],
  });
}

function buildAssets(state: LedgerState): Sheet {
  const fy = state.settings.fyStartYear;
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const headers = [
    "Asset",
    "Category",
    "Purchase",
    "Cost",
    "Residual",
    "Life (yrs)",
    "Months in FY",
    "Opening accum.",
    "Books amort (FY)",
    "Closing accum.",
    "NBV",
    "Tax WDV %",
    "Opening WDV",
    "Half-year?",
    "Tax dep (FY)",
    "Closing WDV",
    "Notes",
  ];
  const rows: Row[] = [
    { r: 1, ht: 26, cells: [{ c: 0, v: `Fixed asset register  ${fyLabel(fy, fyStartMonth)}`, s: S.banner }] },
    {
      r: 2,
      ht: 18,
      cells: [
        {
          c: 0,
          v: "Books amort, NBV and tax WDV are formulas from cost, life and opening figures. Half-year is Yes when the asset was bought in this FY and used under 180 days.",
          s: S.bannerSub,
        },
      ],
    },
    { r: 3, ht: 22, cells: headers.map((h, i) => ({ c: i, v: h, s: S.colHead })) },
  ];
  const lastCol = colLetter(headers.length - 1);
  const merges = [`A1:${lastCol}1`, `A2:${lastCol}2`];

  if (state.assets.length === 0) {
    rows.push({ r: 4, cells: [{ c: 0, v: "No assets on the register.", s: S.italic }] });
  }

  state.assets.forEach((a, idx) => {
    const r = 4 + idx;
    const books = assetPosition(a, fy, fyStartMonth);
    const taxA = taxDepreciationForAsset(a, fy, fyStartMonth);
    const purchased = a.purchaseDate;
    const fyStart = new Date(fy, fyStartMonth, 1);
    const openingWdv = new Date(purchased) >= fyStart ? a.cost : a.taxOpeningWdv;
    const stripe = idx % 2 === 1;
    const t = stripe ? S.zebraText : S.text;
    const n = stripe ? S.zebraNum : S.num;
    const d = stripe ? S.zebraDate : S.date;
    rows.push({
      r,
      cells: [
        { c: 0, v: a.name, s: t },
        { c: 1, v: ASSET_CATEGORY_LABEL[a.category], s: t },
        dateCell(2, a.purchaseDate, d),
        { c: 3, v: a.cost, s: n },
        { c: 4, v: a.residualValue, s: n },
        { c: 5, v: a.usefulLifeYears, s: S.int },
        { c: 6, v: books.monthsCharged, s: S.int },
        { c: 7, v: books.openingAccum, s: n },
        { c: 8, f: `IF(F${r}=0,0,MAX(0,D${r}-E${r})/F${r}/12*G${r})`, v: books.yearCharge, s: n },
        { c: 9, f: `MIN(MAX(0,D${r}-E${r}),H${r}+I${r})`, v: books.closingAccum, s: n },
        { c: 10, f: `MAX(0,D${r}-J${r})`, v: books.nbv, s: n },
        { c: 11, v: a.taxWdvRatePct, s: S.num },
        { c: 12, v: openingWdv, s: n },
        { c: 13, v: taxA.halfRate ? "Yes" : "No", s: t },
        {
          c: 14,
          f: `M${r}*L${r}/100*IF(N${r}="Yes",0.5,1)`,
          v: taxA.depreciation,
          s: n,
        },
        { c: 15, f: `MAX(0,M${r}-O${r})`, v: taxA.closingWdv, s: n },
        { c: 16, v: a.notes ?? "", s: t },
      ],
    });
  });

  const first = 4;
  const last = 3 + Math.max(state.assets.length, 1);
  const totals = last + 2;
  if (state.assets.length) {
    const costSum = state.assets.reduce((a, x) => a + x.cost, 0);
    const amortSum = state.assets.reduce(
      (a, x) => a + assetPosition(x, fy, fyStartMonth).yearCharge,
      0,
    );
    const nbvSum = state.assets.reduce((a, x) => a + assetPosition(x, fy, fyStartMonth).nbv, 0);
    const taxDepSum = state.assets.reduce(
      (a, x) => a + taxDepreciationForAsset(x, fy, fyStartMonth).depreciation,
      0,
    );
    const wdvSum = state.assets.reduce(
      (a, x) => a + taxDepreciationForAsset(x, fy, fyStartMonth).closingWdv,
      0,
    );
    rows.push({
      r: totals,
      cells: [
        { c: 0, v: "Totals", s: S.totalLabel },
        { c: 3, f: `SUM(D${first}:D${last})`, v: costSum, s: S.numBold },
        { c: 8, f: `SUM(I${first}:I${last})`, v: amortSum, s: S.numBold },
        { c: 10, f: `SUM(K${first}:K${last})`, v: nbvSum, s: S.numBold },
        { c: 14, f: `SUM(O${first}:O${last})`, v: taxDepSum, s: S.numBold },
        { c: 15, f: `SUM(P${first}:P${last})`, v: wdvSum, s: S.numBold },
      ],
    });
  }

  return {
    name: "Assets",
    rows,
    merges,
    cols: [
      { min: 1, max: 1, width: 26 },
      { min: 2, max: 2, width: 22 },
      { min: 3, max: 3, width: 13 },
      { min: 4, max: 5, width: 13 },
      { min: 6, max: 7, width: 13 },
      { min: 8, max: 11, width: 14 },
      { min: 12, max: 12, width: 12 },
      { min: 13, max: 16, width: 14 },
      { min: 17, max: 17, width: 24 },
    ],
    freeze: { col: 1, row: 3 },
    tabColor: "FF5C4A32",
    grid: true,
    autoFilter: `A3:${lastCol}${last}`,
    printTitles: "$1:$3",
  };
}

function buildTaxSheetStable(state: LedgerState, pnlRows: Record<string, number>, assetLast: number): Sheet {
  // Data rows 3–14 so Dashboard can keep Tax!B14 as tax payable.
  const tax = computeTax(state);
  const fy = fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3);
  const assetSum = assetLast >= 4 ? `SUM(Assets!O4:O${assetLast})` : "0";
  const rows: Row[] = [
    { r: 1, ht: 26, cells: [{ c: 0, v: `Tax computation  ${fy}`, s: S.banner }] },
    {
      r: 2,
      cells: [
        { c: 0, v: "Line", s: S.colHead },
        { c: 1, v: "Amount", s: S.colHead },
        { c: 2, v: "Source", s: S.colHead },
      ],
    },
  ];
  const push = (
    r: number,
    label: string,
    amount: number,
    formula: string | undefined,
    source: string,
    emphasis = false,
  ) => {
    rows.push({
      r,
      cells: [
        { c: 0, v: label, s: emphasis ? S.section : S.text },
        {
          c: 1,
          v: amount,
          ...(formula ? { f: formula } : {}),
          s: emphasis ? (amount < 0 ? S.numLoss : S.numBold) : S.num,
        },
        { c: 2, v: source, s: S.italic },
      ],
    });
  };
  push(3, "Profit before tax (as per P&L)", tax.profitBeforeTax, `PnL!N${pnlRows.profit}`, "PnL operating profit");
  push(4, "Add: disallowed expenses", tax.disallowed, undefined, "Typed from the app");
  push(5, "Add: amortisation per books", tax.bookAmortisation, `PnL!N${pnlRows.amort}`, "PnL amortisation YTD");
  push(6, "Less: depreciation as per tax (WDV)", -tax.taxDepreciation, `-${assetSum}`, "Assets column O");
  push(7, "Less: other deductions", -tax.otherDeductions, undefined, "Typed from the app");
  push(8, "Taxable income", tax.taxableIncome, "B3+B4+B5+B6+B7", "Sum of the lines above", true);
  push(9, `Income tax @ ${state.settings.taxRatePct}%`, tax.incomeTax, `MAX(0,B8)*${SET.taxRate}/100`, "Settings!B23");
  push(10, `Health & education cess @ ${state.settings.cessPct}%`, tax.cess, `B9*${SET.cessRate}/100`, "Settings!B24");
  push(11, "Total tax", tax.totalTax, "B9+B10", "Tax + cess", true);
  push(12, "Less: advance tax", -tax.advanceTax, undefined, "Typed from the app");
  push(13, "Less: TDS", -tax.tds, undefined, "Typed from the app");
  push(14, "Tax payable / (refund)", tax.taxPayable, "B11+B12+B13", "What is left to pay", true);
  rows.push({
    r: 16,
    cells: [
      {
        c: 0,
        v: "Edit B4, B7, B12, B13 if your accountant adjusts them. B3, B5, B6, B8–B11 and B14 are formulas. Rates live on Settings.",
        s: S.italic,
      },
    ],
  });
  return {
    name: "Tax",
    rows,
    merges: ["A1:C1", "A16:C16"],
    cols: [
      { min: 1, max: 1, width: 44 },
      { min: 2, max: 2, width: 18 },
      { min: 3, max: 3, width: 28 },
    ],
    freeze: { col: 0, row: 2 },
    tabColor: "FF241C1A",
    grid: true,
    printTitles: "$1:$2",
    cf: [{ sqref: "B14", operator: "lessThan", formula: "0" }],
  };
}

function buildCensusSheet(state: LedgerState, register: { statusCol: string; first: number; last: number }): Sheet {
  const kit = kitOf(state.settings.tradeId);
  const pop = census(state);
  const mix = subjectMix(state);
  const levels = kit.id === "tuition" ? levelMix(state) : [];
  const st = `Register!${register.statusCol}${register.first}:${register.statusCol}${register.last}`;
  const rows: Row[] = [
    { r: 1, ht: 26, cells: [{ c: 0, v: `Census  ${fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3)}`, s: S.banner }] },
    {
      r: 2,
      cells: [
        {
          c: 0,
          v: "Status counts are COUNTIF against Register. Offering mix is a snapshot of who is billed this month.",
          s: S.bannerSub,
        },
      ],
    },
    { r: 4, cells: [{ c: 0, v: "Register", s: S.sectionLoose }] },
    { r: 5, cells: ["Status", "Count"].map((h, i) => ({ c: i, v: h, s: S.colHead })) },
    { r: 6, cells: [{ c: 0, v: "Active", s: S.text }, { c: 1, v: pop.active, f: `COUNTIF(${st},"Active")`, s: S.int }] },
    { r: 7, cells: [{ c: 0, v: "Waiting", s: S.text }, { c: 1, v: pop.waiting, f: `COUNTIF(${st},"Waiting")`, s: S.int }] },
    { r: 8, cells: [{ c: 0, v: "Paused", s: S.text }, { c: 1, v: pop.paused, f: `COUNTIF(${st},"Paused")`, s: S.int }] },
    { r: 9, cells: [{ c: 0, v: "Returning", s: S.text }, { c: 1, v: pop.returning, f: `COUNTIF(${st},"Returning")`, s: S.int }] },
    { r: 10, cells: [{ c: 0, v: "Left", s: S.text }, { c: 1, v: pop.left, f: `COUNTIF(${st},"Left")`, s: S.int }] },
    { r: 11, cells: [{ c: 0, v: "Away (still billed)", s: S.text }, { c: 1, v: pop.away, s: S.int }] },
    { r: 12, cells: [{ c: 0, v: `${kit.group}s`, s: S.section }, { c: 1, v: pop.families, s: S.int }] },
    { r: 14, cells: [{ c: 0, v: kit.offeringsLabel, s: S.sectionLoose }] },
    {
      r: 15,
      cells: [kit.offering, "Count", "Monthly fee"].map((h, i) => ({ c: i, v: h, s: S.colHead })),
    },
  ];
  mix.forEach((row, i) => {
    rows.push({
      r: 16 + i,
      cells: [
        { c: 0, v: row.label, s: i % 2 ? S.zebraText : S.text },
        { c: 1, v: row.count, s: S.int },
        { c: 2, v: row.revenue, s: i % 2 ? S.zebraNum : S.num },
      ],
    });
  });
  let next = 16 + mix.length + 1;
  if (levels.length) {
    rows.push({ r: next, cells: [{ c: 0, v: "Kumon levels on the books", s: S.sectionLoose }] });
    next += 1;
    rows.push({
      r: next,
      cells: ["Level", "Students"].map((h, i) => ({ c: i, v: h, s: S.colHead })),
    });
    next += 1;
    levels.forEach((row, i) => {
      rows.push({
        r: next,
        cells: [
          { c: 0, v: row.label, s: i % 2 ? S.zebraText : S.text },
          { c: 1, v: row.count, s: S.int },
        ],
      });
      next += 1;
    });
  }
  return {
    name: "Census",
    rows,
    merges: ["A1:C1", "A2:C2"],
    cols: [
      { min: 1, max: 1, width: 28 },
      { min: 2, max: 2, width: 14 },
      { min: 3, max: 3, width: 16 },
    ],
    freeze: { col: 0, row: 2 },
    tabColor: "FF1C4A5C",
    grid: true,
    printTitles: "$1:$2",
  };
}

function buildRoyaltySheet(state: LedgerState, pnlRows: Record<string, number>): Sheet {
  const kit = kitOf(state.settings.tradeId);
  const fy = state.settings.fyStartYear;
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const heads = monthHeaders(fy, fyStartMonth);
  const months = Array.from({ length: 12 }, (_, i) => monthPnL(state, i));
  const license = licenseFeeSeries(state);
  const royalty = royaltyReport(state);
  const rows: Row[] = [
    { r: 1, ht: 26, cells: [{ c: 0, v: `${kit.royalty}  ${fyLabel(fy, fyStartMonth)}`, s: S.banner }] },
    {
      r: 2,
      ht: 18,
      cells: [
        {
          c: 0,
          v:
            state.settings.licenseFeeMode === "percent"
              ? `${royalty.rate}% of each ${kit.offering.toLowerCase()} fee. Dual-subject students pay twice. You keep ${royalty.keepPct.toFixed(2)}%. Rate lives on Settings!B19.`
              : `${royalty.rate} per ${kit.offering.toLowerCase()}.`,
          s: S.bannerSub,
        },
      ],
    },
    {
      r: 3,
      ht: 22,
      cells: [
        { c: 0, v: "Line", s: S.colHead },
        ...heads.map((h, i) => ({ c: i + 1, v: h, s: S.colHead })),
        { c: 13, v: "YTD", s: S.colHead },
      ],
    },
    formulaMonthRow(4, `${kit.revenue} (gross)`, (col) => `PnL!${col}${pnlRows.tuition}`, months.map((m) => m.grossTuition), S.num, S.text),
    formulaMonthRow(5, kit.discount, (col) => `PnL!${col}${pnlRows.discount}`, months.map((m) => -m.siblingDiscount), S.num, S.text),
    formulaMonthRow(6, kit.royalty, (col) => `PnL!${col}${pnlRows.license}`, license, S.numBold, S.section),
    formulaMonthRow(
      7,
      "You keep",
      (col) => `${col}4+${col}5-${col}6`,
      months.map((m) => m.grossTuition - m.siblingDiscount - m.licenseFee),
      S.numProfit,
      S.text,
    ),
  ];
  return {
    name: "Royalty",
    rows,
    merges: ["A1:N1", "A2:N2"],
    cols: [
      { min: 1, max: 1, width: 28 },
      { min: 2, max: 13, width: 13.2 },
      { min: 14, max: 14, width: 14 },
    ],
    freeze: { col: 1, row: 3 },
    tabColor: "FF9B1B2E",
    grid: true,
    printTitles: "$1:$3",
  };
}

function buildGuideSheet(state: LedgerState, sheetNames: string[]): Sheet {
  const kit = kitOf(state.settings.tradeId);
  const fy = fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3);
  const blocks: { title: string; lines: string[] }[] = [
    {
      title: "How to use this workbook",
      lines: [
        `Paper Ledger · ${state.settings.centreName || "untitled"} · ${fy} · ${kit.name}`,
        "This is a working Excel model, not a CSV dump. YTD, profit, royalty (percent mode), tax and dashboard KPIs are formulas.",
      ],
    },
    {
      title: "The two files (read this)",
      lines: [
        "Excel (.xlsx) — a snapshot you and your accountant can live in. Open it in Excel, Numbers, Google Sheets or LibreOffice. Edit months on PnL and rates on Settings; the dashboard follows.",
        "JSON backup — the only way to restore the live books inside Paper Ledger on another computer. Excel does not flow back into the app.",
        "On another computer: save a JSON backup here → open Paper Ledger there → Export → Restore. Keep the Excel file for the accountant.",
      ],
    },
    {
      title: "Sheets in this file",
      lines: sheetNames.map((name) => {
        switch (name) {
          case "Dashboard":
            return "Dashboard — year at a glance. Recalculates from PnL, Tax, Register and Settings.";
          case "PnL":
            return "PnL — monthly revenue and costs. Change a month; YTD, margin and profit follow.";
          case "Register":
            return `Register — ${kit.customers.toLowerCase()} billed this year, grouped by ${kit.group.toLowerCase()}. Snapshot.`;
          case "Census":
            return kit.id === "tuition"
              ? "Census — status, subject mix and Kumon levels. Status counts are COUNTIF on Register."
              : "Census — status and offering mix.";
          case "Royalty":
            return `Royalty — ${kit.royalty.toLowerCase()} by month, reading the PnL.`;
          case "Desk":
            return "Desk — follow-ups as of the moment you exported.";
          case "Assets":
            return "Assets — fixed asset register. Books amort, NBV and tax WDV are formulas.";
          case "Tax":
            return "Tax — working paper. Profit and tax charge are formulas. Not a filed return.";
          case "Settings":
            return "Settings — name, FY, royalty rate, sibling discount, tax rates. Other sheets point here.";
          default:
            return name;
        }
      }),
    },
    {
      title: "What the owner should edit here",
      lines: [
        "A month of rent, wages or other costs on PnL if you want to work in Excel this week.",
        "Royalty % or tax % on Settings if the rule changed.",
      ],
    },
    {
      title: "What to edit in Paper Ledger instead",
      lines: [
        `${kit.customers} (joins, leaves, waiting list, ${kit.id === "tuition" ? "levels, family discount, renewals" : "status, fees"}).`,
        "The desk, asset lives, and then export again so this file stays in step.",
      ],
    },
    {
      title: "For the accountant",
      lines: [
        "Currency number format, frozen headers, filters on Register / Desk / Assets, landscape print, repeating titles.",
        "Tax!B14 is tax payable. Tax!B3 is P&L profit. Assets column O is tax depreciation.",
        "Named cells on Settings: CentreName, SiblingDiscount, LicenseRate, TaxRate, CessRate.",
      ],
    },
  ];

  const rows: Row[] = [];
  const merges: string[] = [];
  let r = 1;
  blocks.forEach((block, bi) => {
    rows.push({ r, ht: bi === 0 ? 28 : 22, cells: [{ c: 0, v: block.title, s: bi === 0 ? S.banner : S.section }] });
    merges.push(`A${r}:F${r}`);
    r += 1;
    block.lines.forEach((line) => {
      rows.push({ r, ht: 36, cells: [{ c: 0, v: line, s: S.note }] });
      merges.push(`A${r}:F${r}`);
      r += 1;
    });
    r += 1;
  });

  return {
    name: "How to use",
    rows,
    merges,
    cols: [
      { min: 1, max: 1, width: 28 },
      { min: 2, max: 6, width: 18 },
    ],
    tabColor: "FF8A7A68",
    grid: false,
    printTitles: "$1:$1",
  };
}

function pack(files: Record<string, string>): Blob {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
    { level: 6 },
  );
  return new Blob([zipped], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export interface WorkbookSheetInfo {
  name: string;
  purpose: string;
}

export function workbookManifest(state: LedgerState): WorkbookSheetInfo[] {
  const kit = kitOf(state.settings.tradeId);
  const sheets: WorkbookSheetInfo[] = [
    { name: "Dashboard", purpose: "Year at a glance — formulas from PnL, Tax and Register" },
    { name: "PnL", purpose: "Monthly books. Edit a month; YTD and profit follow" },
    { name: "Register", purpose: `${kit.customers} grouped by ${kit.group.toLowerCase()}, with filters` },
    { name: "Census", purpose: "Status mix and offerings (COUNTIF on Register)" },
  ];
  if (state.settings.licenseFeeRate > 0) {
    sheets.push({ name: "Royalty", purpose: `${kit.royalty} by month, reading the PnL` });
  }
  sheets.push(
    { name: "Desk", purpose: "Renewals and follow-ups as of export" },
    { name: "Assets", purpose: "FAR with formula NBV and tax WDV" },
    { name: "Tax", purpose: "Working paper. Tax payable is B14" },
    { name: "Settings", purpose: "Rates and FY the rest of the file reads" },
    { name: "How to use", purpose: "Owner and accountant guide — the two-file rule" },
  );
  return sheets;
}

export function buildExcelFile(state: LedgerState): Blob {
  const { settings } = state;
  const fyStartMonth = settings.fyStartMonth ?? 3;
  const fy = fyLabel(settings.fyStartYear, fyStartMonth);
  const pnl = buildPnL(state);
  const register = buildRegister(state);
  const assets = buildAssets(state);
  const assetLast = 3 + Math.max(state.assets.length, 1);
  const tax = buildTaxSheetStable(state, pnl.rows, assetLast);
  const settingsSheet = buildSettings(state);
  const dashboard = buildDashboard(state, pnl.rows, {
    statusCol: register.statusCol,
    primaryCol: register.primaryCol,
    feeCol: register.feeCol,
    first: register.first,
    last: register.last,
  });

  const coreSheets: Sheet[] = [
    dashboard,
    pnl.sheet,
    register.sheet,
    buildCensusSheet(state, {
      statusCol: register.statusCol,
      first: register.first,
      last: register.last,
    }),
  ];
  if (settings.licenseFeeRate > 0) coreSheets.push(buildRoyaltySheet(state, pnl.rows));
  coreSheets.push(buildDeskSheet(state), assets, tax, settingsSheet);
  const guide = buildGuideSheet(
    state,
    coreSheets.map((s) => s.name).concat("How to use"),
  );
  const sheets = [...coreSheets, guide];

  const printNames = sheets
    .map((s, i) =>
      s.printTitles
        ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${s.name.replace(/'/g, "''")}'!${s.printTitles}</definedName>`
        : "",
    )
    .filter(Boolean)
    .join("\n    ");

  const definedNames = `<definedNames>
    <definedName name="CentreName">${SET.centre}</definedName>
    <definedName name="SiblingDiscount">${SET.sibling}</definedName>
    <definedName name="LicenseRate">${SET.licenseRate}</definedName>
    <definedName name="TaxRate">${SET.taxRate}</definedName>
    <definedName name="CessRate">${SET.cessRate}</definedName>
    <definedName name="NetRevenue">PnL!$N$${pnl.rows.net}</definedName>
    <definedName name="OperatingProfit">PnL!$N$${pnl.rows.profit}</definedName>
    <definedName name="TaxPayable">Tax!$B$14</definedName>
    ${printNames}
  </definedNames>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS.pkgRel}">
  ${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS.rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n  ")}
  <Relationship Id="rIdStyles" Type="${NS.rel}/styles" Target="styles.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS.main}" xmlns:r="${NS.rel}">
  <fileVersion appName="xl"/>
  <workbookPr date1904="0"/>
  <bookViews>
    <workbookView activeTab="0" firstSheet="0" showSheetTabs="1" tabRatio="700"/>
  </bookViews>
  <sheets>
    ${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("\n    ")}
  </sheets>
  ${definedNames}
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${NS.ct}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n  ")}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xml(`${settings.centreName} ${fy}`)}</dc:title>
  <dc:subject>${xml(`Paper Ledger working papers · ${kitOf(settings.tradeId).name}`)}</dc:subject>
  <dc:creator>Paper Ledger</dc:creator>
  <cp:lastModifiedBy>Paper Ledger</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
  <cp:category>Working papers</cp:category>
</cp:coreProperties>`;

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Paper Ledger</Application>
  <DocSecurity>0</DocSecurity>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${sheets.length}" baseType="lpstr">
      ${sheets.map((s) => `<vt:lpstr>${xml(s.name)}</vt:lpstr>`).join("\n      ")}
    </vt:vector>
  </TitlesOfParts>
  <Company>${xml(settings.centreName || "Paper Ledger")}</Company>
</Properties>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS.pkgRel}">
  <Relationship Id="rId1" Type="${NS.rel}/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="${NS.rel}/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const header = `&L&8Paper Ledger&C&B&A&R&8${settings.centreName} · ${fy}`;
  const footer = `&L&8Working papers — not a filed return&C&8Page &P of &N&R&8Confidential`;

  const files: Record<string, string> = {
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRels,
    "xl/workbook.xml": workbook,
    "xl/_rels/workbook.xml.rels": wbRels,
    "xl/styles.xml": stylesXml(currencyFormat(settings.currency)),
    "docProps/core.xml": core,
    "docProps/app.xml": app,
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s, header, footer);
  });
  return pack(files);
}

export function excelFilename(state: LedgerState): string {
  const raw = `${state.settings.centreName}-${fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3)}`;
  return `${raw.replace(/[–—]/g, "-").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-")}.xlsx`;
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
