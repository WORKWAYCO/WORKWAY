/**
 * Type declarations for non-TypeScript modules
 * Wrangler handles CSS imports via rules in wrangler.toml
 */
declare module '*.css' {
  const content: string;
  export default content;
}
