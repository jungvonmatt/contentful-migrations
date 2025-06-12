import type Migration from "contentful-migration";
import type { MigrationContext } from "contentful-migration";

export type ValueMappingFunction = (values: string[]) => string[];

export type AddValuesOptionMode = 'sorted' | 'start' | 'end' | 'before' | 'after';

export interface AddValuesOptions {
  mode?: AddValuesOptionMode;
  ref?: string;
}

export type RichTextMarks = 'bold' | 'italic' | 'underline' | 'code';
export type RichTextLinkedNodeType = 'entry-hyperlink' | 'embedded-entry-block' | 'embedded-entry-inline'

export interface RichTextValidationHelpers {
  addEnabledMarksValue(contentTypeId: string, fieldId: string, values: RichTextMarks | RichTextMarks[]): Promise<void>;
  removeEnabledMarksValue(contentTypeId: string, fieldId: string, values: RichTextMarks | RichTextMarks[]): Promise<void>;
  modifyEnabledMarksValue(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction): Promise<void>;

  addEnabledNodeTypeValue(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  removeEnabledNodeTypeValue(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  modifyEnabledNodeTypeValue(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction): Promise<void>;

  addNodeContentTypeValues(contentTypeId: string, fieldId: string, nodeType: RichTextLinkedNodeType, values: string | string[]): Promise<void>;
  removeNodeContentTypeValues(contentTypeId: string, fieldId: string, nodeType: RichTextLinkedNodeType, values: string | string[]): Promise<void>;
  modifyNodeContentTypeValues(contentTypeId: string, fieldId: string, nodeType: RichTextLinkedNodeType, valueMappingFunction: ValueMappingFunction): Promise<void>;
}

export interface ValidationHelpers {
  addLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  removeLinkContentTypeValues(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  modifyLinkContentTypeValues(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction): Promise<void>;

  addInValues(contentTypeId: string, fieldId: string, values: string | string[], options?: AddValuesOptions): Promise<void>;
  removeInValues(contentTypeId: string, fieldId: string, values: string | string[]): Promise<void>;
  modifyInValues(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction): Promise<void>;

  richText: RichTextValidationHelpers;
}

export function getValidationHelpers(migration: Migration, context: MigrationContext): ValidationHelpers;
