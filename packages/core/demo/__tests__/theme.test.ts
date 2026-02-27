import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, openHelp, closeHelp } from '../theme';

function makeElements() {
  const body          = document.createElement('div'); // stand-in for document.body
  const gridContainer = document.createElement('div');
  const ugrid         = document.createElement('div');
  ugrid.className     = 'ugrid';
  gridContainer.appendChild(ugrid);
  const btnTheme      = document.createElement('button');
  const backdrop      = document.createElement('div');
  return { body, gridContainer, btnTheme, backdrop };
}

describe('applyTheme', () => {
  it('dark=true adds demo-dark, removes demo-light', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    applyTheme(true, body, gridContainer, btnTheme);
    expect(body.classList.contains('demo-dark')).toBe(true);
    expect(body.classList.contains('demo-light')).toBe(false);
  });

  it('dark=false adds demo-light, removes demo-dark', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    applyTheme(false, body, gridContainer, btnTheme);
    expect(body.classList.contains('demo-light')).toBe(true);
    expect(body.classList.contains('demo-dark')).toBe(false);
  });

  it('dark=true sets ugrid-theme-dark on .ugrid element', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    applyTheme(true, body, gridContainer, btnTheme);
    expect(gridContainer.querySelector('.ugrid')!.classList.contains('ugrid-theme-dark')).toBe(true);
  });

  it('dark=false removes ugrid-theme-dark from .ugrid element', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    // First set dark
    applyTheme(true, body, gridContainer, btnTheme);
    expect(gridContainer.querySelector('.ugrid')!.classList.contains('ugrid-theme-dark')).toBe(true);
    // Then switch to light
    applyTheme(false, body, gridContainer, btnTheme);
    expect(gridContainer.querySelector('.ugrid')!.classList.contains('ugrid-theme-dark')).toBe(false);
  });

  it('dark=true sets sun emoji on button', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    applyTheme(true, body, gridContainer, btnTheme);
    expect(btnTheme.textContent).toBe('☀️');
    expect(btnTheme.title).toBe('Switch to light mode');
  });

  it('dark=false sets moon emoji on button', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    applyTheme(false, body, gridContainer, btnTheme);
    expect(btnTheme.textContent).toBe('🌙');
    expect(btnTheme.title).toBe('Switch to dark mode');
  });

  it('toggling dark→light→dark correctly flips classes each time', () => {
    const { body, gridContainer, btnTheme } = makeElements();
    applyTheme(true,  body, gridContainer, btnTheme);
    applyTheme(false, body, gridContainer, btnTheme);
    applyTheme(true,  body, gridContainer, btnTheme);
    expect(body.classList.contains('demo-dark')).toBe(true);
    expect(body.classList.contains('demo-light')).toBe(false);
    expect(gridContainer.querySelector('.ugrid')!.classList.contains('ugrid-theme-dark')).toBe(true);
  });

  it('works with null gridContainer (grid not yet mounted)', () => {
    const { body, btnTheme } = makeElements();
    expect(() => applyTheme(true, body, null, btnTheme)).not.toThrow();
    expect(body.classList.contains('demo-dark')).toBe(true);
  });
});

describe('openHelp / closeHelp', () => {
  it('openHelp adds open class to backdrop', () => {
    const { backdrop } = makeElements();
    openHelp(backdrop);
    expect(backdrop.classList.contains('open')).toBe(true);
  });

  it('closeHelp removes open class from backdrop', () => {
    const { backdrop } = makeElements();
    openHelp(backdrop);
    closeHelp(backdrop);
    expect(backdrop.classList.contains('open')).toBe(false);
  });

  it('closeHelp is idempotent when already closed', () => {
    const { backdrop } = makeElements();
    expect(() => closeHelp(backdrop)).not.toThrow();
    expect(backdrop.classList.contains('open')).toBe(false);
  });
});
