import { Router } from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { config } from "../config/env";
import { uploadController } from "../controllers/upload.controller";

const router = Router();

// Ensure temp directory exists
if (!fs.existsSync(config.TEMP_DIR)) {
  fs.mkdirSync(config.TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    // Unique name to avoid collisions
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB
  },
});

router.post("/", upload.single("file"), uploadController);

export default router;
