const multer=require("multer")
const path=require("path")

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,path.join(__dirname,"../public/uploads"))
    },
    filename: (req, file, cb) => {
        // console.log(file);
          const filename = Date.now() + path.extname(file.originalname);
      
        cb(null, filename);
    }
})

const upload = multer({ storage: storage });
  module.exports=upload;