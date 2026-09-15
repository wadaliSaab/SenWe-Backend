import fs from "fs";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
 destination:(req,file,cb)=>{cb(null,"uploads/")},

 filename:(req,file,cb)=>{
   const uniqueName =
    crypto.randomUUID() + path.extname(file.originalname);
    cb(null,uniqueName);
 },
});

const upload = multer({storage:storage});

export default upload;