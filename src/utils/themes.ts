const themeUrlsByPath = import.meta.glob('../styles/themes/*.css', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const themeUrlsByFile = new Map(
  Object.entries(themeUrlsByPath).map(([path, url]) => [path.split('/').pop() as string, url]),
)

export function listThemeFiles(): string[] {
  return Array.from(themeUrlsByFile.keys())
}

export function getThemeUrl(themeFile: string): string | undefined {
  return themeUrlsByFile.get(themeFile)
}
