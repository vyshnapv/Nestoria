const express=require("express");

const user_route=express();
const path=require("path")

user_route.set('views', './views/user');

const userController = require('../controllers/user/userController');
const cartController = require('../controllers/user/cartController');
const orderController = require('../controllers/user/orderController');
const profileController = require("../controllers/user/profileController")
const passport = require("passport");
const auth = require("../middleware/userAuth")
const auth1 = require("../middleware/userAuthPost")

//user management 
user_route.get('/',userController.loadHome)
user_route.get("/register", auth.userNotAuth, userController.loadRegister)
user_route.get("/login",auth.userNotAuth,userController.loadLogin)
user_route.get('/logout', userController.logoutUser); 
user_route.get("/pageNotFound",userController.pageNotFound)
user_route.post("/register",userController.insertUser)
user_route.post("/login",userController.loginUser)

//forgot password
user_route.get("/forgotPassword",profileController.getForgotPassword)
user_route.post("/forgotemailvalid",profileController.forgotEmailValid)
user_route.post("/verifyForgotPassotp",profileController.verifyForgotPassOtp)
user_route.get("/resetPassword",profileController.getResetPassword)
user_route.post("/resentForgotOtp",profileController.resentOtp)
user_route.post("/resetPassword",profileController.NewPassword)

//otp
user_route.get("/verify-otp",userController.otpPage)
user_route.post("/verify-otp",userController.verifyOtp)
user_route.post("/resend-otp",userController.resendOtp)

//googleAuth
user_route.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
user_route.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    res.redirect("/")
})

//product
user_route.get("/shop",userController.shop)
user_route.get("/product/:id",userController.productDetails)

//cart
user_route.get('/cart',cartController.loadCart);
user_route.post('/addToCart',auth1.userAuth,cartController.addToCart);
user_route.post('/updateCart', auth.userAuth,cartController.updateCartQuantity);
user_route.post('/removeFromCart',auth.userAuth, cartController.removeCartItem);

//checkout
user_route.get("/checkout",cartController.loadCheckout);
user_route.post('/addCheckAddress',auth.userAuth, cartController.addCheckAddress);

//PASSWORD
user_route.get("/editPassword",auth.userAuth,userController.loadEditPassword)
user_route.put("/changepassword",auth.userAuth,userController.changePassword)


//profile
user_route.get("/profile",auth.userAuth,userController.profile);
user_route.put("/editProfile",auth.userAuth,userController.editProfile)

//address
user_route.get("/address",auth.userAuth,userController.loadAddress);
user_route.post("/addAddress",auth.userAuth,userController.addAddress)
user_route.get("/editAddress/:addressId/:index",auth.userAuth,userController.loadEditAddress);
user_route.post('/editAddress/:addressId/:index',auth.userAuth,userController.editAddress);
user_route.delete('/deleteAddress/:addressId/:index',auth.userAuth,userController.deleteAddress);

//Order
user_route.post('/place-order',auth.userAuth,orderController.createOrder);
user_route.get('/ordersuccess/:orderId',orderController.orderSuccess);
user_route.get("/viewOrders",orderController.getViewOrders)
user_route.get("/orderDetails/:orderId",orderController.getOrderDetails)
user_route.post('/orderDetails/:orderId/cancel-item', orderController.cancelOrderItem);

module.exports=user_route;