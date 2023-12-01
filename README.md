# TINY

A game about flying spaceships and dropping things, with the help of TINY, a scripted friendly AI.

Development:

```bash
yarn dev
yarn dev-tsc
yarn test
yarn lint
# Run all the checks:
yarn build
```

## Jupyter for Typescript

In a virtualenv `.venv` with Jupyter, copy the following to `.venv/share/jupyter/kernels/tslab/kernel.json`:

```json
{
  "argv": [
    "yarn",
    "run",
    "tslab",
    "kernel",
    "--config-path",
    "{connection_file}"
  ],
  "display_name": "TypeScript",
  "language": "typescript"
}
```
