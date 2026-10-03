'use client';

export function PrintReceiptButton() {
  return <button type="button" onClick={() => window.print()}>Imprimir comprovante</button>;
}
