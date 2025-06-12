import type Migration from "contentful-migration";
import type { MigrationContext } from "contentful-migration";

export type ValueMappingFunction<T extends string = string> = (values: T[]) => T[];

export type AddValuesOptionMode = 'sorted' | 'start' | 'end' | 'before' | 'after';

export interface AddValuesOptions {
  mode?: AddValuesOptionMode;
  ref?: string;
}

// define some known mark and node values here to support code completion, but allow any string as well
export type RichTextMarks = 'bold' | 'italic' | 'underline' | 'code' | 'superscript' | 'subscript' | 'strikethrough' | string & {};
export type RichTextNodeType = 'document' | 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4' | 'heading-5' | 'heading-6' | 'ordered-list' | 'unordered-list' | 'list-item' | 'hr' | 'blockquote' | 'embedded-entry-block' | 'embedded-asset-block' | 'embedded-resource-block' | 'table' | 'table-row' | 'table-cell' | 'table-header-cell' | 'asset-hyperlink' | 'embedded-entry-inline' | 'embedded-resource-inline' | 'entry-hyperlink' | 'hyperlink' | 'resource-hyperlink' | string & {};

export type RichTextLinkedNodeType = 'entry-hyperlink' | 'embedded-entry-block' | 'embedded-entry-inline'

export interface RichTextValidationHelpers {
  addEnabledMarksValues(contentTypeId: string, fieldId: string, values: RichTextMarks | RichTextMarks[]): Promise<void>;
  removeEnabledMarksValues(contentTypeId: string, fieldId: string, values: RichTextMarks | RichTextMarks[]): Promise<void>;
  modifyEnabledMarksValues(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction<RichTextMarks>): Promise<void>;

  addEnabledNodeTypeValues(contentTypeId: string, fieldId: string, values: RichTextNodeType | RichTextNodeType[]): Promise<void>;
  removeEnabledNodeTypeValues(contentTypeId: string, fieldId: string, values: RichTextNodeType | RichTextNodeType[]): Promise<void>;
  modifyEnabledNodeTypeValues(contentTypeId: string, fieldId: string, valueMappingFunction: ValueMappingFunction<RichTextNodeType>): Promise<void>;

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
