export type MenuView =
  | { type: 'main' }
  | { type: 'route' }
  | { type: 'typemenu' }
  | { type: 'transfer' }
  | { type: 'flightinfo' }
  | { type: 'procedure'; airport: string; procType: 'SID' | 'STAR' }
