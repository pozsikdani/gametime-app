export const INVITE_CODE = 'kozgaz2026';
export const APP_NAME = 'Közgáz Kosár';

// Admin emails — these users can create/edit/delete events
export const ADMIN_EMAILS = ['dani.pozsik@gmail.com'];

// MKOSZ config for Közgáz B — multiple competitions (regular season + playoff)
export const MKOSZ_CONFIGS = [
  { teamId: '9239', teamName: 'KÖZGÁZ', competition: 'hun3k', season: 'x2526' },
  { teamId: '9239', teamName: 'KÖZGÁZ', competition: 'hun3_plya', season: 'x2526' },
];

// Keep single config for backward compat
export const MKOSZ_CONFIG = MKOSZ_CONFIGS[0];
