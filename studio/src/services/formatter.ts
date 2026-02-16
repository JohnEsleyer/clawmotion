import ts from 'typescript';

/**
 * Lightweight fallback formatter that provides Prettier-like normalization
 * without external runtime dependency.
 */
export function formatTypeScript(code: string): string {
    try {
        const source = ts.createSourceFile('inline.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        const printer = ts.createPrinter({
            removeComments: false,
            newLine: ts.NewLineKind.LineFeed
        });
        return printer.printFile(source).trimEnd();
    } catch {
        return code;
    }
}
