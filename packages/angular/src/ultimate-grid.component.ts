/**
 * @ultimate-grid/angular
 * Angular 17+ standalone component wrapping @ultimate-grid/core.
 *
 * Usage:
 *   import { UltimateGridComponent } from '@ultimate-grid/angular';
 *
 *   @Component({
 *     imports: [UltimateGridComponent],
 *     template: `
 *       <ultimate-grid
 *         [columnDefs]="columnDefs"
 *         [rowData]="rowData"
 *         selectionMode="multi"
 *         [rowHeight]="36"
 *         [cellRenderer]="customCellRenderer"
 *         (gridReady)="onGridReady($event)"
 *         (sortChanged)="onSortChanged($event)"
 *         (filterChanged)="onFilterChanged($event)"
 *         (selectionChanged)="onSelectionChanged($event)"
 *       />
 *     `,
 *   })
 */

import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { createGrid } from '../../core/src/index.ts';
import type { RenderPipelineOptions } from '../../core/src/render/RenderPipeline.ts';
import type {
  ColumnDef,
  GridApi,
  GridOptions,
  GridEventMap,
} from '../../core/src/types.ts';

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'ultimate-grid',
  standalone: true,
  template: `<div #container style="width:100%;height:100%"></div>`,
  encapsulation: ViewEncapsulation.None,
})
export class UltimateGridComponent<TData = unknown>
  implements AfterViewInit, OnDestroy, OnChanges
{
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  // ─── Inputs ────────────────────────────────────────────────────────────────

  @Input() columnDefs:    ColumnDef<TData>[]                        = [];
  @Input() rowData?:      TData[];
  @Input() selectionMode?: GridOptions<TData>['selectionMode'];
  @Input() rowHeight?:    number;
  @Input() cellRenderer?: RenderPipelineOptions['cellRenderer'];
  @Input() options?:      Partial<GridOptions<TData>>;

  // ─── Outputs ───────────────────────────────────────────────────────────────

  @Output() gridReady        = new EventEmitter<GridApi<TData>>();
  @Output() rowDataChanged   = new EventEmitter<GridEventMap['rowDataChanged']>();
  @Output() sortChanged      = new EventEmitter<GridEventMap['sortChanged']>();
  @Output() filterChanged    = new EventEmitter<GridEventMap['filterChanged']>();
  @Output() selectionChanged = new EventEmitter<GridEventMap['selectionChanged']>();
  @Output() columnResized    = new EventEmitter<GridEventMap['columnResized']>();
  @Output() columnMoved      = new EventEmitter<GridEventMap['columnMoved']>();
  @Output() cellClicked      = new EventEmitter<GridEventMap['cellClicked']>();
  @Output() cellDoubleClicked= new EventEmitter<GridEventMap['cellDoubleClicked']>();

  // ─── Internal ──────────────────────────────────────────────────────────────

  private api:       GridApi<TData> | null = null;
  private unsubFns:  Array<() => void>     = [];

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.mountGrid();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.api) return; // Not yet mounted

    const structural = changes['columnDefs'] || changes['selectionMode'] || changes['rowHeight'];
    if (structural) {
      this.mountGrid();
    } else if (changes['rowData']) {
      this.api.setRowData(this.rowData ?? []);
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  getApi(): GridApi<TData> | null {
    return this.api;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private mountGrid(): void {
    if (!this.containerRef?.nativeElement) return;

    this.cleanup();

    this.api = createGrid<TData>({
      ...this.options,
      container:     this.containerRef.nativeElement,
      columnDefs:    this.columnDefs,
      rowData:       this.rowData ?? [],
      selectionMode: this.selectionMode ?? this.options?.selectionMode ?? 'multi',
      rowHeight:     this.rowHeight ?? this.options?.rowHeight,
      cellRenderer:  this.cellRenderer,
    });

    this.unsubFns.push(
      this.api.on('rowDataChanged',    e => this.rowDataChanged.emit(e)),
      this.api.on('sortChanged',       e => this.sortChanged.emit(e)),
      this.api.on('filterChanged',     e => this.filterChanged.emit(e)),
      this.api.on('selectionChanged',  e => this.selectionChanged.emit(e)),
      this.api.on('columnResized',     e => this.columnResized.emit(e)),
      this.api.on('columnMoved',       e => this.columnMoved.emit(e)),
      this.api.on('cellClicked',       e => this.cellClicked.emit(e)),
      this.api.on('cellDoubleClicked', e => this.cellDoubleClicked.emit(e)),
    );

    this.gridReady.emit(this.api);
  }

  private cleanup(): void {
    this.unsubFns.forEach(fn => fn());
    this.unsubFns = [];
    if (this.api) {
      this.api.destroy();
      this.api = null;
    }
  }
}
