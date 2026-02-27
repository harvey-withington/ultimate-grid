/**
 * Theme toggle utilities — extracted for testability.
 * Applies demo-dark / demo-light classes to <body> and
 * ugrid-theme-dark to the grid element.
 */

export function applyTheme(
  dark: boolean,
  body: HTMLElement,
  gridContainer: HTMLElement | null,
  btnTheme: HTMLElement,
): void {
  body.classList.toggle('demo-dark',  dark);
  body.classList.toggle('demo-light', !dark);
  gridContainer
    ?.querySelector('.ugrid')
    ?.classList.toggle('ugrid-theme-dark', dark);
  btnTheme.textContent = dark ? '☀️' : '🌙';
  btnTheme.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

export function openHelp(backdrop: HTMLElement):  void { backdrop.classList.add('open'); }
export function closeHelp(backdrop: HTMLElement): void { backdrop.classList.remove('open'); }
