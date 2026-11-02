/** Returns true only when every explicit Playwright project selector names `pure`. */
/** @param {string[]} args @returns {boolean} */
export function isPureOnlySelection(args) {
  const selectedProjects = []
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--project') {
      let nextIndex = index + 1
      if (!args[nextIndex] || args[nextIndex].startsWith('-')) return false
      while (nextIndex < args.length && !args[nextIndex].startsWith('-')) {
        selectedProjects.push(args[nextIndex])
        nextIndex += 1
      }
      index = nextIndex - 1
    } else if (argument.startsWith('--project=')) {
      const value = argument.slice('--project='.length)
      if (!value) return false
      selectedProjects.push(value)
      let nextIndex = index + 1
      while (nextIndex < args.length && !args[nextIndex].startsWith('-')) {
        selectedProjects.push(args[nextIndex])
        nextIndex += 1
      }
      index = nextIndex - 1
    }
  }

  return selectedProjects.length > 0 && selectedProjects.every(project => project === 'pure')
}
