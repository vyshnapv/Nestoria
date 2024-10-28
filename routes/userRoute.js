const express=require("express");

const user_route=express();
const path=require("path")

user_route.set('views', './views/user');

const userController = require('../controllers/user/userController');
const passport = require("passport");
const auth = require("../middleware/userAuth")

//GET request 
user_route.get('/',userController.loadHome)
user_route.get("/register", auth.userNotAuth, userController.loadRegister)
user_route.get("/verify-otp",userController.otpPage)
user_route.get("/login",auth.userNotAuth,userController.loadLogin)
user_route.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
user_route.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    res.redirect("/")
})

user_route.get('/logout', userController.logoutUser); 
user_route.get("/shop",userController.shop)
user_route.get("/product/:id",userController.productDetails)
user_route.get("/pageNotFound",userController.pageNotFound)


//POST request
user_route.post("/register",userController.insertUser)
user_route.post("/verify-otp",userController.verifyOtp)
user_route.post("/resend-otp",userController.resendOtp)
user_route.post("/login",userController.loginUser)


module.exports=user_route;