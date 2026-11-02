# Stock Bridge

A count reconciliation desk for a warehouse that keeps shipping during a physical inventory. It rebuilds the balance at the count cut-off, projects the correction forward and detects stale approvals.

**[Launch the interactive case](https://dangerous37.github.io/stock-bridge/)** · [Input and decision contract](CONTRACT.md)

## Reproduce the decision
Inspect FILTER-04. Book stock was 92 at count time, the count was 90 and five more units shipped. Applying a correction of −2 leaves 85. Approve the plan, receive a late shipment, then attempt to apply it. Review the changed plan before approving again.

## Run the local API
Use Node.js 24. Run `npm ci --offline`, `npm test` and `npm start`. Open the address printed by the server. POST JSON to `/api/evaluate` for the same result as the UI. The local web client calls the HTTP API. The public static site runs the same decision module in the browser. All examples use synthetic data. Export a report from the client to keep the result.

To reproduce the browser test, use Python 3.12, install `requirements-test.txt`, run `python -m playwright install chrome`, then `python browser_test.py`.

## Operational limits
For a durable local close, download the reviewed report and pass its fingerprint to `node commit.mjs docs/example.json APPROVED_FINGERPRINT warehouse.sqlite`. The first batch seeds previously unseen SKUs from its current projection. Later batches must match stored units and version. One SQLite transaction writes all balance changes and the receipt, and repeating the same approval returns that receipt without deducting units twice.

The apply endpoint returns an all-or-nothing projected receipt, and the UI shows the applied sandbox result. Integrating a multi-user ERP requires enforcing the version check and write in one database transaction. No production ledger is modified.

## Resumen en español
Reconcilia un conteo físico con el saldo de ese momento, conserva los movimientos posteriores y bloquea la aplicación de un ajuste aprobado sobre datos desactualizados.
