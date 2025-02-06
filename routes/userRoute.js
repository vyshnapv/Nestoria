const express=require("express");

const user_route=express();
const path=require("path")

user_route.set('views', './views/user');

const userController = require('../controllers/user/userController');
const cartController = require('../controllers/user/cartController');
const orderController = require('../controllers/user/orderController');
const profileController = require("../controllers/user/profileController");
const wishlistController = require("../controllers/user/wishlistController");
const walletController = require("../controllers/user/walletController")

const passport = require("passport");
const { userAuth, userNotAuth, userAuth1 } = require("../middleware/userAuth");

//user management 
user_route.get('/',userAuth,userController.loadHome)
user_route.get("/register",userNotAuth, userController.loadRegister)
user_route.get("/login",userNotAuth,userController.loadLogin)
user_route.get('/logout',userController.logoutUser); 
user_route.get("/pageNotFound",userController.pageNotFound)
user_route.post("/register",userController.insertUser)
user_route.post("/login",userController.loginUser)

//forgot password
user_route.get("/forgotPassword",userNotAuth,profileController.getForgotPassword)
user_route.post("/forgotemailvalid",userNotAuth,profileController.forgotEmailValid)
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
user_route.get("/shop",userAuth,userController.shop)
user_route.get("/product/:id",userAuth,userController.productDetails)

//cart
user_route.get('/cart',userAuth,cartController.loadCart);
user_route.post('/addToCart',userAuth1,cartController.addToCart);
user_route.post('/updateCart',userAuth,cartController.updateCartQuantity);
user_route.post('/removeFromCart',userAuth, cartController.removeCartItem);

//checkout
user_route.get("/checkout",userAuth,cartController.loadCheckout);
user_route.post('/addCheckAddress',userAuth, cartController.addCheckAddress);

//PASSWORD
user_route.get("/editPassword",userAuth,userController.loadEditPassword)
user_route.put("/changepassword",userAuth,userController.changePassword)


//profile
user_route.get("/profile",userAuth,userController.profile);
user_route.put("/editProfile",userAuth,userController.editProfile)

//address
user_route.get("/address",userAuth,userController.loadAddress);
user_route.post("/addAddress",userAuth,userController.addAddress)
user_route.get("/editAddress/:addressId/:index",userAuth,userController.loadEditAddress);
user_route.post('/editAddress/:addressId/:index',userAuth,userController.editAddress);
user_route.delete('/deleteAddress/:addressId/:index',userAuth,userController.deleteAddress);

//Order
user_route.post('/place-order',userAuth,orderController.createOrder);
user_route.post('/verify-razorpay-payment',orderController.verifyRazorpayPayment);
user_route.post('/create-razorpay-order', orderController.createRazorpayOrder);
user_route.get('/ordersuccess/:orderId', userAuth,orderController.orderSuccess);
user_route.get("/viewOrders", userAuth,orderController.getViewOrders)
user_route.get("/orderDetails/:orderId", userAuth,orderController.getOrderDetails)
user_route.post('/orderDetails/:orderId/cancel-item', userAuth, orderController.cancelOrderItem);
user_route.post('/orderDetails/:orderId/return-item', userAuth, orderController.returnOrderItem);

//wishlist
user_route.get("/wishlist",wishlistController.wishlist);
user_route.post('/addWishlist', wishlistController.addToWishlist);
user_route.delete('/removeFromWishlist',wishlistController.removeFromWishlist);


//coupon
user_route.post('/apply-coupon', cartController.applyCoupon);
user_route.post('/remove-coupon', cartController.removeCoupon);

//wallet
user_route.get('/wallet',userAuth,walletController.loadWallet);

module.exports=user_route;