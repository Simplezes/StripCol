import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { inject } from 'postject'

const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const distDirectory = join(projectRoot, 'gateway', 'dist')
const binariesDirectory = join(projectRoot, 'src-tauri', 'binaries')

function readTargetTriple() {
  const output = execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
  const hostLine = output.split('\n').find((line) => line.startsWith('host:'))
  return hostLine.replace('host:', '').trim()
}

async function bundleGateway() {
  const bundlePath = join(distDirectory, 'gateway.cjs')
  await build({
    entryPoints: [join(projectRoot, 'gateway', 'src', 'index.js')],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'warning',
  })
  return bundlePath
}

function createSeaBlob(bundlePath) {
  const blobPath = join(distDirectory, 'gateway.blob')
  const configPath = join(distDirectory, 'sea-config.json')
  writeFileSync(
    configPath,
    JSON.stringify({ main: bundlePath, output: blobPath, disableExperimentalSEAWarning: true }),
  )
  execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' })
  return blobPath
}

async function createExecutable(blobPath) {
  const targetTriple = readTargetTriple()
  const extension = process.platform === 'win32' ? '.exe' : ''
  const executablePath = join(binariesDirectory, `gateway-${targetTriple}${extension}`)

  mkdirSync(binariesDirectory, { recursive: true })
  copyFileSync(process.execPath, executablePath)
  await inject(executablePath, 'NODE_SEA_BLOB', readFileSync(blobPath), { sentinelFuse: SEA_FUSE })
  return executablePath
}

mkdirSync(distDirectory, { recursive: true })
const bundlePath = await bundleGateway()
const blobPath = createSeaBlob(bundlePath)
const executablePath = await createExecutable(blobPath)
console.log(`Gateway sidecar written to ${executablePath}`)
