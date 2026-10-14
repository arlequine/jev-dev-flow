# demo-shop

App mínima (solo código de ejemplo, no se ejecuta) sobre la que la demo abre issues y PRs reales.

- `src/payments/charge.ts`: contiene el bug de **E01** (doble cobro en reintentos). Es la tarea que el router manda a Opus 5.5.
- `src/api/orders.ts`, `src/users/onSignup.ts`, `src/auth/login.ts`: los modifican los PRs sembrados por `scripts/seed-prs.sh` (pr07, pr06 y pr02).
