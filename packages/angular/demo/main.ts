import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component.ts';

bootstrapApplication(AppComponent).catch((err: unknown) => console.error(err));
