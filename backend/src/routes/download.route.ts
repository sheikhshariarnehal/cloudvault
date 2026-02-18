import { Router } from "express";
import { downloadController } from "../controllers/download.controller";

const router = Router();

router.get("/:messageId", downloadController);

export default router;
