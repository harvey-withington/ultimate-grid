/**
 * @ultimate-grid/react
 * React wrapper component for @ultimate-grid/core.
 *
 * Usage:
 *   import { UltimateGrid } from '@ultimate-grid/react';
 *
 *   <UltimateGrid
 *     columnDefs={columnDefs}
 *     rowData={rowData}
 *     selectionMode="multi"
 *     rowHeight={36}
 *     cellRenderer={customCellRenderer}
 *     onGridReady={(api) => setGridApi(api)}
 *     onSortChanged={handleSortChanged}
 *     onFilterChanged={handleFilterChanged}
 *     onSelectionChanged={handleSelectionChanged}
 *   />
 */

import { useRef, useEffect, type CSSProperties, type ReactElement } from 'react';
import { createGrid } from '../../core/src/index.ts';
import type { RenderPipelineOptions } from '../../core/src/render/RenderPipeline.ts';
import type {
  ColumnDef,
  GridApi,
  GridOptions,
  GridEventMap,
} from '../../core/src/types.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UltimateGridProps<TData = unknown> {
  columnDefs: ColumnDef<TData>[];
  rowData?: TData[];
  selectionMode?: GridOptions<TData>['selectionMode'];
  rowHeight?: number;
  cellRenderer?: RenderPipelineOptions['cellRenderer'];
  options?: Partial<GridOptions<TData>>;
  onGridReady?: (api: GridApi<TData>) => void;
  onRowDataChanged?:    (e: GridEventMap['rowDataChanged'])    => void;
  onSortChanged?:       (e: GridEventMap['sortChanged'])       => void;
  onFilterChanged?:     (e: GridEventMap['filterChanged'])     => void;
  onSelectionChanged?:  (e: GridEventMap['selectionChanged'])  => void;
  onColumnResized?:     (e: GridEventMap['columnResized'])     => void;
  onColumnMoved?:       (e: GridEventMap['columnMoved'])       => void;
  onCellClicked?:       (e: GridEventMap['cellClicked'])       => void;
  onCellDoubleClicked?: (e: GridEventMap['cellDoubleClicked']) => void;
  onActiveCellChanged?:  (e: GridEventMap['activeCellChanged'])  => void;
  className?: string;
  style?: CSSProperties;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UltimateGrid<TData = unknown>(
  props: UltimateGridProps<TData>,
): ReactElement {
  const {
    columnDefs,
    rowData,
    selectionMode = 'multi',
    rowHeight,
    cellRenderer,
    options,
    onGridReady,
    onRowDataChanged,
    onSortChanged,
    onFilterChanged,
    onSelectionChanged,
    onColumnResized,
    onColumnMoved,
    onCellClicked,
    onCellDoubleClicked,
    onActiveCellChanged,
    className,
    style,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef       = useRef<GridApi<TData> | null>(null);
  const unsubRef     = useRef<Array<() => void>>([]);

  // Keep latest callback refs so mount effect closure never goes stale
  const cbRefs = useRef({
    onGridReady,
    onRowDataChanged,
    onSortChanged,
    onFilterChanged,
    onSelectionChanged,
    onColumnResized,
    onColumnMoved,
    onCellClicked,
    onCellDoubleClicked,
    onActiveCellChanged,
  });
  useEffect(() => {
    cbRefs.current = {
      onGridReady,
      onRowDataChanged,
      onSortChanged,
      onFilterChanged,
      onSelectionChanged,
      onColumnResized,
      onColumnMoved,
      onCellClicked,
      onCellDoubleClicked,
      onActiveCellChanged,
    };
  });

  // ── Mount / remount when columnDefs change ─────────────────────────────────
  // rowData and callbacks are intentionally excluded from deps:
  //   - rowData updates are handled by the separate effect below
  //   - callbacks are accessed via cbRefs so they never trigger a remount
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy any previous instance
    unsubRef.current.forEach((fn) => fn());
    unsubRef.current = [];
    if (apiRef.current) {
      apiRef.current.destroy();
      apiRef.current = null;
    }

    const api = createGrid<TData>({
      ...options,
      container:     containerRef.current,
      columnDefs,
      rowData:       rowData ?? [],
      selectionMode: selectionMode ?? options?.selectionMode ?? 'multi',
      rowHeight:     rowHeight    ?? options?.rowHeight,
      cellRenderer,
    });

    apiRef.current = api;

    // Subscribe to events and forward to prop callbacks via cbRefs
    unsubRef.current.push(
      api.on('rowDataChanged',   (e) => cbRefs.current.onRowDataChanged?.(e)),
      api.on('sortChanged',      (e) => cbRefs.current.onSortChanged?.(e)),
      api.on('filterChanged',    (e) => cbRefs.current.onFilterChanged?.(e)),
      api.on('selectionChanged', (e) => cbRefs.current.onSelectionChanged?.(e)),
      api.on('columnResized',    (e) => cbRefs.current.onColumnResized?.(e)),
      api.on('columnMoved',      (e) => cbRefs.current.onColumnMoved?.(e)),
      api.on('cellClicked',      (e) => cbRefs.current.onCellClicked?.(e)),
      api.on('cellDoubleClicked',(e) => cbRefs.current.onCellDoubleClicked?.(e)),
      api.on('activeCellChanged', (e) => cbRefs.current.onActiveCellChanged?.(e)),
    );

    cbRefs.current.onGridReady?.(api);

    return () => {
      unsubRef.current.forEach((fn) => fn());
      unsubRef.current = [];
      api.destroy();
      apiRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnDefs, selectionMode, rowHeight]);

  // ── Sync rowData without remounting ───────────────────────────────────────
  useEffect(() => {
    if (apiRef.current && rowData !== undefined) {
      apiRef.current.setRowData(rowData);
    }
  }, [rowData]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}

export default UltimateGrid;
