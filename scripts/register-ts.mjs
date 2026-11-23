// Run the repository's TypeScript scripts with Node, without downloading a runner.
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
registerHooks({
  resolve(specifier, context, next) {
    let local
    if (specifier.startsWith('@/')) local = resolve(root, 'src', specifier.slice(2))
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !context.parentURL.includes('node_modules')) local = resolve(dirname(fileURLToPath(context.parentURL)), specifier)
    if (local) {
      const file = [local, local + '.ts', local + '.mts', resolve(local, 'index.ts')].find(f => /\.(m?ts)$/.test(f) && existsSync(f))
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
    }
    if (specifier === 'next/server') return { url: pathToFileURL(resolve(root, 'node_modules/next/server.js')).href, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.(m?ts)$/.test(url) && !url.includes('node_modules')) {
      return { format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true }
    }
    return next(url, context)
  },
})
