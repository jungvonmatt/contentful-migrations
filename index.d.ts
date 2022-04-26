import type Migration from "contentful-migration";
import type { MigrationContext, MigrationFunction } from "contentful-migration";
import type { LocaleHelpers } from "./lib/helpers/locale";
import type { ValidationHelpers } from "./lib/helpers/validation";

export interface MigrationHelpers {
  locale: LocaleHelpers,
  validation: ValidationHelpers
}

export type EnhancedMigrationFunction = (
  migration: Migration,
  context?: MigrationContext,
  helpers?: MigrationHelpers
) => void;

export function withHelpers(cb: EnhancedMigrationFunction): MigrationFunction;
export { getLocaleHelpers } from "./lib/helpers/locale";
export { getValidationHelpers } from "./lib/helpers/validation";
