import { promises as fs } from "fs";
import path from "path";

export const LOCAL_PAGES_DIR = path.resolve(process.cwd(), "pages");
export const LOCAL_ASSETS_DIR = path.resolve(process.cwd(), "src/assets");

export async function ensureDirectoryExists(directory: string) {
  try {
    await fs.access(directory);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.mkdir(directory, { recursive: true });
    } else {
      throw error;
    }
  }
}
