import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material';
import { FreehandDrawingDirective } from './directives/freehand-drawing.directive';
import { InfoComponent } from './info/info.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  // cache strokes?
  public cacheStrokes: boolean;

  public colors = [
    'f44336',
    'E91E63',
    '9C27B0',
    '673AB7',
    '3F51B5',
    '2196F3',
    '03A9F4',
    '00BCD4',
    '009688',
    '4CAF50',
    '8BC34A',
    'CDDC39',
    'FFEB3B',
    'FFC107',
    'FF9800',
    'FF5722',
    '795548',
    '9E9E9E',
    '607D8B'
  ];
  public fillColor = this.colors[0];

  // store x- and y-coordinates of stroke
  private _freehandX: Array<number>;
  private _freehandY: Array<number>;

  // Freehand Drawing Area
  @ViewChild(FreehandDrawingDirective, { static: true })
  private _freehand: FreehandDrawingDirective;

  constructor(
    public dialog: MatDialog
  ) {
    // Set to true to enable recording of x-y coordinates in the drawing area
    this.cacheStrokes = false;

    this._freehandX = new Array<number>();
    this._freehandY = new Array<number>();
  }

  public ngOnInit(): void {

  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    console.log(event.target);
  }

  /**
   * Execute whenever a stroke is initiated
   */
  public onBeginStroke(): void {
    if (this.cacheStrokes) {
      this._freehandX.length = 0;
      this._freehandY.length = 0;
    }
  }

  /**
   * Execute whenever a stroke is terminated
   */
  public onEndStroke(): void {
    // Access the sequence of x- and y-coordinates that define the current stroke
    if (this.cacheStrokes) {
      this._freehandX = this._freehand.x;
      this._freehandY = this._freehand.y;
    }
  }

  /**
   * Execute when the user clicks the 'Clear' button; clear the freehand drawing area
   */
  public onClear(): void {
    this._freehand.clear();
  }

  /**
   * Execute when the user clicks the 'Undo' button; remove the last stroke
   */
  public onUndo(): void {
    this._freehand.eraseStroke(this._freehand.numStrokes - 1);
  }

  /**
   * Execute when the user clicks the 'Color' button; open color picker
   */
  public onPickColor(color: string): void {
    this.fillColor = color;
  }

  /**
   * Execute when the user clicks the 'Send' button; send pic to handler
   */
  public onSend(): void {
    this._freehand.exportAsImage();
  }

  /**
   * Open info dialog
   */
  public onClickInfo(): void {
    const dialogRef = this.dialog.open(InfoComponent);

    dialogRef.afterClosed().subscribe(result => {
      // console.log(`Dialog result: ${result}`);
    });
  }


}
