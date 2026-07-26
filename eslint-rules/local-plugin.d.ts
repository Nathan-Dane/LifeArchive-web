import type { ESLint } from 'eslint'

/** The repository-local ESLint plugin, so tests can load its rules. */
declare const plugin: ESLint.Plugin

export default plugin
