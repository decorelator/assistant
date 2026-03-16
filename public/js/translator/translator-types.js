/**
 * @typedef {object} TranslatorModelOption
 * @property {string} value
 * @property {string} label
 */

/**
 * @typedef {object} TranslatorSystemMessageOption
 * @property {number} id
 * @property {string} label
 * @property {string} instructionText
 */

/**
 * @typedef {object} TranslatorSelection
 * @property {string} model
 * @property {number | null} systemMessageId
 */

/**
 * @typedef {TranslatorSelection & {
 *   systemMessageLabel: string;
 *   instructionText: string;
 * }} AppliedTranslatorSelection
 */

export const translatorTypeContracts = Object.freeze({});
