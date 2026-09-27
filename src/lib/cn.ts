export type ClassValue = string | false | null | undefined;

/**
 * Joins conditional class names. Deliberately dependency-free - the project has
 * no class-name utility installed and this is not worth adding one for.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
