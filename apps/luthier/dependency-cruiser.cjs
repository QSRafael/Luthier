/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-luthier-feature-cycles',
      comment: 'Prevent circular dependencies inside features/luthier.',
      severity: 'error',
      from: { path: '^src/features/luthier/' },
      to: { path: '^src/features/luthier/', circular: true },
    },
    {
      name: 'domain-not-to-application',
      comment: 'Domain layer must not depend on application layer.',
      severity: 'error',
      from: { path: '^src/features/luthier/domain/' },
      to: { path: '^src/features/luthier/application/' },
    },
    {
      name: 'domain-not-to-infrastructure',
      comment: 'Domain layer must not depend on infrastructure layer.',
      severity: 'error',
      from: { path: '^src/features/luthier/domain/' },
      to: { path: '^src/features/luthier/infrastructure/' },
    },
    {
      name: 'domain-not-to-presentation',
      comment: 'Domain layer must not depend on presentation folders.',
      severity: 'error',
      from: { path: '^src/features/luthier/domain/' },
      to: { path: '^(src/features/luthier/(sections|dialogs)/|src/components/)' },
    },
    {
      name: 'application-not-to-infrastructure',
      comment: 'Application layer must not depend on infrastructure adapters.',
      severity: 'error',
      from: { path: '^src/features/luthier/application/' },
      to: { path: '^src/features/luthier/infrastructure/' },
    },
    {
      name: 'application-not-to-presentation',
      comment: 'Application layer must not depend on presentation folders.',
      severity: 'error',
      from: { path: '^src/features/luthier/application/' },
      to: { path: '^(src/features/luthier/(sections|dialogs)/|src/components/)' },
    },
    {
      name: 'infrastructure-not-to-presentation',
      comment: 'Infrastructure layer must not depend on presentation folders.',
      severity: 'error',
      from: { path: '^src/features/luthier/infrastructure/' },
      to: { path: '^src/features/luthier/(sections|dialogs)/' },
    },
    {
      name: 'domain-no-direct-ui-or-tauri',
      comment: 'Domain must stay framework-agnostic and cannot call Tauri directly.',
      severity: 'error',
      from: { path: '^src/features/luthier/domain/' },
      to: {
        path: '^(solid-js($|/)|solid-sonner$|@tauri-apps/api($|/)|src/api/tauri(\\.ts)?$)',
      },
    },
    {
      name: 'application-no-direct-ui-or-tauri',
      comment: 'Application must use ports/adapters instead of direct UI/Tauri imports.',
      severity: 'error',
      from: { path: '^src/features/luthier/application/' },
      to: {
        path: '^(solid-js($|/)|solid-sonner$|@tauri-apps/api($|/)|src/api/tauri(\\.ts)?$)',
      },
    },
  ],
  options: {
    includeOnly: '^src',
    doNotFollow: {
      path: '(^|/)node_modules/',
    },
    exclude: {
      path: '(^|/)node_modules/|(^|/)dist/|(^|/)coverage/|(^|/)\\.vite/|(^|/)src-tauri/|\\.d\\.ts$',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.mjs'],
    },
  },
}
