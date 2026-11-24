import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY = 'Simplezes/StripCol'
const DEFAULT_KEY_PATH = join(homedir(), '.tauri', 'stripcol.key')
const PLATFORM_KEY = 'windows-x86_64'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundleDirectory = join(projectRoot, 'src-tauri', 'target', 'release', 'bundle')
const options = new Set(process.argv.slice(2).filter((argument) => argument.startsWith('--')))
const notesArgument = process.argv.find((argument) => argument.startsWith('--notes='))
const releaseNotes = notesArgument ? notesArgument.slice('--notes='.length) : ''

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(projectRoot, relativePath), 'utf8'))
}

function readCargoVersion() {
  const cargo = readFileSync(join(projectRoot, 'src-tauri', 'Cargo.toml'), 'utf8')
  return cargo.match(/^version\s*=\s*"([^"]+)"/m)[1]
}

function assertVersionsMatch() {
  const versions = {
    'package.json': readJson('package.json').version,
    'tauri.conf.json': readJson('src-tauri/tauri.conf.json').version,
    'Cargo.toml': readCargoVersion(),
  }
  const unique = new Set(Object.values(versions))
  if (unique.size !== 1) {
    console.error('Version mismatch, make them identical before releasing:', versions)
    process.exit(1)
  }
  return versions['package.json']
}

function readSigningKey() {
  if (process.env.TAURI_SIGNING_PRIVATE_KEY) return process.env.TAURI_SIGNING_PRIVATE_KEY
  const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || DEFAULT_KEY_PATH
  if (!existsSync(keyPath)) {
    console.error(`Signing key not found at ${keyPath}. Set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH.`)
    process.exit(1)
  }
  return readFileSync(keyPath, 'utf8')
}

function buildInstaller() {
  execFileSync('pnpm', ['exec', 'tauri', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY: readSigningKey(),
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? '',
    },
  })
}

function locateArtifacts(version) {
  const installerName = `StripCol_${version}_x64-setup.exe`
  const installerPath = join(bundleDirectory, 'nsis', installerName)
  const signaturePath = `${installerPath}.sig`

  for (const path of [installerPath, signaturePath]) {
    if (!existsSync(path)) {
      console.error(`Missing build artifact: ${path}`)
      process.exit(1)
    }
  }
  return { installerName, installerPath, signaturePath }
}

function writeUpdateManifest(version, tag, artifacts) {
  const manifest = {
    version,
    notes: releaseNotes || `StripCol ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      [PLATFORM_KEY]: {
        signature: readFileSync(artifacts.signaturePath, 'utf8').trim(),
        url: `https://github.com/${REPOSITORY}/releases/download/${tag}/${artifacts.installerName}`,
      },
    },
  }
  const manifestPath = join(bundleDirectory, 'latest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  return manifestPath
}

async function githubRequest(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) ${url}: ${await response.text()}`)
  }
  return response.json()
}

async function createRelease(tag, version, token, isDraft) {
  return githubRequest(`https://api.github.com/repos/${REPOSITORY}/releases`, token, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: `StripCol ${version}`,
      body: releaseNotes || `StripCol ${version}`,
      draft: isDraft,
    }),
  })
}

async function uploadAsset(release, filePath, token) {
  const uploadUrl = release.upload_url.replace('{?name,label}', '')
  const name = basename(filePath)
  await githubRequest(`${uploadUrl}?name=${encodeURIComponent(name)}`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: readFileSync(filePath),
  })
  console.log(`Uploaded ${name}`)
}

async function publish(tag, version, artifacts, manifestPath) {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('Set GITHUB_TOKEN (a token with contents:write on the repository) to publish.')
    process.exit(1)
  }

  const isDraft = !options.has('--publish')
  // Always upload into a draft, then publish: the release-published webhook must not fire before latest.json exists.
  const release = await createRelease(tag, version, token, true)
  for (const filePath of [artifacts.installerPath, artifacts.signaturePath, manifestPath]) {
    await uploadAsset(release, filePath, token)
  }
  if (!isDraft) {
    await githubRequest(release.url, token, { method: 'PATCH', body: JSON.stringify({ draft: false }) })
  }
  console.log(isDraft ? `Draft release created: ${release.html_url}` : `Release published: ${release.html_url}`)
}

const version = assertVersionsMatch()
const tag = `v${version}`

if (!options.has('--skip-build')) buildInstaller()

const artifacts = locateArtifacts(version)
const manifestPath = writeUpdateManifest(version, tag, artifacts)
console.log(`Update manifest written to ${manifestPath}`)

if (options.has('--dry-run')) {
  console.log('Dry run: nothing was uploaded.')
} else {
  await publish(tag, version, artifacts, manifestPath)
}
