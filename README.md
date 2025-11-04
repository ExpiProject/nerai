# **NERAI**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE) ![Language: TypeScript](https://img.shields.io/badge/Lang-TypeScript-blue.svg)

All-in-one AI app built with **Electron** and **TypeScript** including a browser, notes, terminal, and more.

Language: TypeScript (primary), HTML, CSS

Framework: **Electron**

License: **MIT**

Maintainers: **@MrYapikZ**

Overview
This repository contains the NERAI application — an integrated, multi-pane desktop app built on Electron with a TypeScript codebase. NERAI provides a bundled browser view, notes, terminal, and additional tools in a single cross-platform desktop application.

Getting started
1. Install dependencies: npm install
2. Run in development (renderer + main with hot-reload): npm run start
3. Build production bundle: npm run make

Architecture
- Electron main process (src/main) — app lifecycle, native integrations, window management
- Renderer process (src/renderer) — UI, components, webviews (browser)
- Shared code (src/shared) — types, utilities, state management

Contributing
See CONTRIBUTING.md for guidelines on contributing, code style, and pull request process.