import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PrivateComponent } from './private/private.component';
import { AuthGuard } from './auth.guard';
import {SilentCallbackComponent} from './silent-callback/silent-callback.component';

export const ROUTES: Routes = [
  { path: '', component: HomeComponent },
  { path: 'silent', component: SilentCallbackComponent },
  { path: 'private', component: PrivateComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];
