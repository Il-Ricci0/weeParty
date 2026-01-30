import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./join/join.component').then(m => m.JoinComponent)
  },
  {
    path: 'join/:code',
    loadComponent: () => import('./join/join.component').then(m => m.JoinComponent)
  },
  {
    path: 'controller',
    loadComponent: () => import('./controller/controller.component').then(m => m.ControllerComponent)
  }
];
