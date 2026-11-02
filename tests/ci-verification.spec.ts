import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { checkMarkdownLinks } from '../scripts/ci/check-markdown-links.mjs'
import {
  classifyDiff,
  evaluateQualityGate,
  isFullWitness,
  isReusablePredecessorRun,
  isReusableWitnessArtifact,
  parseRawDiffZ,
  requiredQualityJobs,
  selectVerificationMode,
} from '../scripts/ci/verification.mjs'
import { isDocumentationPath } from '../scripts/verification-inputs.mjs'

const repository = 'submoon/ttrpg-cluster-control'
const baseSha = '1'.repeat(40)
const previousHeadSha = '2'.repeat(40)
const currentHeadSha = '3'.repeat(40)
const priorRunId = 901
const objectId = 'a'.repeat(40)
const zeroObjectId = '0'.repeat(40)
const workflow = {
  id: 64,
  path: '.github/workflows/ci.yml',
  ref: '.github/workflows/ci.yml@refs/pull/42/merge',
  blob: '4'.repeat(40),
}

function rawChange(
  status: 'A' | 'D' | 'M',
  path: string,
  oldMode = '100644',
  newMode = '100644',
): Buffer {
  const oldObject = status === 'A' ? zeroObjectId : objectId
  const newObject = status === 'D' ? zeroObjectId : objectId
  return Buffer.from(`:${oldMode} ${newMode} ${oldObject} ${newObject} ${status}\0${path}\0`, 'utf8')
}

function concatenate(...changes: Buffer[]): Buffer {
  return Buffer.concat(changes)
}

function fullWitness(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    qualification: 'full',
    repository,
    pullRequestNumber: 42,
    baseSha,
    headSha: previousHeadSha,
    runId: priorRunId,
    runAttempt: 1,
    workflow,
    ...overrides,
  }
}

function reuseCandidate(overrides: Record<string, unknown> = {}) {
  return {
    eventName: 'pull_request',
    repository,
    headRepository: repository,
    eventAction: 'synchronize',
    pullRequestNumber: 42,
    baseSha,
    headSha: currentHeadSha,
    beforeSha: previousHeadSha,
    beforeIsAncestor: true,
    fullDiff: rawChange('M', 'src/workspace.ts'),
    commitDiff: rawChange('M', 'docs/release-notes.md'),
    witness: fullWitness(),
    witnessDownloadSucceeded: true,
    witnessRunId: priorRunId,
    witnessRunAttempt: 1,
    workflow,
    ...overrides,
  }
}

test.describe('CI verification input policy @pure', { tag: '@pure' }, () => {
  test('accepts only approved POSIX documentation paths and keeps Tailwind exclusions aligned', () => {
    const accepted = [
      'README.md',
      'AGENTS.md',
      'CONTEXT.md',
      'GLOSSARY.md',
      'docs/architecture/editor.md',
      '.scratch/verification-loop-improvements/implementation.md',
      '.agents/skills/project-development/SKILL.md',
      'docs/UPPER.MD',
    ]
    for (const path of accepted) expect(isDocumentationPath(path), path).toBe(true)

    const rejected = [
      '/docs/readme.md',
      'C:/docs/readme.md',
      'docs\\readme.md',
      'docs/../src/readme.md',
      'src/readme.md',
      '.agents/AGENTS.md',
      'tests/README.md',
      'package.json',
      'docs/readme.ts',
    ]
    for (const path of rejected) expect(isDocumentationPath(path), path).toBe(false)

    const css = readFileSync(resolve(process.cwd(), 'assets/css/main.css'), 'utf8')
    for (const source of [
      '../../docs/',
      '../../.scratch/',
      '../../.agents/',
      '../../README.md',
      '../../AGENTS.md',
      '../../CONTEXT.md',
      '../../GLOSSARY.md',
    ]) {
      expect(css).toContain(`@source not "${source}";`)
    }
    expect(css).not.toContain('@source not "../../tests')
    expect(css).not.toContain('@source not "../../src')
  })

  test('parses complete raw NUL diffs and classifies rename pairs and deletions conservatively', () => {
    const deletion = rawChange('D', 'docs/retired-guide.md', '100644', '000000')
    const renamePair = concatenate(
      rawChange('A', 'docs/new-name.md', '000000', '100644'),
      rawChange('D', 'docs/old-name.md', '100644', '000000'),
    )
    expect(parseRawDiffZ(deletion)).toEqual([{
      status: 'D',
      path: 'docs/retired-guide.md',
      oldMode: '100644',
      newMode: '000000',
    }])
    expect(classifyDiff(deletion)).toBe('docs')
    expect(classifyDiff(renamePair)).toBe('docs')
    expect(classifyDiff(concatenate(
      rawChange('D', 'src/old.ts', '100644', '000000'),
      rawChange('A', 'docs/new-guide.md', '000000', '100644'),
    ))).toBe('full')
  })

  test('mode changes, symlinks, unknown paths, malformed diffs, and empty diffs are full', () => {
    expect(classifyDiff(rawChange('M', 'docs/guide.md', '100644', '100755'))).toBe('full')
    expect(classifyDiff(rawChange('M', 'docs/guide.md', '100644', '120000'))).toBe('full')
    expect(classifyDiff(rawChange('M', 'src/runtime.ts'))).toBe('full')
    expect(classifyDiff(rawChange('M', 'tests/behavior.spec.ts'))).toBe('full')
    expect(classifyDiff(rawChange('M', 'package.json'))).toBe('full')
    expect(classifyDiff(rawChange('M', '.github/workflows/ci.yml'))).toBe('full')
    expect(classifyDiff(rawChange('M', 'docs/bad\nname.md'))).toBe('full')
    expect(classifyDiff(Buffer.alloc(0))).toBe('full')
    expect(classifyDiff(Buffer.from(':100644 incomplete', 'utf8'))).toBe('full')
  })

  test('does not reuse an earlier code qualification hidden by a documentation tip without its exact witness', () => {
    expect(selectVerificationMode(reuseCandidate({ witness: undefined }))).toBe('full')
    expect(selectVerificationMode(reuseCandidate({ fullDiff: Buffer.alloc(0) }))).toBe('full')
    expect(selectVerificationMode(reuseCandidate({
      witness: fullWitness({ headSha: '5'.repeat(40) }),
    }))).toBe('full')
    expect(selectVerificationMode(reuseCandidate())).toBe('reuse')
    expect(selectVerificationMode(reuseCandidate({
      headRepository: 'fork-user/ttrpg-cluster-control',
      fullDiff: rawChange('M', 'docs/release-notes.md'),
    }))).toBe('docs')
    expect(selectVerificationMode(reuseCandidate({
      fullDiff: rawChange('M', 'docs/release-notes.md'),
      baseSha: zeroObjectId,
    }))).toBe('full')
    expect(selectVerificationMode(reuseCandidate({
      fullDiff: rawChange('M', 'docs/release-notes.md'),
      pullRequestNumber: undefined,
    }))).toBe('full')
  })

test('binds reuse to synchronize before, ancestry, and exact PR and workflow identity', () => {
    const mismatches = [
      reuseCandidate({ witness: fullWitness({ baseSha: '5'.repeat(40) }) }),
      reuseCandidate({ witness: fullWitness({ pullRequestNumber: 43 }) }),
      reuseCandidate({ witness: fullWitness({ repository: 'other/repository' }) }),
      reuseCandidate({ witness: fullWitness({ workflow: { ...workflow, id: workflow.id + 1 } }) }),
      reuseCandidate({ witness: fullWitness({ workflow: { ...workflow, blob: '5'.repeat(40) } }) }),
      reuseCandidate({ witness: fullWitness({ runId: priorRunId + 1 }) }),
      reuseCandidate({ witness: fullWitness({ runAttempt: 2 }) }),
      reuseCandidate({ witnessRunAttempt: 2 }),
      reuseCandidate({ eventAction: 'opened' }),
      reuseCandidate({ beforeSha: '5'.repeat(40) }),
      reuseCandidate({ beforeSha: zeroObjectId }),
      reuseCandidate({ baseSha: zeroObjectId }),
      reuseCandidate({ headSha: zeroObjectId }),
      reuseCandidate({ beforeIsAncestor: false }),
      reuseCandidate({ witnessDownloadSucceeded: false }),
      reuseCandidate({ headRepository: 'fork-user/ttrpg-cluster-control' }),
      reuseCandidate({ eventName: 'workflow_dispatch' }),
    ]
    for (const candidate of mismatches) expect(selectVerificationMode(candidate)).toBe('full')

    expect(selectVerificationMode({
      eventName: 'push',
      repository,
      headRepository: repository,
      beforeSha: previousHeadSha,
      headSha: currentHeadSha,
      fullDiff: rawChange('M', 'docs/release-notes.md'),
    })).toBe('docs')
    expect(selectVerificationMode({
      eventName: 'push',
      repository,
      headRepository: repository,
      beforeSha: '0000000000000000000000000000000000000000',
      headSha: currentHeadSha,
      fullDiff: rawChange('M', 'docs/release-notes.md'),
    })).toBe('full')
  })

  test('validates an exact-schema full witness and requires explicit skip results for each CI mode', () => {
    const witness = fullWitness()
    expect(isFullWitness(witness, witness)).toBe(true)
    expect(isFullWitness({ ...witness, unexpected: 'field' }, witness)).toBe(false)
    expect(isFullWitness(fullWitness({ baseSha: zeroObjectId }), fullWitness({ baseSha: zeroObjectId }))).toBe(false)
    expect(requiredQualityJobs('docs')).toEqual(['docs'])
    expect(requiredQualityJobs('reuse')).toEqual(['docs', 'predecessorWitness'])
    expect(requiredQualityJobs('full')).toEqual(['checks', 'browserSmoke', 'browser', 'previewWhenRequired'])

    const skippedFullJobs = {
      checks: 'skipped',
      preview: 'skipped',
      browserSmoke: 'skipped',
      browser: 'skipped',
    }
    expect(evaluateQualityGate({
      mode: 'docs',
      verification: 'success',
      docs: 'success',
      ...skippedFullJobs,
      previewRequired: false,
      witness: false,
    }).success).toBe(true)
    expect(evaluateQualityGate({
      mode: 'docs',
      verification: 'success',
      docs: 'success',
      ...skippedFullJobs,
      checks: 'success',
      previewRequired: false,
      witness: false,
    }).success).toBe(false)
    expect(evaluateQualityGate({
      mode: 'reuse',
      verification: 'success',
      docs: 'success',
      ...skippedFullJobs,
      previewRequired: false,
      witness: true,
    }).success).toBe(true)
    expect(evaluateQualityGate({
      mode: 'reuse',
      verification: 'success',
      docs: 'success',
      ...skippedFullJobs,
      previewRequired: false,
      witness: false,
    }).success).toBe(false)
    expect(evaluateQualityGate({
      mode: 'full',
      verification: 'success',
      docs: 'skipped',
      checks: 'success',
      preview: 'success',
      previewRequired: true,
      browserSmoke: 'success',
      browser: 'success',
      witness: false,
    }).success).toBe(true)
    expect(evaluateQualityGate({
      mode: 'full',
      verification: 'success',
      docs: 'skipped',
      checks: 'success',
      preview: 'skipped',
      previewRequired: true,
      browserSmoke: 'success',
      browser: 'success',
      witness: false,
    }).success).toBe(false)
    expect(evaluateQualityGate({
      mode: 'docs',
      verification: 'cancelled',
      docs: 'success',
      ...skippedFullJobs,
      previewRequired: false,
      witness: false,
    }).success).toBe(false)
  })

  test('requires a successful same-workflow predecessor run and its unexpired bounded attempt artifact', () => {
    const run = {
      id: priorRunId,
      run_attempt: 1,
      workflow_id: workflow.id,
      path: `${workflow.path}@refs/pull/42/merge`,
      event: 'pull_request',
      head_sha: previousHeadSha,
      status: 'completed',
      conclusion: 'success',
      head_repository: { full_name: repository },
      repository: { full_name: repository },
      pull_requests: [{
        number: 42,
        head: { sha: currentHeadSha },
        base: { sha: '5'.repeat(40) },
      }],
    }
    const expectedRun = {
      repository,
      pullRequestNumber: 42,
      baseSha,
      predecessorSha: previousHeadSha,
      workflow,
    }
    expect(isReusablePredecessorRun(run, expectedRun)).toBe(true)
    expect(isReusablePredecessorRun(undefined, expectedRun)).toBe(false)
    expect(isReusablePredecessorRun({ ...run, conclusion: 'failure' }, expectedRun)).toBe(false)
    expect(isReusablePredecessorRun({ ...run, run_attempt: 2 }, expectedRun)).toBe(true)
    expect(isReusablePredecessorRun({ ...run, head_sha: '5'.repeat(40) }, expectedRun)).toBe(false)
    expect(isReusablePredecessorRun({
      ...run,
      pull_requests: [{ number: 43 }],
    }, expectedRun)).toBe(false)

    const artifact = {
      id: 902,
      name: 'ci-full-witness-1',
      expired: false,
      size_in_bytes: 420,
    }
    expect(isReusableWitnessArtifact(artifact, 1)).toBe(true)
    expect(isReusableWitnessArtifact(undefined, 1)).toBe(false)
    expect(isReusableWitnessArtifact({ ...artifact, expired: true }, 1)).toBe(false)
    expect(isReusableWitnessArtifact({ ...artifact, size_in_bytes: 16 * 1024 + 1 }, 1)).toBe(false)
    expect(isReusableWitnessArtifact({ ...artifact, name: 'ci-full-witness-1' }, 2)).toBe(false)
  })
})

test.describe('Markdown link verification @pure', { tag: '@pure' }, () => {
  test('checks deleted targets and headings while ignoring external and code examples', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ci-markdown-check-'))
    try {
      await mkdir(join(root, 'docs'), { recursive: true })
      await writeFile(join(root, 'README.md'), [
        '# Guide',
        '',
        '[valid](docs/target.md#target-heading)',
        '[external](https://example.invalid/guide)',
        '`[inline example](missing-inline.md)`',
        '',
        '```md',
        '[fenced example](missing-fenced.md)',
        '```',
        '',
        '[deleted][old-guide]',
        '[bad heading](docs/target.md#not-there)',
        '[inline code and underscore](docs/target.md#use-foo-and-use_state)',
        '',
        '[old-guide]: docs/deleted.md',
        '',
      ].join('\n'), 'utf8')
      await writeFile(join(root, 'docs', 'target.md'), [
        '# Target Heading',
        '# Use `foo` and use_state',
        '',
        '`[inline example](missing-target.md)`',
        '',
        '~~~md',
        '[fenced example](missing-target-fenced.md)',
        '~~~',
        '',
      ].join('\n'), 'utf8')

      const errors = await checkMarkdownLinks(root)
      expect(errors).toHaveLength(2)
      expect(errors.some(error => error.includes('docs/deleted.md') && error.includes('does not exist'))).toBe(true)
      expect(errors.some(error => error.includes('heading "#not-there"'))).toBe(true)
      expect(errors.join('\n')).not.toContain('missing-inline')
      expect(errors.join('\n')).not.toContain('missing-fenced')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects a repository link through a symlink without reading its outside target', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ci-markdown-symlink-'))
    const outside = await mkdtemp(join(tmpdir(), 'ci-markdown-outside-'))
    try {
      await mkdir(join(root, 'docs'), { recursive: true })
      await writeFile(join(outside, 'outside.md'), '[hidden broken link](also-missing.md)', 'utf8')
      await writeFile(join(root, 'README.md'), '[outside](docs/outside/outside.md)', 'utf8')
      await symlink(outside, join(root, 'docs', 'outside'), process.platform === 'win32' ? 'junction' : 'dir')

      const errors = await checkMarkdownLinks(root)
      expect(errors.some(error => error.includes('uses a symbolic link'))).toBe(true)
      expect(errors.join('\n')).not.toContain('also-missing.md')
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })
})
