const env=require("dotenv").config();
const Category = require("../../models/categoryModel");
const Product = require("../../models/productModel");
const bcrypt = require('bcrypt');
const nodemailer=require("nodemailer")
const User = require("../../models/userModel");


// Password Hashing
const hashPassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.log("Error hashing password:",error.message);
        throw error;
    }
};


//generate otp
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


//sendverificationEmail
async function sendverificationEmail(email, otp) {
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

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`, 
            html: `<b>Your OTP: ${otp}</b>`, 
        });

        return info.accepted.length > 0; 

    } catch (error) {
        console.error("Error sending email:", error.message); 
        return false;
    }
}



//load home page
const loadHome = async (req, res) => {
    try {
        const userData = req.session.user ? await User.findById(req.session.user) : null;
        if (userData && userData.is_blocked) {
            req.session.destroy(); 
            return res.redirect("/login");
        }

        const products=await Product.find()
        res.render('home', { userData ,products});

    } catch (error) {
        console.error("Error loading home page", error);
        res.redirect("/pageNotFound");
    }
};



//load register page
const loadRegister=async(req,res)=>
{
    try{
        res.render("register")
    }
    catch(error)
    {
        console.error("error in loadregister:",error)
    }
}


//load login page
const loadLogin=async(req,res)=>
{
    try{
        res.render("login")
    }
    catch(error)
    {
     console.error("error from login page",error)
    }
}


//insert new user(signup)
const insertUser=async(req,res)=>
    {
        try {
            const { name, email, mobile, pass, re_pass } = req.body;
            
            
            if(pass !== re_pass)
            {
                return res.json({success:false,message:"passwords do not match"})
            }
           
            //check the user already exist
            const findUser=await User.findOne({email})
    
            if(findUser)
            {
                return res.json({success:false,message:"user with this email already exist"})
            }
    
            const otp=generateOTP();

            const emailSend=await sendverificationEmail(email,otp);
    
            if(!emailSend)
            {
                return res.json({success:false,message: "Email error" });
            }

        req.session.userOtp=otp;
        req.session.userData={name,mobile,email,pass};
        
        res.json({success:true,message: "Registered successfully" });
        console.log("OTP send",otp);
    
        } catch (error) {
            console.error("sign-up error",error);
            res.redirect("/pageNotFound")
        }
    }

//otp page loading
    const otpPage=async(req,res)=>{
        try {
            res.render("verify-otp")
        } catch (error) {
            console.error(error);
            
        }
    }


 //verify otp
 const verifyOtp=async(req,res)=>
    {
       try {
           const {otp}=req.body;
           console.log(otp);
   
           if(otp===String(req.session.userOtp))
           {
               const user=req.session.userData;
               const passwordHash=await hashPassword(user.pass);
               const saveUserData=new User({
                   name:user.name,
                   email:user.email,
                   mobile:user.mobile,
                   password:passwordHash,
                   is_verified:true//they enterd the correct otp
               })
   
               await saveUserData.save();
   
               req.session.user=saveUserData._id;
               req.session.userOtp = null; //clear the stored otp from the session
               req.session.userData = null; 
               res.json({success:true,message:"Registration successful!",redirect:"/login"})
           }
           else
           {
               res.status(400).json({success:false,message:"Invalid otp,please try again"})
           }
           
       } catch (error) {
           console.error("Error verifying otp",error);
           res.status(500).json({success:false,message:"An error occure"})
       }
    }
      
//Resend OTP
const resendOtp=async(req,res)=>
    {
       try {
             const userData=req.session.userData;
             const otp=generateOTP();
   
             const emailSend=await sendverificationEmail(userData.email,otp);
             if(emailSend)
             {
               req.session.userOtp=otp;
               console.log("New OTP send:",otp);
               return res.json({success:true,message:"OTP resent successfully"});
             }
             else
             {
               return res.json({success:true,message:"Failed to resend otp,try again"});
             }
       } catch (error) {
             console.error("Error resending otp",error);
             res.status(500).json({success:false,message:"An error occured"});
             
       }
    }
   


//login user
const loginUser=async(req,res)=>
    {
       try{
            const email=req.body.email;
            const pass=req.body.pass;

           const userData =await User.findOne({is_admin:false,email:email})

             if(!userData)
             {
                return res.render("login",{message:"User not found"})
             }

             if(userData.is_blocked)
             {
              return res.render("login",{message:"User is blocked by admin"})
             }
             

             const passwordMatch=await bcrypt.compare(pass,userData.password)

             if(!passwordMatch)
             {
                return res.render("login",{message:"Incorrect Password"})
             }

             req.session.user=userData._id;
             res.redirect("/")
             
            }catch(error)
             {
             console.log("login error:",error);
             res.render("login",{message:"login failed,please try again later"})
             }
        }

//logout user
const logoutUser = async (req, res) => {
    try {
        req.session.destroy((err)=>
        {
            if(err)
            {
                console.log("session destructuring error",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
      
    } catch (error) {
        console.log("Error during logout:", error);
       re.redirect("pageNotFound")
    }
};


//shop page 
 const shop = async (req, res) => {
    try {
        //check if the user is logged
        const userData = req.session.user ? await User.findById(req.session.user) : null;

        if (userData && userData.is_blocked) {
            req.session.destroy(); 
            return res.redirect("/login");
        }

      const selectedCategory = req.query.Category;

      const listedCategories = await Category.find({ isListed: true }).select('_id name');

      const categoryIds = listedCategories.map(category => category._id);
  
      let filter = { isBlocked: false };

      if (selectedCategory) {
        const category = await Category.findOne({ name: selectedCategory, isListed: true });
        if (category) {
          filter.category = category._id; 
        }
      } else {
        filter.category = { $in: categoryIds }; 
      }
  
      const page = parseInt(req.query.page) || 1; 
      const limit = 9; 
      const skip = (page - 1) * limit; 

      
      const totalProducts = await Product.countDocuments(filter);

      const totalPages = Math.ceil(totalProducts / limit);

     
      const products = await Product.find(filter).skip(skip).limit(limit);

      res.render("shop", {
          products,
          userData,
          category: listedCategories,
          selectedCategory,
          currentPage: page,
          totalPages
      });
  } catch (error) {
      console.error("Error in shop", error);
      res.status(500).json({ success: false, message: "An error occurred" });
  }
};
  
//product detailed page
const productDetails=async(req,res)=>{
  try {
    const userData=req.session.user ? await User.findById(req.session.user) : null;

    if (userData && userData.is_blocked) {
        req.session.destroy();
        return res.redirect("/login"); 
      }
  
    const productId=req.params.id;

    const product=await Product.findOne({_id:productId}).populate("category")

    if (!product || !product.category || !product.category.isListed) {
        return res.redirect("/shop");
      }

    const categories=await Category.find({isListed:true});
    res.render("product",{product,userData,categories})
    
  } catch (error) {
    console.error("Error in productdetails",error);
   res.render("404")
  }
}

//page not found
const pageNotFound=async(req,res)=>
    {
      try {
          res.render("404")
      } catch (error) {
        res.redirect("/pageNotFound")
      }
    }



module.exports = {
    loadHome,
    loadRegister,
    loadLogin,
    insertUser,
    otpPage,
    verifyOtp,
    resendOtp,
    loginUser,
    logoutUser,
    shop,
    productDetails,
    pageNotFound,
}