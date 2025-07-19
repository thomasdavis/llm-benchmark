import { dirname, basename, extname } from 'path';

import { globby } from 'globby';

/**
 * Find variant files for a source file
 */
export class VariantFinder {
  /**
   * Find all variant files for a source file
   */
  async findVariants(sourceFile: string): Promise<string[]> {
    const dir = dirname(sourceFile);
    const ext = extname(sourceFile);
    const base = basename(sourceFile, ext);
    
    // Look for variant files with pattern: name.provider.model.ext
    const pattern = `${base}.*.*.${ext.slice(1)}`;
    const files = await globby(pattern, {
      cwd: dir,
      absolute: true,
    });

    // Filter out non-variant files
    return files.filter(file => {
      const name = basename(file, ext);
      const parts = name.split('.');
      // Should have at least 3 parts: original.provider.model
      return parts.length >= 3;
    });
  }

  /**
   * Parse variant metadata from filename
   */
  parseVariantName(filePath: string): {
    provider: string;
    model: string;
  } | null {
    const ext = extname(filePath);
    const name = basename(filePath, ext);
    const parts = name.split('.');
    
    if (parts.length < 3) {
      return null;
    }

    return {
      provider: parts[parts.length - 2],
      model: parts[parts.length - 1],
    };
  }
}