// Lets node run the TypeScript sources as they are: resolves the '@/' alias and extensionless imports.
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

export function resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith('@/')) {
        base = resolvePath(root, specifier.slice(2));
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
        base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (base) {
        for (const suffix of ['.ts', '/index.ts']) {
            if (existsSync(base + suffix)) return nextResolve(pathToFileURL(base + suffix).href, context);
        }
    }
    return nextResolve(specifier, context);
}
