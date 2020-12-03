import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, timer, Subject, EMPTY } from 'rxjs';
import { retryWhen, tap, delayWhen, switchAll, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export const WS_ENDPOINT = environment.socketEndpoint;
export const RECONNECT_INTERVAL = environment.reconnectInterval;

class ConnectionConfig {
  reconnect: boolean;
  attempt: number;
}

// from https://javascript-conference.com/blog/real-time-in-angular-a-journey-into-websocket-and-rxjs/
@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket$: WebSocketSubject<any>;
  private messagesSubject$ = new Subject();
  public messages$ = this.messagesSubject$.pipe(switchAll(), catchError(e => { throw e }));

  constructor() { }
 
  /**
   * Creates a new WebSocket subject and send it to the messages subject
   * @param cfg if true the observable will be retried.
   */
  public connect(config: ConnectionConfig = { reconnect: false, attempt: 0 }): void {
    if (!this.socket$ || this.socket$.closed) {
      // create new socket
      this.socket$ = this.getNewWebSocket(config.attempt);

      // get messages
      const messages = this.socket$.pipe(
        (config.reconnect && config.attempt < 3) ? this.reconnect : o => o,
        tap({
          error: error => console.log(error),
        }),
        catchError(_ => EMPTY)
      );

      //toDO only next an observable if a new subscription was made double-check this
      this.messagesSubject$.next(messages);
    }
  }

  /**
   * Retry a given observable by a time span
   * @param observable the observable to be retried
   */
  private reconnect(observable: Observable<any>): Observable<any> {
    return observable.pipe(
      retryWhen(errors => errors.pipe(
        tap(val => console.log('socket: trying to reconnect', val)),
        delayWhen(_ => timer(RECONNECT_INTERVAL))
      ))
    );
  }

  close() {
    this.socket$.complete();
    this.socket$ = undefined;
  }

  sendMessage(msg: any) {
    this.socket$.next(msg);
  }

  /**
   * Return a custom WebSocket subject which reconnects after failure
   */
  private getNewWebSocket(attempt: number = 0) {
    return webSocket({
      url: WS_ENDPOINT,
      // serializer: msg => JSON.stringify({roles: "admin,user", msg: {...msg}}),
      openObserver: {
        next: () => {
          console.log('socket: connection opened');
        }
      },
      closeObserver: {
        next: () => {
          console.log('socket: connection closed');
          this.socket$ = undefined;
          if (attempt < 3)
            this.connect({ reconnect: true, attempt: attempt + 1 });
        }
      },

    });
  }
}




