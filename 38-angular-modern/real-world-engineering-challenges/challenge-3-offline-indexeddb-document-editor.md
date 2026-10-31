# Challenge 3: Offline-First Collaborative Document Editor

## Architecture Overview
In this challenge, you will build an Offline-First Collaborative Document Editor. You will bridge the gap between asynchronous RxJS streams (handling `fromEvent` for network status and debounced user input) and synchronous Angular Signals (representing the current UI state). The document should save to a mocked IndexedDB locally and simulate syncing to the cloud when online.

## 1. Starter Template

```typescript
import { Component, signal, OnInit } from '@angular/core';

@Component({
  selector: 'app-document-editor',
  standalone: true,
  template: `
    <div class="editor-container">
      <header>
        <div class="title-bar">
          <h1>Project Specifications</h1>
          <!-- TODO: Use a signal to show Online (green) or Offline (red) -->
          <span class="status-badge offline">Offline</span>
        </div>

        <!-- TODO: Show 'Saving...' or 'Saved to Cloud' or 'Saved Locally' based on sync state -->
        <div class="sync-status">Status: Waiting...</div>
      </header>

      <!-- TODO: Bind this textarea to a signal and update it on input -->
      <textarea
        class="doc-area"
        placeholder="Start typing your document here...">
      </textarea>
    </div>
  `,
  styles: [`
    .editor-container { max-width: 800px; margin: 2rem auto; font-family: system-ui; }
    header { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 1rem 1.5rem; border-radius: 8px 8px 0 0; border: 1px solid #cbd5e1; border-bottom: none; }
    .title-bar { display: flex; align-items: center; gap: 1rem; }
    h1 { margin: 0; font-size: 1.25rem; color: #0f172a; }
    .status-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
    .online { background: #dcfce7; color: #166534; }
    .offline { background: #fee2e2; color: #991b1b; }
    .sync-status { font-size: 0.875rem; color: #64748b; font-style: italic; }
    .doc-area { width: 100%; height: 500px; padding: 1.5rem; font-size: 1rem; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 0 0 8px 8px; resize: vertical; outline: none; box-sizing: border-box; }
    .doc-area:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
  `]
})
export class DocumentEditorComponent implements OnInit {
  // TODO: Create a signal for the document content
  // TODO: Create a signal for the online status
  // TODO: Create a signal for the sync status ('Idle' | 'Saving' | 'Saved Cloud' | 'Saved Local')

  ngOnInit() {
    // TODO: Use RxJS fromEvent(window, 'online'/'offline') to update the online status signal
    // TODO: Convert the document content signal to an Observable using toObservable
    // TODO: Pipe the observable through debounceTime(1000)
    // TODO: Subscribe to the stream. If online, mock a cloud save. If offline, mock an IndexedDB save.
  }
}
```

## 2. Production Solution & Walkthrough

### Step 1: Managing Network State with RxJS
We use `fromEvent(window, 'online')` and `fromEvent(window, 'offline')` to create RxJS streams. We subscribe to these streams to update an `isOnline` writable signal. (In Angular 17/18, you could also use a built-in function or `toSignal` here, but manual subscription inside an effect or `ngOnInit` is fine for side-effects).

### Step 2: RxJS Interop for Debounced Saving
We create `documentContent = signal('')`. We want to save the document 1 second after the user *stops* typing. Signals cannot do this alone.
We use `toObservable(this.documentContent)` to turn the signal into an RxJS stream.
We pipe it through `skip(1)` (to avoid saving the initial empty state) and `debounceTime(1000)`.

### Step 3: Conditional Side Effects
In the subscription, we check `untracked(this.isOnline)`. If true, we simulate an HTTP call to the cloud, updating the `syncStatus` signal to 'Saving...' then 'Saved Cloud'. If false, we simulate an IndexedDB write, updating it to 'Saved Local'.

### Complete Solution Code

```typescript
import { Component, signal, effect, untracked, OnDestroy } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { fromEvent, Subscription, of, timer } from 'rxjs';
import { debounceTime, skip, switchMap, tap } from 'rxjs/operators';

type SyncState = 'Idle' | 'Saving...' | 'Saved Cloud' | 'Saved Local';

@Component({
  selector: 'app-document-editor',
  standalone: true,
  template: `
    <div class="editor-container">
      <header>
        <div class="title-bar">
          <h1>Project Specifications</h1>
          @if (isOnline()) {
            <span class="status-badge online">Online</span>
          } @else {
            <span class="status-badge offline">Offline</span>
          }
        </div>

        <div class="sync-status">Status: {{ syncStatus() }}</div>
      </header>

      <textarea
        class="doc-area"
        placeholder="Start typing your document here..."
        [value]="documentContent()"
        (input)="updateContent($event)">
      </textarea>
    </div>
  `,
  styles: [`
    .editor-container { max-width: 800px; margin: 2rem auto; font-family: system-ui; }
    header { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 1rem 1.5rem; border-radius: 8px 8px 0 0; border: 1px solid #cbd5e1; border-bottom: none; }
    .title-bar { display: flex; align-items: center; gap: 1rem; }
    h1 { margin: 0; font-size: 1.25rem; color: #0f172a; }
    .status-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
    .online { background: #dcfce7; color: #166534; }
    .offline { background: #fee2e2; color: #991b1b; }
    .sync-status { font-size: 0.875rem; color: #64748b; font-weight: 500; }
    .doc-area { width: 100%; height: 500px; padding: 1.5rem; font-size: 1rem; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 0 0 8px 8px; resize: vertical; outline: none; box-sizing: border-box; }
    .doc-area:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
  `]
})
export class DocumentEditorComponent implements OnDestroy {
  // 1. Synchronous UI State
  documentContent = signal<string>('');
  isOnline = signal<boolean>(navigator.onLine);
  syncStatus = signal<SyncState>('Idle');

  private subs = new Subscription();

  constructor() {
    // 2. RxJS for Network Events
    this.subs.add(
      fromEvent(window, 'online').subscribe(() => {
        this.isOnline.set(true);
        // Automatically trigger a save to push local data to cloud when back online
        this.triggerSave(untracked(this.documentContent));
      })
    );
    this.subs.add(
      fromEvent(window, 'offline').subscribe(() => this.isOnline.set(false))
    );

    // 3. RxJS Interop for Debounced Saves
    const content$ = toObservable(this.documentContent);

    this.subs.add(
      content$.pipe(
        skip(1), // Don't trigger on initial load
        tap(() => this.syncStatus.set('Idle')), // Clear status while typing
        debounceTime(1000), // Wait 1s after typing stops
        switchMap(content => this.triggerSave(content))
      ).subscribe()
    );
  }

  updateContent(event: Event) {
    this.documentContent.set((event.target as HTMLTextAreaElement).value);
  }

  private triggerSave(content: string) {
    this.syncStatus.set('Saving...');

    // Read the current online state without making it a dependency of an effect
    const online = untracked(this.isOnline);

    if (online) {
      // Mock Cloud Save (HTTP)
      return timer(500).pipe(
        tap(() => {
          console.log('Saved to Cloud API:', content.substring(0, 20) + '...');
          this.syncStatus.set('Saved Cloud');
        })
      );
    } else {
      // Mock Local Save (IndexedDB)
      return timer(100).pipe(
        tap(() => {
          console.log('Saved to local IndexedDB (Offline mode)');
          this.syncStatus.set('Saved Local');
        })
      );
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}
```
