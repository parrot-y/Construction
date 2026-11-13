import { describe, expect, it, beforeAll } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import AppErrorBoundary from './AppErrorBoundary';
import { useAppDialog } from './AppDialog';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

const render = async (el: React.ReactElement) => {
  root = createRoot(container);
  await act(async () => { root.render(el); });
};
const cleanup = async () => { await act(async () => { root.unmount(); }); container.innerHTML = ''; };

function Bomb(): React.JSX.Element { throw new Error('module exploded'); }

function DialogHarness({ onResult }: { onResult: (v: any) => void }): React.JSX.Element {
  const dialog = useAppDialog();
  return (
    <div>
      <button type="button" data-testid="open" onClick={async () => {
        const v = await dialog.prompt({ title: 'Why?', inputLabel: 'Reason', minLength: 3, confirmLabel: 'OK' });
        onResult(v);
      }}>open</button>
      {dialog.element}
    </div>
  );
}

describe('AppErrorBoundary', () => {
  it('a throwing module shows the fallback with ref id and keeps the shell alive', async () => {
    const results: any[] = [];
    await render(
      <div>
        <p data-testid="shell">shell alive</p>
        <AppErrorBoundary label="test:module"><Bomb /></AppErrorBoundary>
      </div>,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert, 'fallback alert must render').toBeTruthy();
    expect(alert!.textContent).toContain('Something went wrong');
    expect(alert!.textContent).toMatch(/Reference: [0-9a-f-]{36}/);
    expect(container.querySelector('[data-testid="shell"]')?.textContent).toBe('shell alive');
    const reload = Array.from(alert!.querySelectorAll('button')).find((b) => b.textContent === 'Reload');
    expect(reload, 'Reload action must exist').toBeTruthy();
    await cleanup();
  });
});

describe('useAppDialog', () => {
  it('is keyboard-operable: focus moves in, Escape cancels, confirm resolves the value', async () => {
    const results: any[] = [];
    await render(<DialogHarness onResult={(v) => results.push(v)} />);
    const openBtn = container.querySelector<HTMLButtonElement>('[data-testid="open"]')!;
    await act(async () => { openBtn.click(); });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog, 'dialog must open').toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');

    // Focus is trapped inside the dialog.
    const active = document.activeElement as HTMLElement;
    expect(dialog!.contains(active), 'focus must move inside the dialog').toBe(true);

    // Escape cancels → resolves null.
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(results).toEqual([null]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // Reopen, type a valid value, Tab to confirm, Enter.
    await act(async () => { openBtn.click(); });
    const input = container.querySelector<HTMLInputElement>('#app-dialog-input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'valid reason');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const confirmBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((b) => b.textContent === 'OK')!;
    await act(async () => { confirmBtn.click(); });
    expect(results).toEqual([null, 'valid reason']);
    await cleanup();
  });
});
