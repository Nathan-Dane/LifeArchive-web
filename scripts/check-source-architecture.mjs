#!/usr/bin/env node
/**
 * Production TypeScript dependency guard.
 *
 * Uses the repository's TypeScript resolver so extensionless imports, barrel
 * exports, type-only imports, and lazy imports all describe one local graph.
 * It rejects cycles and the few layer crossings that would bypass
 * LifeArchiveClient or make a foundational package depend on presentation.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import ts from 'typescript'

const DEFAULT_ROOT = path.resolve(import.meta.dirname, '..')
const DEFAULT_CONFIG = path.join(DEFAULT_ROOT, 'tsconfig.app.json')

function posixRelative(root, file) {
  return path.relative(root, file).split(path.sep).join('/')
}

function isProductionSource(file) {
  const normalized = file.split(path.sep).join('/')
  return (
    /\.(?:ts|tsx)$/.test(normalized) &&
    !/\.d\.ts$/.test(normalized) &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/.test(normalized) &&
    !normalized
      .split('/')
      .some((segment) => ['fixtures', 'test', 'tests'].includes(segment))
  )
}

function moduleReferences(sourceFile) {
  const references = []
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      references.push({
        specifier: node.moduleSpecifier.text,
        line:
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      references.push({
        specifier: node.arguments[0].text,
        line:
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      references.push({
        specifier: node.argument.literal.text,
        line:
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return references
}

function layerViolation(source, target) {
  const targetInside = (prefix) => target.startsWith(`src/${prefix}/`)

  if (source.startsWith('src/core/client/')) {
    return target.startsWith('src/core/client/')
      ? null
      : 'core/client may depend only on its own public value-contract modules'
  }
  if (source.startsWith('src/core/runtime/')) {
    if (
      targetInside('app') ||
      targetInside('features') ||
      targetInside('ui') ||
      targetInside('i18n') ||
      targetInside('accessibility') ||
      targetInside('core/bootstrap') ||
      targetInside('core/mock')
    ) {
      return 'core/runtime must remain below application and presentation layers'
    }
  }
  if (source.startsWith('src/core/mock/')) {
    if (
      targetInside('app') ||
      targetInside('features') ||
      targetInside('platform') ||
      targetInside('ui') ||
      targetInside('i18n') ||
      targetInside('accessibility') ||
      targetInside('core/bootstrap') ||
      targetInside('core/runtime')
    ) {
      return 'core/mock may depend only on core/client and its own development support'
    }
  }
  if (source.startsWith('src/platform/')) {
    if (
      targetInside('app') ||
      targetInside('features') ||
      targetInside('ui') ||
      targetInside('i18n') ||
      targetInside('accessibility') ||
      targetInside('core/bootstrap') ||
      targetInside('core/mock') ||
      targetInside('core/runtime')
    ) {
      return 'platform adapters must remain below application and presentation layers'
    }
  }
  if (
    source.startsWith('src/features/') &&
    (targetInside('core/runtime') ||
      targetInside('core/mock') ||
      targetInside('core/bootstrap'))
  ) {
    return 'features reach durable state only through core/client'
  }
  return null
}

function stronglyConnectedComponents(graph) {
  let nextIndex = 0
  const indexes = new Map()
  const lowLinks = new Map()
  const stack = []
  const onStack = new Set()
  const components = []

  function connect(node) {
    indexes.set(node, nextIndex)
    lowLinks.set(node, nextIndex)
    nextIndex += 1
    stack.push(node)
    onStack.add(node)

    for (const dependency of graph.get(node) ?? []) {
      if (!indexes.has(dependency)) {
        connect(dependency)
        lowLinks.set(
          node,
          Math.min(lowLinks.get(node), lowLinks.get(dependency)),
        )
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          node,
          Math.min(lowLinks.get(node), indexes.get(dependency)),
        )
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return
    const component = []
    let current
    do {
      current = stack.pop()
      onStack.delete(current)
      component.push(current)
    } while (current !== node)
    components.push(component.sort())
  }

  for (const node of [...graph.keys()].sort()) {
    if (!indexes.has(node)) connect(node)
  }
  return components
}

export function inspectSourceArchitecture({
  root = DEFAULT_ROOT,
  configPath = DEFAULT_CONFIG,
} = {}) {
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) {
    return {
      files: [],
      edgeCount: 0,
      violations: [
        ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
      ],
    }
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  )
  if (parsed.errors.length > 0) {
    return {
      files: [],
      edgeCount: 0,
      violations: parsed.errors.map((error) =>
        ts.flattenDiagnosticMessageText(error.messageText, '\n'),
      ),
    }
  }

  const files = parsed.fileNames
    .map((file) => path.normalize(file))
    .filter(isProductionSource)
    .sort()
  const production = new Set(files)
  const sourceRoot = path.normalize(path.join(root, 'src'))
  const host = ts.createCompilerHost(parsed.options)
  const graph = new Map(files.map((file) => [file, new Set()]))
  const violations = []
  let edgeCount = 0

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    for (const reference of moduleReferences(sourceFile)) {
      const resolved = ts.resolveModuleName(
        reference.specifier,
        file,
        parsed.options,
        host,
      ).resolvedModule?.resolvedFileName
      if (!resolved) continue
      const target = path.normalize(resolved)
      if (!target.startsWith(`${sourceRoot}${path.sep}`)) continue
      const sourceName = posixRelative(root, file)
      const targetName = posixRelative(root, target)
      if (!production.has(target)) {
        violations.push(
          `${sourceName}:${reference.line} imports excluded test/fixture source ${targetName}`,
        )
        continue
      }
      if (!graph.get(file).has(target)) {
        graph.get(file).add(target)
        edgeCount += 1
      }
      const reason = layerViolation(sourceName, targetName)
      if (reason) {
        violations.push(
          `${sourceName}:${reference.line} -> ${targetName} (${reason})`,
        )
      }
    }
  }

  for (const component of stronglyConnectedComponents(graph)) {
    if (component.length === 1 && !graph.get(component[0])?.has(component[0])) {
      continue
    }
    violations.push(
      `import cycle: ${component.map((file) => posixRelative(root, file)).join(' <-> ')}`,
    )
  }

  return {
    files: files.map((file) => posixRelative(root, file)),
    edgeCount,
    violations: [...new Set(violations)].sort(),
  }
}

function main() {
  const result = inspectSourceArchitecture()
  if (result.violations.length > 0) {
    console.error('source-architecture: dependency violations found.')
    for (const violation of result.violations) {
      console.error(`    ${violation}`)
    }
    process.exitCode = 1
    return
  }
  console.log(
    `source-architecture: ${result.files.length} production files and ${result.edgeCount} local imports checked; no cycles or guarded layer violations.`,
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
