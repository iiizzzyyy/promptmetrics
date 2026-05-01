import mustache from 'mustache';
import { AppError } from '@errors/app.error';

export interface RenderOptions {
  strict?: boolean;
}

/**
 * Renders a Mustache template with the provided variables.
 * Does NOT escape HTML (raw output suitable for prompts).
 *
 * @param template - The Mustache template string.
 * @param variables - Key-value map of variables to substitute.
 * @param options - Optional rendering flags (e.g., strict mode).
 * @returns The rendered string.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>,
  options: RenderOptions = {},
): string {
  const { strict = false } = options;

  if (strict) {
    const validation = validateVariables(template, variables);
    if (!validation.valid) {
      throw AppError.validationFailed({ missing: validation.missing });
    }
  }

  return mustache.render(template, variables, undefined, {
    escape: (text: unknown) => String(text),
  });
}

/**
 * Extracts all variable tags ({{...}}) from a Mustache template and checks
 * which ones are missing from the provided variable map.
 *
 * Supports dot-notation paths (e.g., {{user.name}}) for nested objects.
 * Default-value syntax (e.g., {{name|default}}) is not supported in v1.
 *
 * @param template - The Mustache template string.
 * @param variables - Key-value map of variables to check against.
 * @returns Object indicating whether all variables are present and a list of any missing names.
 */
export function validateVariables(
  template: string,
  variables: Record<string, unknown>,
): { valid: boolean; missing: string[] } {
  const parsed = mustache.parse(template);
  const requiredNames = new Set<string>();

  for (const token of parsed) {
    const type = token[0];
    const name = token[1];

    // 'name' = escaped {{var}}, '&' = unescaped {{{var}}} or {{& var}}
    if ((type === 'name' || type === '&') && name !== '.') {
      requiredNames.add(name);
    }
  }

  const missing: string[] = [];
  for (const name of requiredNames) {
    if (!hasVariable(variables, name)) {
      missing.push(name);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Checks whether a dot-notation path exists in the variables object
 * and resolves to a non-null/defined value.
 */
function hasVariable(variables: Record<string, unknown>, name: string): boolean {
  const parts = name.split('.');
  let current: unknown = variables;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return false;
    }
    if (typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return false;
    }
  }

  return current !== undefined && current !== null;
}
