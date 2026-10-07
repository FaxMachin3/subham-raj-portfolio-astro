# Web fonts

Inlined into the site stylesheet at build time (see `src/styles/fonts.css`). Copies of the fontsource latin
subsets, unchanged (SIL OFL 1.1), so the site renders exactly as with the npm packages:

| File                                                          | Source                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `poppins-400.woff2`, `poppins-600.woff2`, `poppins-800.woff2` | `@fontsource/poppins` 5.3.0, `files/poppins-latin-{weight}-normal.woff2`               |
| `jetbrains-mono-400.woff2`, `jetbrains-mono-500.woff2`        | `@fontsource/jetbrains-mono` 5.3.0, `files/jetbrains-mono-latin-{weight}-normal.woff2` |

To update, copy the new files over these after upgrading the packages.
