import { readAgentToolStringArg } from '@purescience/platform-ui/bridge/agentToolHelpers'

export { readAgentToolStringArg }

export function readBooleanArg(
  args: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = args[key]
  return typeof value === 'boolean' ? value : undefined
}

export function readNumberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readObjectArg<T extends Record<string, unknown>>(
  args: Record<string, unknown>,
  key: string,
): T | undefined {
  const value = args[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as T
}

export function readStringArrayArg(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key]
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}
