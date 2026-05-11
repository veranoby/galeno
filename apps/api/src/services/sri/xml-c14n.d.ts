/**
 * Type declarations for xml-c14n
 * @see https://www.npmjs.com/package/xml-c14n
 */

declare module 'xml-c14n' {
  /**
   * Canonicalize XML using Exclusive Canonicalization (exc-c14n)
   *
   * @param xml - XML string to canonicalize
   * @param options - Options for canonicalization
   * @returns Canonicalized XML string
   */
  export function canonicalize(
    xml: string, 
    options?: { comments?: boolean }
  ): string;
}
