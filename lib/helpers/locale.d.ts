import type { Locale } from "contentful-management/dist/typings/export-types";
import type Migration from "contentful-migration";
import type { MigrationContext } from "contentful-migration";

export interface LocaleHelpers {
  getLocales(): Promise<Locale[]>;
  getDefaultLocale(): Promise<Locale>;
}

export function getLocaleHelpers(migration: Migration, context: MigrationContext): LocaleHelpers;
