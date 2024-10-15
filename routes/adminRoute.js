const express=require("express")
const router=express.Router();

const admin_route=express();

admin_route.set('view engine', 'ejs');
admin_route.set('views', './views/admin');

const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');

 const { userAuth, adminAuth } = require('../middleware/userAuth');
 const multer=require("../middleware/multer");
 


//login management
admin_route.get("/login",adminController.loadLogin)
admin_route.get("/",adminAuth,adminController.loadDashboard)
admin_route.get("/pageerror",adminController.pageerror)
admin_route.post("/login",adminController.login)

//user management(customer)
admin_route.get("/users",adminAuth,customerController.customerInfo)
admin_route.post("/blockCustomer",adminAuth,customerController.customerBlocked)
admin_route.post("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//category management
admin_route.get("/category",adminAuth,categoryController.categoryInfo)
admin_route.post("/addCategory",adminAuth,categoryController.addCategory)//for add category
admin_route.put("/listCategory",categoryController.getListCategory)
admin_route.put("/unlistCategory",categoryController.getUnListCategory)
admin_route.get("/editCategory",adminAuth,categoryController.getEditCategory)
admin_route.put("/editCategory/:id",adminAuth,categoryController.editCategory)

//product management
admin_route.get("/addProducts",adminAuth,productController.getProductAddPage)
admin_route.post("/addProducts",adminAuth,multer.array("images",3),productController.addProducts)
admin_route.get("/products",adminAuth,productController.getAllProducts)
admin_route.post("/blockProduct",adminAuth,productController.blockProduct)
admin_route.post("/unblockProduct",adminAuth,productController.unblockProduct)
admin_route.get("/editProduct",adminAuth,productController.getEditProduct)
admin_route.put("/editProduct/:id",adminAuth,multer.array("images",3),productController.editProduct)
admin_route.delete("/deleteImage",adminAuth,productController.deleteSingleImage);

module.exports=admin_route;