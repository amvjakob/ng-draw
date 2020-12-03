import { AfterViewInit, ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Subscription } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { FreehandDrawingDirective } from './directives/freehand-drawing.directive';
import { InfoComponent } from './info/info.component';
import { ApiService } from './services/api.service';
import { SocketService } from './services/socket.service';

const EVENT_ADD_STROKES = "add_strokes";
const EVENT_UNDO_STROKE = "undo_stroke";
const EVENT_DELETE_STROKES = "delete_strokes";

class Stroke {
  id?: string;
  local_id?: number;
  x: number[];
  y: number[];
}

class SocketStrokes {
  id: string;
  strokes: Stroke[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
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
  public fillColor: string;

  // store x- and y-coordinates of stroke
  private _freehandX: number[][];
  private _freehandY: number[][];
  private _freehandIdx: number[];

  private _sentStrokes: Stroke[];

  // Freehand Drawing Area
  @ViewChild(FreehandDrawingDirective, { static: true })
  private _freehand: FreehandDrawingDirective;

  private socketSubscription: Subscription;
  private socketStrokesContainer: SocketStrokes[];
  private socketUuid: string;

  private drawing = false;

  constructor(
    public dialog: MatDialog,
    private api: ApiService,
    private socket: SocketService
  ) {
    this.fillColor = this.colors[Math.floor(Math.random() * this.colors.length)];

    this._freehandX = [];
    this._freehandY = [];
    this._freehandIdx = [];

    this._sentStrokes = [];

    this.socketStrokesContainer = [];
  }

  // TODO add color

  // FAM we only want interaction on "Send"
  // bug now: if I send 2 strokes, then add 3, then undo, then in the other window the 2nd stroke disappears (should not do that)
  // proposed solution: send every stroke

  public ngOnInit(): void {
    this.socketSubscription = this.socket.messages$.pipe(
      catchError(error => { throw error }),
      tap({
        error: error => console.log('[app component] Error:', error),
        complete: () => console.log('[app component] Connection closed')
      }),
    ).subscribe(message => {
      if (message && message["id"] && message["event_type"]) {
        const uuid: string = message["id"];
        let strokes: Stroke[] = message["strokes"];

        switch (message["event_type"]) {
          case EVENT_ADD_STROKES:
            if (
              this._sentStrokes.length == strokes.length &&
              strokes.every((s, i) => {
                return s.x.every((x, ii) => Math.abs(x - this._sentStrokes[i].x[ii]) < 0.001) && 
                  s.y.every((y, ii) => Math.abs(y - this._sentStrokes[i].y[ii]) < 0.001);
              })
            ) {
              // strokes are from self
              console.log("same");
              this.socketUuid = uuid;

              // add mapping from stroke to freehand index
              strokes = strokes.map((s, i) => {
                s.local_id = this._freehandIdx[i];
                return s;
              })
            }

            const socketStrokes: SocketStrokes = { id: uuid, strokes: strokes };

            // add to strokes container
            const socketStrokesIdx = this.socketStrokesContainer.findIndex((s) => s.id == uuid);
            if (socketStrokesIdx > -1) {
              this.socketStrokesContainer.splice(socketStrokesIdx, 1, socketStrokes);
            } else {
              this.socketStrokesContainer.push(socketStrokes);
            }   
            
            break;
            
          case EVENT_DELETE_STROKES:
            this.socketStrokesContainer = this.socketStrokesContainer.filter(ss => ss.id != uuid);
            break;

          case EVENT_UNDO_STROKE:
            this.socketStrokesContainer = this.socketStrokesContainer.map(ss => {
              if (ss.id == uuid && ss.strokes.length > 0) {
                ss.strokes = ss.strokes.slice(0, ss.strokes.length - 1);
              }
              return ss;
            });
            break;

          default:
            break;
        }

        if (!this.drawing)
          this.syncWithSocketStrokes();
      }
    });
  }

  public ngOnDestroy(): void {
    this.socketSubscription.unsubscribe();
  }

  public ngAfterViewInit(): void {
    this.socket.connect();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
  }

  public syncWithSocketStrokes() {
    // delete old strokes
    const numStrokes = this._freehand.numStrokes;
    for (var i = numStrokes - 1; i >= 0; --i) {
      const externalStrokes = this.socketStrokesContainer
        .filter(ss => ss.id != this.socketUuid)
        .map(ss => ss.strokes)
        .reduce((acc, curr) => acc.concat(curr), []);

      if (externalStrokes.find(stroke => stroke.local_id == i) === undefined &&
          this._freehandIdx.find(idx => idx == i) === undefined) {
        this._freehand.eraseStroke(i);

        // adapt mapping
        this.socketStrokesContainer = this.socketStrokesContainer.map(ss => {
          ss.strokes = ss.strokes.map(stroke => {
            if (stroke.local_id !== undefined && stroke.local_id > i) {
              stroke.local_id -= 1;
            }
            return stroke;
          });
          return ss;
        });
        this._freehandIdx = this._freehandIdx.map(idx => {
          if (idx > i) return idx - 1;
          else return idx;
        })
      }
    }

    // draw new strokes
    let mapping = {};
    this.socketStrokesContainer.forEach(ss => {
      if (ss.id != this.socketUuid) {
        ss.strokes.forEach(stroke => {
          if (stroke.local_id === undefined) {
            const len = stroke.x.length;
            this._freehand.beginStrokeAt(stroke.x[0], stroke.y[0], -1, true);
            stroke.x.forEach((x, i) => {
              if (i > 0 && i < len - 1)
              this._freehand.updateStroke(x, stroke.y[i]);
            })
            this._freehand.endStrokeAt(stroke.x[len - 1], stroke.y[len - 1], true);

            mapping[stroke.id] = this._freehand.numStrokes;
          }
        });
      }
    });

    // apply mapping
    this.socketStrokesContainer = this.socketStrokesContainer.map(ss => {
      ss.strokes = ss.strokes.map(stroke => {
        if (stroke.local_id === undefined) {
          stroke.local_id = mapping[stroke.id];
        }
        return stroke;
      });
      return ss;
    })
  }

  /**
   * Execute whenever a stroke is initiated
   */
  public onBeginStroke(): void {
    this.drawing = true;
  }

  /**
   * Execute whenever a stroke is terminated
   */
  public onEndStroke(): void {
    this.drawing = false;

    // Access the sequence of x- and y-coordinates that define the current stroke
    this._freehandX.push(this._freehand.x);
    this._freehandY.push(this._freehand.y);
    this._freehandIdx.push(this._freehand.numStrokes - 1);

    // sync socket
    this.syncWithSocketStrokes();
  }

  /**
   * Execute when the user clicks the 'Clear' button; clear the freehand drawing area
   */
  public onClear(): void {
    // adapt external stroke indexes
    this._freehandIdx.sort()
      .reverse()
      .forEach(idx => {
        this._freehand.eraseStroke(idx);

        // adapt mapping
        this.socketStrokesContainer = this.socketStrokesContainer.map(ss => {
          ss.strokes = ss.strokes.map(stroke => {
            if (stroke.local_id !== undefined && stroke.local_id > idx) {
              stroke.local_id -= 1;
            }
            return stroke;
          });
          return ss;
        });
      })

    this._freehandX = [];
    this._freehandY = [];
    this._freehandIdx = [];

    if (this.socketUuid) {
      this.socketStrokesContainer = this.socketStrokesContainer.filter(ss => ss.id != this.socketUuid);

      // notify socket
      const message = JSON.stringify({
        event_type: EVENT_DELETE_STROKES
      });
      this.socket.sendMessage(message);
    }
  }

  /**
   * Execute when the user clicks the 'Undo' button; remove the last stroke
   */
  public onUndo(): void {
    if (this._freehandIdx.length) {
      // adapt other stroke indexes
      const lastIdx = this._freehandIdx.pop();

      // adapt mapping
      this.socketStrokesContainer = this.socketStrokesContainer.map(ss => {
        ss.strokes = ss.strokes.map(stroke => {
          if (stroke.local_id !== undefined && stroke.local_id > lastIdx) {
            stroke.local_id -= 1;
          }
          return stroke;
        });
        return ss;
      });

      this._freehand.eraseStroke(lastIdx);
      this._freehandX.pop();
      this._freehandY.pop();
      
      if (this.socketUuid) {
        this.socketStrokesContainer = this.socketStrokesContainer.map(ss => {
          if (ss.id == this.socketUuid && ss.strokes.length > 0) {
            ss.strokes = ss.strokes.slice(0, ss.strokes.length - 1);
          }
          return ss;
        });

        // notify socket
        const message = JSON.stringify({
          event_type: EVENT_UNDO_STROKE
        });
        this.socket.sendMessage(message);
      }
    }
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
    // this._freehand.exportAsImage();

    // prepare strokes data
    this._sentStrokes = [];
    this._freehandX.forEach((x, i) => {
      this._sentStrokes.push({ x: x, y: this._freehandY[i] })
    });
  
    // send data
    const message = JSON.stringify({
      strokes: this._sentStrokes,
      event_type: EVENT_ADD_STROKES
    });
    this.socket.sendMessage(message);
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
