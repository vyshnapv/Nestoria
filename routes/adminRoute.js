const express=require("express")

const admin_route = express();

admin_route.set('views', './views/admin');


const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const offerController = require('../controllers/admin/offerController');


const { adminAuth ,adminAuth1} = require('../middleware/userAuth');
const multer=require("../middleware/multer");
 


//login management
admin_route.get("/login",adminAuth1,adminController.loadLogin) 
admin_route.get("/",adminAuth,adminController.loadDashboard)
admin_route.get("/pageerror",adminController.pageerror)
admin_route.post("/login",adminController.login)
admin_route.get('/logout', adminController.logoutAdmin); 

//user management(customer)
admin_route.get("/users",adminAuth,customerController.customerInfo)
admin_route.patch("/blockCustomer",adminAuth,customerController.customerBlocked)
admin_route.patch("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//category management
admin_route.get("/category",adminAuth,categoryController.categoryInfo)
admin_route.post("/addCategory",adminAuth,categoryController.addCategory)
admin_route.patch("/listCategory",categoryController.listCategory)
admin_route.patch("/unlistCategory",categoryController.unListCategory)
admin_route.get("/editCategory",adminAuth,categoryController.getEditCategory)
admin_route.put("/editCategory/:id",adminAuth,categoryController.editCategory)

//product management
admin_route.get("/addProducts",adminAuth,productController.getProductAddPage)
admin_route.post("/addProducts",adminAuth,multer.array("images",3),productController.addProducts)
admin_route.get("/products",adminAuth,productController.getAllProducts)
admin_route.patch("/blockProduct",adminAuth,productController.blockProduct)
admin_route.patch("/unblockProduct",adminAuth,productController.unblockProduct)
admin_route.get("/editProduct",adminAuth,productController.getEditProduct)
admin_route.post("/editProduct/:id",adminAuth,multer.array("images",3),productController.editProduct)

//order management
admin_route.get('/orderList',adminAuth,adminController.loadOrdersList);
admin_route.get('/orderDetails/:orderId',adminAuth, adminController.adminOrderDetails);
admin_route.post('/updateOrderStatus',adminAuth, adminController.updateOrderStatus);
admin_route.post('/updateReturnStatus', adminController.updateReturnStatus);
admin_route.post('/updateAllProductsStatus', adminAuth, adminController.updateAllProductsStatus);
admin_route.post('/cancelAllProducts', adminAuth, adminController.cancelAllProducts);

//offer managemet
admin_route.get('/offerManagement',adminAuth,offerController.offerManagement);

//product offer
admin_route.get('/productOffer',adminAuth,offerController.loadProductOffer);
admin_route.post('/createProductOffer', adminAuth, offerController.createProductOffer);
admin_route.get('/editProductOffer/:id', adminAuth, offerController.loadEditProductOffer);
admin_route.put('/updateProductOffer/:id', adminAuth, offerController.updateProductOffer);

//category offer
admin_route.get('/categoryOffer',adminAuth,offerController.loadCategoryOffer);
admin_route.post('/createCategoryOffer',adminAuth,offerController.createCategoryOffer);

module.exports=admin_route;