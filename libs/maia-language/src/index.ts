/**
 * MaiaCity Language Library
 *
 * Provides Lojban gismu and dictionary parsing utilities
 */

// Dictionary data (from dictionary.xml)
export type { DictionaryEntry } from './parse-dictionary'
export { getDictionaryData, parseDictionaryXml } from './parse-dictionary'
// Gismu data (from gismu.csv)
export type { Gismu } from './parse-gismu'
export { getGismuData, parseGismuCsv } from './parse-gismu'
