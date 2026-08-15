import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

interface ReportStorage {
  save(sourceFilePath: string, key: string): Promise<string>;
}

export class LocalDiskReportStorage implements ReportStorage {
  constructor(private readonly baseDir: string) {}

  async save(sourceFilePath: string, key: string): Promise<string> {
    await mkdir(this.baseDir, { recursive: true });
    const destPath = path.join(this.baseDir, key);
    await copyFile(sourceFilePath, destPath);
    return destPath;
  }
}
