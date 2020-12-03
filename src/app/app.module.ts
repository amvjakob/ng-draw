import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { FreehandDrawingDirective } from './directives/freehand-drawing.directive';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule, MatDialogModule, MatIconModule, MatMenuModule, MatToolbarModule } from '@angular/material';
import { InfoComponent } from './info/info.component';
import { HttpClientModule } from '@angular/common/http';
import { ApiService } from './services/api.service';
import { SocketService } from './services/socket.service';

@NgModule({
  declarations: [
    AppComponent,
    FreehandDrawingDirective,
    InfoComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatMenuModule
  ],
  providers: [
    ApiService,
    SocketService
  ],
  bootstrap: [AppComponent],
  entryComponents: [InfoComponent]
})
export class AppModule { }
