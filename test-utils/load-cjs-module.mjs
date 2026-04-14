import { createRequire } from 'node:module';
import path from 'node:path';

const rootRequire = createRequire(import.meta.url);

export function loadCjsModule(modulePath, mocks = {}) {
  const absoluteModulePath = path.resolve(process.cwd(), modulePath);
  const moduleRequire = createRequire(absoluteModulePath);
  const previousMocks = [];
  const previousTarget = rootRequire.cache[absoluteModulePath];

  for (const [specifier, exports] of Object.entries(mocks)) {
    const resolved = moduleRequire.resolve(specifier);
    previousMocks.push([resolved, rootRequire.cache[resolved]]);
    rootRequire.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports,
    };
  }

  delete rootRequire.cache[absoluteModulePath];

  try {
    return moduleRequire(absoluteModulePath);
  } finally {
    delete rootRequire.cache[absoluteModulePath];

    if (previousTarget) {
      rootRequire.cache[absoluteModulePath] = previousTarget;
    }

    for (const [resolved, previous] of previousMocks) {
      if (previous) {
        rootRequire.cache[resolved] = previous;
      } else {
        delete rootRequire.cache[resolved];
      }
    }
  }
}
