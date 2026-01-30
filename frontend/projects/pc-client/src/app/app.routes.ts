import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./host/host.component').then(m => m.HostComponent)
  }
];
