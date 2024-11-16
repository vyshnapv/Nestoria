const env=require("dotenv").config();
const User = require("../../models/userModel");
const nodemailer=require("nodemailer")
const bcrypt = require('bcrypt');
const session=require("express-session")


//generate otp
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


//sendverificationEmail
const sendverificationEmail=async(email, otp) =>{
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const mailOptions ={
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "your OTP for password reset",
            text: `Your OTP is ${otp}`, 
            html: `<b><h4>Your OTP: ${otp}</h4><br></br>`, 
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:",info.messageId);
        
        return true; 

    } catch (error) {
        console.error("Error sending email:", error.message); 
        return false;
    }
};


const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10);
        return passwordHash;
    } catch (error) {
        
    }
}



//forgotpassword
const getForgotPassword = async(req,res)=>{
    try {
        res.render("forgotPassword", {
            error: null 
        });
        
    } catch (error) {
        console.error("Error loading home page", error);
        res.redirect("/pageNotFound");
    }
}

//forgot email
const forgotEmailValid = async(req,res)=>{
    try {
        const {email} = req.body;
        const findUser = await User.findOne({email:email}); 

             if(findUser) {
                 const otp = generateOTP();
                 const emailSent = await sendverificationEmail(email,otp);

                if(emailSent) {
                     req.session.userOtp = otp;
                     req.session.email = email;
                     res.render("forgotPassotp");
                     console.log("OTP:",otp);
                }else {
                    res.render("forgotPassword", {
                        error: "Failed to send OTP. Please try again."
                    });
                }
             }else {
                res.render("forgotPassword", {
                    error: "No account found with this email address. Please check and try again."
                });
             }
        } catch (error) {
            console.error("Error loading home page", error);
            res.render("forgotPassword", {
                error: "An error occurred. Please try again later."
            });
        
        }    
  }


//verify forgot pass otp
const verifyForgotPassOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({
                success:true,
                redirectUrl:"/resetPassword"
            })
        }else{
            res.json({
                success:false,
                message:"Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        res.json({success:false,message:"An error occure please try again"});
    }
}


//get reset password
const getResetPassword = async(req,res)=>{
    try {
        res.render("resetPassword")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

//resent otp
const resentOtp = async(req,res)=>{
    try {
        const otp = generateOTP();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resend OTP to email:",email);
        const emailSent = await sendverificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"Resend OTP Successfull"})
        }
    } catch (error) {
        console.error("Error in resend OTP",error);
        res.status(500).json({success:false,message:"Internal server error."})
    }
}

//newpasswors
const NewPassword = async(req,res)=>{
    try {
        const {newPass1,newPass2}=req.body;
        const email=req.session.email;
        if(newPass1===newPass2){
            const passwordHash=await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/login")
        }else{
            res.render("resetPassword",{message:"passwords do not match"})
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


module.exports={
      getForgotPassword,
      forgotEmailValid,
      verifyForgotPassOtp,
      getResetPassword,
      resentOtp,
      NewPassword,
}