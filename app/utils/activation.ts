/**
 * True when the variables just added were the project's first — i.e. the
 * project-wide variable count now equals exactly what we just added, so
 * nothing existed before. Used to fire `project_activated` once per project.
 */
export function isFirstActivation(projectWideCount: number, justAddedCount: number): boolean {
  return justAddedCount > 0 && projectWideCount === justAddedCount
}
